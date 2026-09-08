'use strict';

const fs = require('node:fs');

const dockerfilePath = 'Dockerfile';
const packagePath = 'package.json';
const lockPath = 'package-lock.json';
const ciPath = '.github/workflows/ci.yml';
const extendedPath = '.github/workflows/extended.yml';
const securityPath = '.github/workflows/security.yml';
const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const ci = fs.readFileSync(ciPath, 'utf8');
const extended = fs.readFileSync(extendedPath, 'utf8');
const security = fs.readFileSync(securityPath, 'utf8');

const errors = [];
const firstInstruction = dockerfile
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith('#'));

const fromMatch = /^FROM\s+node:([^\s@]+)@sha256:[0-9a-f]{64}$/.exec(firstInstruction ?? '');
if (!fromMatch) {
  errors.push('Dockerfile must start from an explicit Node tag pinned by a sha256 digest');
}

function parseSupportedNodeMajors(range) {
  if (typeof range !== 'string' || !range.trim()) {
    errors.push('package.json engines.node must be a non-empty string');
    return [];
  }

  const majors = [];
  for (const rawClause of range.split('||')) {
    const clause = rawClause.trim();
    const match = /^>=\s*(\d+)(?:\.0\.0)?\s+<\s*(\d+)$/.exec(clause);
    if (!match) {
      errors.push(`engines.node must express explicit single-major qualification lines: ${clause}`);
      continue;
    }
    const lower = Number(match[1]);
    const upper = Number(match[2]);
    if (upper !== lower + 1) {
      errors.push(`engines.node clause spans more than one major line: ${clause}`);
      continue;
    }
    majors.push(lower);
  }

  const unique = [...new Set(majors)].sort((a, b) => a - b);
  if (unique.length !== majors.length) errors.push('engines.node contains duplicate major lines');
  return unique;
}

function collectWorkflowNodeMatrices(name, workflow) {
  const matrices = [];
  for (const match of workflow.matchAll(/node:\s*\[([0-9,\s]+)\]/g)) {
    const majors = match[1]
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
    matrices.push(majors);
  }
  if (matrices.length === 0) errors.push(`${name} must declare a numeric Node compatibility matrix`);
  return matrices;
}

function parseWorkflowNpmVersion(name, workflow) {
  const matches = [
    ...workflow.matchAll(/^\s{2}NPM_VERSION:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/gm),
  ];
  if (matches.length !== 1) {
    errors.push(`${name} must declare exactly one top-level NPM_VERSION`);
    return null;
  }
  if (!workflow.includes('npm@${NPM_VERSION}')) {
    errors.push(`${name} must install npm through the governed NPM_VERSION`);
  }
  if (!workflow.includes('$(npm --version)')) {
    errors.push(`${name} must verify the installed npm version`);
  }
  return matches[0][1];
}

function collectExplicitNodeMajors(workflow) {
  const majors = new Set();
  for (const match of workflow.matchAll(/node-version:\s*["']?(\d+)(?:\.\d+\.\d+)?["']?\s*$/gm)) {
    majors.add(Number(match[1]));
  }
  return [...majors].sort((a, b) => a - b);
}

function sameNumbers(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const engine = packageJson.engines?.node;
const supportedMajors = parseSupportedNodeMajors(engine);
const lockEngine = packageLock.packages?.['']?.engines?.node;
if (lockEngine !== engine) {
  errors.push(`package-lock root Node engine must match package.json: ${lockEngine} != ${engine}`);
}

for (const [name, workflow] of [
  ['ci.yml', ci],
  ['extended.yml', extended],
]) {
  for (const matrix of collectWorkflowNodeMatrices(name, workflow)) {
    if (!sameNumbers(matrix, supportedMajors)) {
      errors.push(
        `${name} Node matrix must exactly match engines.node: matrix=[${matrix}], supported=[${supportedMajors}]`
      );
    }
  }
}

let imageMajor = null;
if (fromMatch) {
  const imageMajorMatch = /^(\d+)(?:\.|$)/.exec(fromMatch[1]);
  if (!imageMajorMatch) {
    errors.push(`Dockerfile Node tag must begin with a numeric major version: ${fromMatch[1]}`);
  } else {
    imageMajor = Number(imageMajorMatch[1]);
    if (!supportedMajors.includes(imageMajor)) {
      errors.push(
        `Dockerfile Node major ${imageMajor} is outside the declared supported majors [${supportedMajors}]`
      );
    }
  }
}

const securityMajors = collectExplicitNodeMajors(security);
if (securityMajors.length === 0) {
  errors.push('security.yml must declare its Node runtime explicitly');
} else {
  const unsupported = securityMajors.filter((major) => !supportedMajors.includes(major));
  if (unsupported.length > 0) {
    errors.push(`security.yml uses unsupported Node majors: ${unsupported.join(',')}`);
  }
  if (imageMajor !== null && !securityMajors.includes(imageMajor)) {
    errors.push(`security.yml must include packaged primary Node major ${imageMajor}`);
  }
}

const floatingOsMutations = [
  /\bapk\s+(?:update|upgrade)\b/,
  /\bapt(?:-get)?\s+(?:update|upgrade|dist-upgrade|full-upgrade)\b/,
  /\b(?:dnf|yum|microdnf)\s+(?:update|upgrade)\b/,
];
if (floatingOsMutations.some((pattern) => pattern.test(dockerfile))) {
  errors.push('Dockerfile must not mutate the digest-pinned OS layer with floating package-index or OS upgrade operations');
}

const packageManager = packageJson.packageManager;
const npmMatch = typeof packageManager === 'string' ? /^npm@(\d+\.\d+\.\d+)$/.exec(packageManager) : null;
if (!npmMatch) {
  errors.push('package.json packageManager must pin npm as npm@major.minor.patch');
} else {
  const npmVersion = npmMatch[1];
  if (!dockerfile.includes(`npm@${npmVersion}`)) {
    errors.push(`Dockerfile must install the packageManager npm version (${npmVersion})`);
  }
  if (!dockerfile.includes(`test "$(npm --version)" = "${npmVersion}"`)) {
    errors.push(`Dockerfile must verify the packageManager npm version (${npmVersion})`);
  }
  for (const [name, workflow] of [
    ['ci.yml', ci],
    ['extended.yml', extended],
    ['security.yml', security],
  ]) {
    const workflowNpm = parseWorkflowNpmVersion(name, workflow);
    if (workflowNpm !== null && workflowNpm !== npmVersion) {
      errors.push(`${name} NPM_VERSION must match packageManager: ${workflowNpm} != ${npmVersion}`);
    }
  }
}

for (const required of [
  'npm ci --ignore-scripts --no-audit --no-fund',
  'COPY --chown=node:node package.json package-lock.json ./',
  'USER node',
  'CMD ["npm", "test"]',
]) {
  if (!dockerfile.includes(required)) {
    errors.push(`Dockerfile is missing required deterministic runtime contract: ${required}`);
  }
}

if (errors.length > 0) {
  console.error('Container/runtime policy validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Container/runtime policy: supported Node majors [${supportedMajors}] match package/lock CI/Extended matrices, security Node [${securityMajors}], and the digest-pinned container; npm/toolchain is bound across CI/Extended/Security/container; immutable OS, script-disabled install, and non-root runtime are consistent`
);
