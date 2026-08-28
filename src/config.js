'use strict';

const { randomUUID } = require('node:crypto');

function positiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function absoluteHttpUrl(name, fallback) {
  const raw = process.env[name] || fallback;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  return raw.replace(/\/$/, '');
}

function loadConfig() {
  return Object.freeze({
    port: positiveInteger('PORT', 3000),
    upstreamBaseUrl: absoluteHttpUrl(
      'UPSTREAM_BASE_URL',
      'https://jsonplaceholder.typicode.com'
    ),
    requestTimeoutMs: positiveInteger('REQUEST_TIMEOUT_MS', 8_000),
    runId: (process.env.TEST_RUN_ID || '').trim() || randomUUID(),
  });
}

module.exports = { loadConfig };
