'use strict';

const fs = require('node:fs');

const EXPECTED_TRIVY_VERSION = '0.74.0';
const GOVERNED_PACKAGES = ['supertest', 'express', 'axios', '@pact-foundation/pact', 'jest'];

function fail(message) {
  throw new Error(`Security evidence validation failed: ${message}`);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    fail(`missing or empty JSON evidence: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function lockedVersion(lock, name) {
  const entry = lock.packages?.[`node_modules/${name}`];
  if (!entry || typeof entry.version !== 'string' || entry.version.length === 0) {
    fail(`package-lock.json does not contain governed package ${name}`);
  }
  return entry.version;
}

function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    fail('usage: node scripts/validate-security-evidence.js <trivy-json-path>');
  }

  const lock = readJson('package-lock.json');
  if (!lock.packages || typeof lock.packages !== 'object') {
    fail('package-lock.json does not contain a packages inventory');
  }

  const report = readJson(reportPath);
  if (report.Trivy?.Version !== EXPECTED_TRIVY_VERSION) {
    fail(`unexpected Trivy version: ${report.Trivy?.Version ?? '<missing>'}`);
  }
  if (!Array.isArray(report.Results) || report.Results.length === 0) {
    fail('Trivy evidence contains no Results');
  }

  const npmResults = report.Results.filter(
    (result) => result?.Type === 'npm' || String(result?.Target ?? '').includes('package-lock.json'),
  );
  if (npmResults.length === 0) {
    fail('Trivy evidence contains no attributed npm/package-lock result');
  }

  const packages = npmResults.flatMap((result) =>
    Array.isArray(result.Packages) ? result.Packages : [],
  );
  const lockPackageCount = Object.keys(lock.packages).filter((key) => key.startsWith('node_modules/')).length;
  const minimumInventory = Math.max(100, Math.floor(lockPackageCount * 0.7));
  if (packages.length < minimumInventory) {
    fail(
      `Trivy npm inventory is unexpectedly shallow: packages=${packages.length}, ` +
        `minimum=${minimumInventory}, lockPackages=${lockPackageCount}`,
    );
  }

  for (const name of GOVERNED_PACKAGES) {
    const version = lockedVersion(lock, name);
    if (!packages.some((pkg) => pkg?.Name === name && pkg?.Version === version)) {
      fail(`Trivy npm evidence does not contain governed package ${name}@${version}`);
    }
  }

  const vulnerabilities = npmResults
    .flatMap((result) => result?.Vulnerabilities ?? [])
    .filter((item) => item?.Severity === 'HIGH' || item?.Severity === 'CRITICAL');
  const misconfigurations = report.Results.flatMap((result) => result?.Misconfigurations ?? []);
  const secrets = report.Results.flatMap((result) => result?.Secrets ?? []);

  if (vulnerabilities.length !== 0) {
    fail(`Trivy npm evidence contains ${vulnerabilities.length} HIGH/CRITICAL finding(s)`);
  }
  if (misconfigurations.length !== 0) {
    fail(`Trivy evidence contains ${misconfigurations.length} gated misconfiguration finding(s)`);
  }
  if (secrets.length !== 0) {
    fail(`Trivy evidence contains ${secrets.length} gated secret finding(s)`);
  }

  console.log(
    `Validated Trivy evidence: npmPackages=${packages.length}/${lockPackageCount}, ` +
      `governedPackages=${GOVERNED_PACKAGES.length}, HIGH/CRITICAL=0, ` +
      `misconfigurations=0, secrets=0, scanner=${EXPECTED_TRIVY_VERSION}`,
  );
}

main();
