'use strict';

const { randomUUID } = require('node:crypto');

const SAFE_CORRELATION_TOKEN = /^[A-Za-z0-9._:-]{1,128}$/;

function correlationToken(name, value, fallback = randomUUID()) {
  const token = String(value ?? '').trim() || fallback;
  if (!SAFE_CORRELATION_TOKEN.test(token)) {
    throw new Error(
      `${name} must be 1-128 ASCII letters, digits, dots, underscores, colons, or hyphens`
    );
  }
  return token;
}

module.exports = { SAFE_CORRELATION_TOKEN, correlationToken };
