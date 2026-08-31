const fs = require('node:fs');
const path = require('node:path');

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
if (!Number.isInteger(jest.numTotalTests) || jest.numTotalTests <= 0) throw new Error('Jest evidence contains zero executed tests');
if (jest.numFailedTests !== 0 || jest.numPassedTests <= 0) throw new Error(`Jest evidence is not a clean executed run: passed=${jest.numPassedTests}, failed=${jest.numFailedTests}`);

const coverage = readJson(path.join('coverage', 'coverage-summary.json'));
const lines = coverage.total?.lines;
if (!lines || Number(lines.total) <= 0 || Number(lines.covered) <= 0) throw new Error('coverage evidence contains no measured source lines');

let pactFiles;
try {
  pactFiles = fs.readdirSync('pacts', { withFileTypes: true })
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
  if (!Array.isArray(pact.interactions) || pact.interactions.length === 0) throw new Error(`Pact artifact contains no interactions: ${file}`);
  interactions += pact.interactions.length;
}
console.log(`validated CI evidence: tests=${jest.numTotalTests}, coveredLines=${lines.covered}/${lines.total}, pactInteractions=${interactions}`);
