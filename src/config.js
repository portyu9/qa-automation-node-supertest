'use strict';

const { correlationToken } = require('./correlation');

function positiveInteger(name, fallback, env) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function requiredAbsoluteHttpUrl(name, env) {
  const raw = String(env[name] || '').trim();
  if (!raw) {
    throw new Error(`${name} is required`);
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(`${name} must use http or https with a hostname`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${name} must not contain URL credentials`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${name} must not contain a query string or fragment`);
  }
  return raw.replace(/\/$/, '');
}

function loadConfig(env = process.env) {
  return Object.freeze({
    port: positiveInteger('PORT', 3000, env),
    upstreamBaseUrl: requiredAbsoluteHttpUrl('UPSTREAM_BASE_URL', env),
    requestTimeoutMs: positiveInteger('REQUEST_TIMEOUT_MS', 8_000, env),
    runId: correlationToken('TEST_RUN_ID', env.TEST_RUN_ID),
  });
}

module.exports = { loadConfig };
