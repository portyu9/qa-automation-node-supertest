const app = require('../app');
const { loadConfig } = require('../config');
const { apiAgent } = require('../testing/apiAgent');

describe('framework contracts', () => {
  test('health endpoint propagates a request correlation id', async () => {
    const api = apiAgent(app, { runId: 'framework' });
    const response = await api.get('/health').expect(200);

    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.body.status).toBe('ok');
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

  test('invalid configuration fails before the server is started', () => {
    const original = process.env.REQUEST_TIMEOUT_MS;
    try {
      process.env.REQUEST_TIMEOUT_MS = '0';
      expect(() => loadConfig()).toThrow('REQUEST_TIMEOUT_MS');
    } finally {
      if (original === undefined) delete process.env.REQUEST_TIMEOUT_MS;
      else process.env.REQUEST_TIMEOUT_MS = original;
    }
  });
});
