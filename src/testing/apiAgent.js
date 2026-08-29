'use strict';

const request = require('supertest');
const { randomUUID } = require('node:crypto');

function apiAgent(app, { runId = process.env.TEST_RUN_ID || randomUUID() } = {}) {
  const agent = request.agent(app);

  function issue(method, path) {
    const verb = String(method).toLowerCase();
    if (typeof agent[verb] !== 'function') {
      throw new TypeError(`unsupported HTTP method: ${method}`);
    }
    return agent[verb](path).set('x-request-id', `${runId}-${randomUUID()}`);
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
