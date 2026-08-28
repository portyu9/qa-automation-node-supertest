jest.mock('axios', () => ({
  create: jest.fn(),
}));

const axios = require('axios');
const JsonPlaceholderClient = require('../clients/jsonPlaceholderClient');

describe('JsonPlaceholderClient transport contract', () => {
  beforeEach(() => {
    axios.create.mockReset();
  });

  test('applies the configured base URL and timeout to Axios', async () => {
    const transport = {
      get: jest.fn().mockResolvedValue({ data: [] }),
    };
    axios.create.mockReturnValue(transport);

    const client = new JsonPlaceholderClient('https://api.example.test', {
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

  test.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid timeout budget %p before creating a transport',
    (timeoutMs) => {
      expect(
        () => new JsonPlaceholderClient('https://api.example.test', { timeoutMs })
      ).toThrow('timeoutMs must be a positive integer');
      expect(axios.create).not.toHaveBeenCalled();
    }
  );
});
