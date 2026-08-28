const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../src/app');

async function main() {
  const postsClient = {
    async getPosts() {
      return { data: [{ id: 1, userId: 7, title: 'deterministic', body: 'local' }] };
    },
    async getPost(id) {
      return { data: { id, userId: 7, title: `post-${id}`, body: 'local' } };
    },
  };

  const config = {
    upstreamBaseUrl: 'https://example.invalid',
    requestTimeoutMs: 1_000,
    runId: 'live-smoke',
  };
  const app = createApp({ postsClient, config });
  const server = app.listen(0, '127.0.0.1');

  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${baseUrl}/health`, {
      headers: { 'x-request-id': 'live-smoke-health' },
    });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('x-request-id'), 'live-smoke-health');
    assert.deepEqual(await health.json(), {
      status: 'ok',
      requestId: 'live-smoke-health',
    });

    const post = await fetch(`${baseUrl}/posts/42`, {
      headers: { 'x-request-id': 'live-smoke-post' },
    });
    assert.equal(post.status, 200);
    assert.equal(post.headers.get('x-request-id'), 'live-smoke-post');
    assert.deepEqual(await post.json(), {
      id: 42,
      userId: 7,
      title: 'post-42',
      body: 'local',
    });

    const invalid = await fetch(`${baseUrl}/posts/not-an-id`, {
      headers: { 'x-request-id': 'live-smoke-invalid' },
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), {
      error: 'invalid_post_id',
      requestId: 'live-smoke-invalid',
    });

    console.log(`live listener smoke: ok (${baseUrl})`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
