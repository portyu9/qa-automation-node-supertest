'use strict';

const fs = require('node:fs');

const dockerfilePath = 'Dockerfile';
const packagePath = 'package.json';
const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const errors = [];
const firstInstruction = dockerfile
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith('#'));

if (!/^FROM\s+node:[^\s@]+@sha256:[0-9a-f]{64}$/.test(firstInstruction ?? '')) {
  errors.push('Dockerfile must start from an explicit Node tag pinned by a sha256 digest');
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
const npmMatch = typeof packageManager === 'string' ? /^npm@(.+)$/.exec(packageManager) : null;
if (!npmMatch) {
  errors.push('package.json packageManager must pin an npm version');
} else {
  const npmVersion = npmMatch[1];
  if (!dockerfile.includes(`npm@${npmVersion}`)) {
    errors.push(`Dockerfile must install the packageManager npm version (${npmVersion})`);
  }
  if (!dockerfile.includes(`test "$(npm --version)" = "${npmVersion}"`)) {
    errors.push(`Dockerfile must verify the packageManager npm version (${npmVersion})`);
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
  console.error('Container policy validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Container policy: digest-pinned base, immutable OS layer, pinned npm toolchain, script-disabled lock install, and non-root runtime are consistent');
