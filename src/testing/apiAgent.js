'use strict';

const request = require('supertest');
const { randomUUID } = require('node:crypto');

function apiAgent(app, { runId = process.env.TEST_RUN_ID || randomUUID() } = {}) {
  const agent = request.agent(app);

  return {
    get: (path) => agent.get(path).set('x-request-id', `${runId}-${randomUUID()}`),
    post: (path) => agent.post(path).set('x-request-id', `${runId}-${randomUUID()}`),
    put: (path) => agent.put(path).set('x-request-id', `${runId}-${randomUUID()}`),
    patch: (path) => agent.patch(path).set('x-request-id', `${runId}-${randomUUID()}`),
    delete: (path) => agent.delete(path).set('x-request-id', `${runId}-${randomUUID()}`),
  };
}

module.exports = { apiAgent };
