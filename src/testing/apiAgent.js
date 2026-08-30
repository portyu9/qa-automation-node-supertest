'use strict';

const request = require('supertest');
const { randomUUID } = require('node:crypto');
const { correlationToken } = require('../correlation');

const SUPPORTED_METHODS = new Set(['get', 'head', 'options', 'post', 'put', 'patch', 'delete']);

function apiAgent(app, { runId = process.env.TEST_RUN_ID } = {}) {
  const agent = request.agent(app);
  const resolvedRunId = correlationToken('runId', runId);

  function issue(method, path) {
    const verb = String(method).trim().toLowerCase();
    if (!SUPPORTED_METHODS.has(verb)) {
      throw new TypeError(`unsupported HTTP method: ${method}`);
    }
    return agent[verb](path)
      .set('x-test-run-id', resolvedRunId)
      .set('x-request-id', randomUUID());
  }

  return Object.freeze({
    request: issue,
    get: (path) => issue('get', path),
    head: (path) => issue('head', path),
    options: (path) => issue('options', path),
    post: (path) => issue('post', path),
    put: (path) => issue('put', path),
    patch: (path) => issue('patch', path),
    delete: (path) => issue('delete', path),
  });
}

module.exports = { apiAgent };
