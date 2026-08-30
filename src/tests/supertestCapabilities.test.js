'use strict';

const express = require('express');
const { apiAgent } = require('../testing/apiAgent');
const {
  expectBody,
  expectHeader,
  expectJsonResponse,
} = require('../testing/expectations');

function capabilityApp() {
  const app = express();
  app.use(express.json());

  app.post('/session', (_req, res) => {
    res.cookie('fixture-session', 'active', {
      httpOnly: true,
      sameSite: 'strict',
    });
    res.status(201).json({ authenticated: true });
  });

  app.get('/session/me', (req, res) => {
    const cookie = req.headers.cookie || '';
    res.json({ authenticated: /(?:^|;\s*)fixture-session=active(?:;|$)/.test(cookie) });
  });

  app.post('/echo', (req, res) => {
    res.set('x-request-id', req.headers['x-request-id'] || 'missing');
    res.set('x-test-run-id', req.headers['x-test-run-id'] || 'missing');
    res.json({ query: req.query, body: req.body });
  });

  app.get('/redirect', (_req, res) => res.redirect(302, '/target'));
  app.get('/target', (_req, res) => res.json({ reached: true }));

  app.head('/resource', (_req, res) => {
    res.set('x-resource-version', '1').status(204).end();
  });
  app.options('/resource', (_req, res) => {
    res.set('allow', 'HEAD, OPTIONS').status(204).end();
  });

  return app;
}

describe('Supertest transport capability contracts', () => {
  test('request.agent persists cookies across in-process requests', async () => {
    const client = apiAgent(capabilityApp(), { runId: 'cookie-contract' });

    await client
      .post('/session')
      .send({ username: 'fixture-user' })
      .expect(201)
      .expect('set-cookie', /fixture-session=active/)
      .expect(expectJsonResponse);

    await client
      .get('/session/me')
      .expect(200)
      .expect(expectJsonResponse)
      .expect(expectBody((body) => body.authenticated === true, 'agent did not replay session cookie'));
  });

  test('query, JSON body, headers, and custom expect functions compose in one chain', async () => {
    const client = apiAgent(capabilityApp(), { runId: ' composition:42 ' });

    await client
      .post('/echo')
      .query({ mode: 'strict', page: 2 })
      .send({ value: 42, enabled: true })
      .expect(200)
      .expect(expectJsonResponse)
      .expect(expectHeader('x-request-id', /^[0-9a-f-]{36}$/i))
      .expect(expectHeader('x-test-run-id', 'composition:42'))
      .expect(
        expectBody(
          (body) =>
            body.query.mode === 'strict' &&
            body.query.page === '2' &&
            body.body.value === 42 &&
            body.body.enabled === true,
          'query/body composition contract failed'
        )
      );
  });

  test.each(['unsafe run id', 'line-break\nheader', 'x'.repeat(129)])(
    'rejects unsafe run correlation before issuing a request: %s',
    (runId) => {
      expect(() => apiAgent(capabilityApp(), { runId })).toThrow(/runId/);
    }
  );

  test('redirect following and generic verb dispatch remain available through the framework agent', async () => {
    const client = apiAgent(capabilityApp(), { runId: 'protocol' });

    await client
      .get('/redirect')
      .redirects(1)
      .expect(200)
      .expect(expectJsonResponse)
      .expect(expectBody((body) => body.reached === true));

    await client.request('HEAD', '/resource').expect(204).expect('x-resource-version', '1');
    await client.options('/resource').expect(204).expect('allow', 'HEAD, OPTIONS');
    expect(() => client.request('constructor', '/resource')).toThrow('unsupported HTTP method');
  });
});
