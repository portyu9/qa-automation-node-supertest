'use strict';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

function normalizeAbsoluteHttpUrl(value, name = 'URL') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required`);
  }

  const raw = value.trim();
  if (CONTROL_CHARACTER_PATTERN.test(raw)) {
    throw new Error(`${name} must not contain control characters`);
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
  if (parsed.port === '0') {
    throw new Error(`${name} port must be between 1 and 65535`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${name} must not contain URL credentials`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${name} must not contain a query string or fragment`);
  }

  const canonical = parsed.toString();
  return canonical.endsWith('/') ? canonical.slice(0, -1) : canonical;
}

module.exports = { normalizeAbsoluteHttpUrl };
