const fs = require('node:fs');
const path = require('node:path');

const MINIMUM_EXECUTED_TESTS = 60;

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

const jest = readJson(path.join('reports', 'jest-results.json'));
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

const coverage = readJson(path.join('coverage', 'coverage-summary.json'));
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
if (pactFiles.length === 0) throw new Error('no Pact artifact was generated');
let interactions = 0;
for (const file of pactFiles) {
  const pact = readJson(path.join('pacts', file));
  if (!Array.isArray(pact.interactions) || pact.interactions.length === 0) {
    throw new Error(`Pact artifact contains no interactions: ${file}`);
  }
  interactions += pact.interactions.length;
}
console.log(
  `validated CI evidence: executedTests=${executed}, pending=${pending}, todo=${todo}, coveredLines=${coverage.total.lines.covered}/${coverage.total.lines.total}, coveredBranches=${coverage.total.branches.covered}/${coverage.total.branches.total}, pactInteractions=${interactions}`
);
