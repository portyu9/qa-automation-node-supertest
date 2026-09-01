const fs = require('node:fs');
const path = require('node:path');

const MINIMUM_EXECUTED_TESTS = 60;
const GOVERNED_SUITES = new Map([
  ['src/tests/supertestCapabilities.test.js', 6],
  ['src/tests/posts.test.js', 9],
  ['src/tests/framework.test.js', 19],
  ['src/tests/postsUpstreamClient.test.js', 18],
  ['src/contracts/posts.contract.test.js', 1],
  ['src/tests/postsRouter.validation.test.js', 11],
]);
const GOVERNED_TESTS = [
  'Supertest transport capability contracts request.agent persists cookies across in-process requests',
  'Supertest transport capability contracts query, JSON body, headers, and custom expect functions compose in one chain',
  'Supertest transport capability contracts redirect following and generic verb dispatch remain available through the framework agent',
  '/posts component boundary GET /posts returns upstream data without opening a TCP listener',
  '/posts component boundary GET /posts/:id passes a validated numeric identifier to the client',
  '/posts component boundary maps upstream_timeout to a stable dependency error envelope',
  '/posts component boundary maps upstream_unavailable to a stable dependency error envelope',
  '/posts component boundary unexpected application failures remain internal server errors',
  'framework contracts health endpoint propagates a request correlation id',
  'framework contracts safe inbound request ids are preserved',
  'framework contracts oversized inbound request ids are replaced with a bounded generated id',
  'framework contracts unknown routes return a stable error envelope',
  'framework contracts runtime configuration requires an explicit upstream target',
  'PostsUpstreamClient transport contract canonicalizes and applies the configured base URL and timeout to Axios',
  'PostsUpstreamClient transport contract normalizes ECONNABORTED transport failures to upstream_timeout',
  'PostsUpstreamClient transport contract normalizes ETIMEDOUT transport failures to upstream_timeout',
  'PostsUpstreamClient transport contract normalizes ECONNRESET transport failures to upstream_unavailable',
  'Posts API consumer contract returns post 1 when it exists',
  'posts route identifier parser accepts 42 as 42',
  'posts route identifier parser rejects "1e3"',
  'posts route identifier parser rejects "9007199254740992"',
];
const GOVERNED_PACT = {
  consumer: 'PostsConsumer',
  provider: 'PostsProvider',
  description: 'a request for post 1',
  method: 'GET',
  path: '/posts/1',
  status: 200,
};

function readJson(file) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new Error(`missing evidence: ${file}`);
    throw error;
  }
  if (content.length === 0) throw new Error(`empty evidence: ${file}`);
  return JSON.parse(content);
}

function normalizeSuiteName(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Jest suite evidence has no file name');
  const relative = path.isAbsolute(name) ? path.relative(process.cwd(), name) : name;
  return relative.replaceAll(path.sep, '/').replace(/^\.\//, '');
}

function validateJest(jest) {
  const total = Number(jest.numTotalTests);
  const passed = Number(jest.numPassedTests);
  const failed = Number(jest.numFailedTests);
  const pending = Number(jest.numPendingTests ?? 0);
  const todo = Number(jest.numTodoTests ?? 0);
  if (![total, passed, failed, pending, todo].every(Number.isInteger)) {
    throw new Error('Jest evidence is missing integer test-count metadata');
  }
  if (total !== passed + failed + pending + todo) {
    throw new Error(
      `Jest test counts do not reconcile: total=${total}, passed=${passed}, failed=${failed}, pending=${pending}, todo=${todo}`
    );
  }
  const executed = passed + failed;
  if (executed < MINIMUM_EXECUTED_TESTS) {
    throw new Error(
      `Jest evidence contains only ${executed} executed tests; minimum is ${MINIMUM_EXECUTED_TESTS} (pending=${pending}, todo=${todo})`
    );
  }
  if (failed !== 0 || passed <= 0 || Number(jest.numFailedTestSuites ?? 0) !== 0) {
    throw new Error(
      `Jest evidence is not a clean executed run: passed=${passed}, failed=${failed}, failedSuites=${jest.numFailedTestSuites ?? 'missing'}`
    );
  }

  if (!Array.isArray(jest.testResults) || jest.testResults.length === 0) {
    throw new Error('Jest evidence contains no suite-level results');
  }
  if (
    Number.isInteger(Number(jest.numTotalTestSuites)) &&
    Number(jest.numTotalTestSuites) !== jest.testResults.length
  ) {
    throw new Error(
      `Jest suite counts do not reconcile: totalSuites=${jest.numTotalTestSuites}, results=${jest.testResults.length}`
    );
  }

  const suites = new Map();
  const assertionsByName = new Map();
  for (const suite of jest.testResults) {
    const suiteName = normalizeSuiteName(suite.name);
    if (suites.has(suiteName)) throw new Error(`duplicate Jest suite evidence: ${suiteName}`);
    if (!Array.isArray(suite.assertionResults)) {
      throw new Error(`Jest suite has no assertionResults: ${suiteName}`);
    }
    let suiteExecuted = 0;
    for (const assertion of suite.assertionResults) {
      const status = assertion?.status;
      if (!['passed', 'failed', 'pending', 'todo'].includes(status)) {
        throw new Error(`Jest assertion has unsupported status in ${suiteName}: ${status}`);
      }
      if (status === 'passed' || status === 'failed') suiteExecuted += 1;
      const fullName = assertion?.fullName;
      if (typeof fullName !== 'string' || !fullName.trim()) {
        throw new Error(`Jest assertion has no fullName in ${suiteName}`);
      }
      if (assertionsByName.has(fullName)) {
        throw new Error(`duplicate Jest assertion identity: ${fullName}`);
      }
      assertionsByName.set(fullName, status);
    }
    suites.set(suiteName, suiteExecuted);
  }

  for (const [suiteName, minimum] of GOVERNED_SUITES) {
    const actual = suites.get(suiteName) ?? 0;
    if (actual < minimum) {
      throw new Error(`governed Jest suite floor not met: ${suiteName}=${actual}/${minimum}`);
    }
  }
  for (const fullName of GOVERNED_TESTS) {
    const status = assertionsByName.get(fullName);
    if (status !== 'passed') {
      throw new Error(`governed Jest behavior did not pass: ${fullName} status=${status ?? '<missing>'}`);
    }
  }

  return { executed, pending, todo, suites };
}

function validateCoverage(coverage) {
  const coverageMetrics = ['lines', 'statements', 'functions', 'branches'];
  for (const metric of coverageMetrics) {
    const value = coverage.total?.[metric];
    if (!value || !Number.isInteger(Number(value.total)) || Number(value.total) <= 0) {
      throw new Error(`coverage evidence contains no measured ${metric}`);
    }
    if (
      !Number.isInteger(Number(value.covered)) ||
      Number(value.covered) < 0 ||
      Number(value.covered) > Number(value.total)
    ) {
      throw new Error(`coverage evidence contains invalid ${metric} covered/total values`);
    }
  }
  return coverage.total;
}

function validatePacts(pactFiles) {
  if (pactFiles.length === 0) throw new Error('no Pact artifact was generated');
  let interactions = 0;
  let governedMatches = 0;
  for (const file of pactFiles) {
    const pact = readJson(path.join('pacts', file));
    if (!Array.isArray(pact.interactions) || pact.interactions.length === 0) {
      throw new Error(`Pact artifact contains no interactions: ${file}`);
    }
    interactions += pact.interactions.length;
    const consumer = pact.consumer?.name;
    const provider = pact.provider?.name;
    for (const interaction of pact.interactions) {
      if (
        consumer === GOVERNED_PACT.consumer &&
        provider === GOVERNED_PACT.provider &&
        interaction?.description === GOVERNED_PACT.description &&
        interaction?.request?.method === GOVERNED_PACT.method &&
        interaction?.request?.path === GOVERNED_PACT.path &&
        interaction?.response?.status === GOVERNED_PACT.status
      ) {
        governedMatches += 1;
      }
    }
  }
  if (governedMatches !== 1) {
    throw new Error(
      `governed Pact interaction evidence mismatch: expected exactly one ${GOVERNED_PACT.method} ${GOVERNED_PACT.path} ${GOVERNED_PACT.status}, found ${governedMatches}`
    );
  }
  return interactions;
}

function main() {
  const jest = readJson(path.join('reports', 'jest-results.json'));
  const jestSummary = validateJest(jest);
  const coverage = readJson(path.join('coverage', 'coverage-summary.json'));
  const coverageSummary = validateCoverage(coverage);

  let pactFiles;
  try {
    pactFiles = fs
      .readdirSync('pacts', { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name);
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new Error('no Pact artifact directory was generated');
    throw error;
  }
  const interactions = validatePacts(pactFiles);
  const governedSuites = [...GOVERNED_SUITES.entries()]
    .map(([suite, minimum]) => `${path.basename(suite)}=${jestSummary.suites.get(suite)}/${minimum}`)
    .join(',');
  console.log(
    `validated CI evidence: executedTests=${jestSummary.executed}, pending=${jestSummary.pending}, todo=${jestSummary.todo}, ` +
      `coveredLines=${coverageSummary.lines.covered}/${coverageSummary.lines.total}, ` +
      `coveredBranches=${coverageSummary.branches.covered}/${coverageSummary.branches.total}, ` +
      `governedSuites=[${governedSuites}], pactInteractions=${interactions}, governedPact=1`
  );
}

if (require.main === module) main();

module.exports = {
  GOVERNED_PACT,
  GOVERNED_SUITES,
  GOVERNED_TESTS,
  validateCoverage,
  validateJest,
  validatePacts,
};
