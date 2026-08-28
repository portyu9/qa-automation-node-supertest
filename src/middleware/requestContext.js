'use strict';

const { randomUUID } = require('node:crypto');

function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  const requestId = incoming && incoming.trim() ? incoming.trim() : randomUUID();
  req.requestId = requestId;
  res.set('x-request-id', requestId);
  next();
}

module.exports = { requestContext };
