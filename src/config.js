'use strict';

const { correlationToken } = require('./correlation');
const { normalizeAbsoluteHttpUrl } = require('./urlPolicy');

function positiveInteger(name, fallback, env) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function tcpPort(name, fallback, env) {
  const value = positiveInteger(name, fallback, env);
  if (value > 65_535) {
    throw new Error(`${name} must be between 1 and 65535`);
  }
  return value;
}

function loadConfig(env = process.env) {
  return Object.freeze({
    port: tcpPort('PORT', 3000, env),
    upstreamBaseUrl: normalizeAbsoluteHttpUrl(env.UPSTREAM_BASE_URL, 'UPSTREAM_BASE_URL'),
    requestTimeoutMs: positiveInteger('REQUEST_TIMEOUT_MS', 8_000, env),
    runId: correlationToken('TEST_RUN_ID', env.TEST_RUN_ID),
  });
}

module.exports = { loadConfig };
