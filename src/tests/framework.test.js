const request = require('supertest');
const { createApp } = require('../app');
const { loadConfig } = require('../config');
const { apiAgent } = require('../testing/apiAgent');

const app = createApp({
  postsClient: {
    getPosts: jest.fn(),
    getPost: jest.fn(),
  },
});

describe('framework contracts', () => {
  test('health endpoint propagates a request correlation id', async () => {
    const api = apiAgent(app, { runId: 'framework' });
    const response = await api.get('/health').expect(200);

    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.body.status).toBe('ok');
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  test('safe inbound request ids are preserved', async () => {
    const incoming = 'upstream.request-42';
    const response = await request(app)
      .get('/health')
      .set('x-request-id', incoming)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(incoming);
    expect(response.body.requestId).toBe(incoming);
  });

  test('oversized inbound request ids are replaced with a bounded generated id', async () => {
    const incoming = 'x'.repeat(129);
    const response = await request(app)
      .get('/health')
      .set('x-request-id', incoming)
      .expect(200);

    expect(response.headers['x-request-id']).not.toBe(incoming);
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  test('unknown routes return a stable error envelope', async () => {
    const response = await apiAgent(app).get('/does-not-exist').expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'not_found',
        requestId: expect.any(String),
      })
    );
  });

  test('runtime configuration requires an explicit upstream target', () => {
    expect(() => loadConfig({})).toThrow('UPSTREAM_BASE_URL is required');
  });

  test('runtime configuration is parsed from an injected read-only environment', () => {
    const config = loadConfig({
      PORT: '4100',
      UPSTREAM_BASE_URL: 'https://api.example.test/v1/',
      REQUEST_TIMEOUT_MS: '2500',
      TEST_RUN_ID: ' config:contract-42 ',
    });

    expect(config).toEqual({
      port: 4100,
      upstreamBaseUrl: 'https://api.example.test/v1',
      requestTimeoutMs: 2500,
      runId: 'config:contract-42',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  test.each([
    ['REQUEST_TIMEOUT_MS', '0'],
    ['UPSTREAM_BASE_URL', 'localhost:8080'],
    ['UPSTREAM_BASE_URL', 'https://:443'],
    ['UPSTREAM_BASE_URL', 'https://user:password@example.test'],
    ['UPSTREAM_BASE_URL', 'https://example.test/api?access_token=secret'],
    ['UPSTREAM_BASE_URL', 'https://example.test/api#fragment'],
    ['TEST_RUN_ID', 'unsafe run id'],
    ['TEST_RUN_ID', 'line-break\nheader'],
    ['TEST_RUN_ID', 'x'.repeat(129)],
  ])('invalid %s configuration fails before server startup', (name, value) => {
    expect(() =>
      loadConfig({
        UPSTREAM_BASE_URL: 'https://api.example.test',
        [name]: value,
      })
    ).toThrow(name);
  });
});
