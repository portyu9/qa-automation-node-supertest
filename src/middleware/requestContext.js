'use strict';

const { randomUUID } = require('node:crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function normalizeRequestId(value) {
  const candidate = String(value || '').trim();
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

function requestContext(req, res, next) {
  const requestId = normalizeRequestId(req.get('x-request-id'));
  req.requestId = requestId;
  res.set('x-request-id', requestId);
  next();
}

module.exports = { normalizeRequestId, requestContext };