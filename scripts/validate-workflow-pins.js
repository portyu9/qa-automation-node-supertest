'use strict';

const fs = require('node:fs');
const path = require('node:path');

const workflowsRoot = path.join(process.cwd(), '.github');
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return ['.yml', '.yaml'].includes(path.extname(entry.name)) ? [entryPath] : [];
  });
}

for (const workflowPath of walk(workflowsRoot)) {
  const lines = fs.readFileSync(workflowPath, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const reference = line.match(/^\s*uses:\s*([^\s#]+)/u)?.[1];
    if (!reference || reference.startsWith('./')) return;

    if (reference.startsWith('docker://')) {
      if (!/@sha256:[0-9a-f]{64}$/iu.test(reference)) {
        failures.push(`${workflowPath}:${index + 1}: Docker action must use an immutable sha256 digest: ${reference}`);
      }
      return;
    }

    const separator = reference.lastIndexOf('@');
    const ref = separator >= 0 ? reference.slice(separator + 1) : '';
    if (!/^[0-9a-f]{40}$/iu.test(ref)) {
      failures.push(`${workflowPath}:${index + 1}: external action must use a full 40-character commit SHA: ${reference}`);
    }
  });
}

if (failures.length > 0) {
  console.error('Workflow pin contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Workflow pin contract passed: all external actions use immutable commit SHAs or Docker digests.');
