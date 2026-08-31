const fs = require('node:fs');
const path = require('node:path');

const file = path.join('reports', 'listener-evidence.json');
let content;
try {
  content = fs.readFileSync(file, 'utf8');
} catch (error) {
  if (error && error.code === 'ENOENT') throw new Error(`missing listener evidence: ${file}`);
  throw error;
}
if (content.length === 0) throw new Error(`empty listener evidence: ${file}`);

const evidence = JSON.parse(content);
if (evidence.schemaVersion !== 1 || evidence.transport !== 'loopback') throw new Error('listener evidence schema/transport mismatch');
if (process.env.TEST_RUN_ID && evidence.runId !== process.env.TEST_RUN_ID) throw new Error('listener evidence run ID does not match the current execution');
if (!Array.isArray(evidence.checks) || evidence.checks.length !== 3 || evidence.checks.some((check) => check.status !== 'passed')) throw new Error('listener evidence does not prove all three listener checks passed');
console.log(`validated listener evidence: checks=${evidence.checks.length}, runId=${evidence.runId}`);
