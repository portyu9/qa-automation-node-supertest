const { createApp } = require('../app');
const { UpstreamServiceError } = require('../clients/upstreamError');
const { apiAgent } = require('../testing/apiAgent');

function testApp(postsClient) {
  return createApp({ postsClient });
}

describe('/posts component boundary', () => {
  test('GET /posts returns upstream data without opening a TCP listener', async () => {
    const posts = [{ id: 1, userId: 7, title: 'title', body: 'body' }];
    const postsClient = {
      getPosts: jest.fn().mockResolvedValue({ data: posts }),
      getPost: jest.fn(),
    };

    const response = await apiAgent(testApp(postsClient), { runId: 'posts-list' })
      .get('/posts')
      .expect(200)
      .expect('content-type', /json/);

    expect(response.body).toEqual(posts);
    expect(postsClient.getPosts).toHaveBeenCalledTimes(1);
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  test('GET /posts/:id passes a validated numeric identifier to the client', async () => {
    const post = { id: 1, userId: 7, title: 'title', body: 'body' };
    const postsClient = {
      getPosts: jest.fn(),
      getPost: jest.fn().mockResolvedValue({ data: post }),
    };

    const response = await apiAgent(testApp(postsClient), { runId: 'posts-item' })
      .get('/posts/1')
      .expect(200);

    expect(response.body).toEqual(post);
    expect(postsClient.getPost).toHaveBeenCalledWith(1);
  });

  test.each(['/posts/0', '/posts/-1', '/posts/1.5', '/posts/not-a-number'])(
    'GET %s rejects an invalid identifier before the upstream boundary',
    async (path) => {
      const postsClient = {
        getPosts: jest.fn(),
        getPost: jest.fn(),
      };

      const response = await apiAgent(testApp(postsClient), { runId: 'invalid-id' })
        .get(path)
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'invalid_post_id',
          requestId: expect.any(String),
        })
      );
      expect(postsClient.getPost).not.toHaveBeenCalled();
    }
  );

  test.each([
    ['upstream_timeout', 504],
    ['upstream_unavailable', 502],
  ])('maps %s to a stable dependency error envelope', async (code, statusCode) => {
    const postsClient = {
      getPosts: jest.fn().mockRejectedValue(new UpstreamServiceError(code, statusCode)),
      getPost: jest.fn(),
    };
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await apiAgent(testApp(postsClient), { runId: code })
      .get('/posts')
      .expect(statusCode);

    expect(response.body).toEqual({
      error: code,
      requestId: expect.any(String),
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        code,
        statusCode,
        requestId: expect.any(String),
      })
    );

    log.mockRestore();
  });

  test('unexpected application failures remain internal server errors', async () => {
    const postsClient = {
      getPosts: jest.fn().mockRejectedValue(new Error('unexpected failure')),
      getPost: jest.fn(),
    };
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await apiAgent(testApp(postsClient), { runId: 'internal-error' })
      .get('/posts')
      .expect(500);

    expect(response.body).toEqual({
      error: 'internal_server_error',
      requestId: expect.any(String),
    });
    log.mockRestore();
  });
});
