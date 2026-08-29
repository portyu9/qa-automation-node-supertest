'use strict';

const { randomUUID } = require('node:crypto');
const { SAFE_CORRELATION_TOKEN } = require('../correlation');

function normalizeRequestId(value) {
  const candidate = String(value || '').trim();
  return SAFE_CORRELATION_TOKEN.test(candidate) ? candidate : randomUUID();
}

function requestContext(req, res, next) {
  const requestId = normalizeRequestId(req.get('x-request-id'));
  req.requestId = requestId;
  res.set('x-request-id', requestId);
  next();
}

module.exports = { normalizeRequestId, requestContext };
