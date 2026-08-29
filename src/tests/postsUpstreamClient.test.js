jest.mock('axios', () => ({
  create: jest.fn(),
}));

const axios = require('axios');
const PostsUpstreamClient = require('../clients/postsUpstreamClient');

describe('PostsUpstreamClient transport contract', () => {
  beforeEach(() => {
    axios.create.mockReset();
  });

  test('applies the configured base URL and timeout to Axios', async () => {
    const transport = {
      get: jest.fn().mockResolvedValue({ data: [] }),
    };
    axios.create.mockReturnValue(transport);

    const client = new PostsUpstreamClient('https://api.example.test/', {
      timeoutMs: 2_500,
    });

    await client.getPosts();
    await client.getPost(42);

    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.example.test',
      timeout: 2_500,
    });
    expect(transport.get).toHaveBeenNthCalledWith(1, '/posts');
    expect(transport.get).toHaveBeenNthCalledWith(2, '/posts/42');
  });

  test.each([
    undefined,
    '',
    'localhost:8080',
    'ftp://example.test',
    'https://user:password@example.test',
    'https://example.test/api?token=secret',
    'https://example.test/api#fragment',
  ])('rejects unsafe or missing base URL %p before creating a transport', (baseURL) => {
    expect(() => new PostsUpstreamClient(baseURL)).toThrow('baseURL');
    expect(axios.create).not.toHaveBeenCalled();
  });

  test.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid timeout budget %p before creating a transport',
    (timeoutMs) => {
      expect(
        () => new PostsUpstreamClient('https://api.example.test', { timeoutMs })
      ).toThrow('timeoutMs must be a positive integer');
      expect(axios.create).not.toHaveBeenCalled();
    }
  );

  test.each([
    ['ECONNABORTED', 'upstream_timeout', 504],
    ['ETIMEDOUT', 'upstream_timeout', 504],
    ['ECONNRESET', 'upstream_unavailable', 502],
  ])('normalizes %s transport failures to %s', async (transportCode, publicCode, statusCode) => {
    const transport = {
      get: jest.fn().mockRejectedValue(Object.assign(new Error('transport failure'), { code: transportCode })),
    };
    axios.create.mockReturnValue(transport);

    const client = new PostsUpstreamClient('https://api.example.test');

    await expect(client.getPosts()).rejects.toMatchObject({
      name: 'UpstreamServiceError',
      publicCode,
      statusCode,
    });
  });
});
