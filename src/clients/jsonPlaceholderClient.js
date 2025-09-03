const axios = require('axios');

/**
 * JsonPlaceholderClient encapsulates calls to the JSONPlaceholder public API.
 *
 * Creating a dedicated client class makes it easy to swap the underlying
 * implementation (for example to use a different HTTP library), to inject
 * authentication headers, or to mock the calls in unit tests.  The default
 * base URL points at the free JSONPlaceholder service.
 */
class JsonPlaceholderClient {
  /**
   * Construct a new client with an optional base URL.  Consumers can pass
   * `baseURL` to override the default host (useful for testing against a
   * different environment or when mocking with tools like WireMock).
   *
   * @param {string} baseURL - Base URL for the API (default: JSONPlaceholder)
   */
  constructor(baseURL = 'https://jsonplaceholder.typicode.com') {
    this.baseURL = baseURL;
    this.client = axios.create({ baseURL });
  }

  /**
   * Fetch all posts.
   *
   * @returns {Promise<import('axios').AxiosResponse>} Axios response with array of posts
   */
  async getPosts() {
    return this.client.get('/posts');
  }

  /**
   * Fetch a single post by its identifier.
   *
   * @param {number|string} id - Identifier of the post
   * @returns {Promise<import('axios').AxiosResponse>} Axios response with the post
   */
  async getPost(id) {
    return this.client.get(`/posts/${id}`);
  }
}

module.exports = JsonPlaceholderClient;
