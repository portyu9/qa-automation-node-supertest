const axios = require('axios');

const DEFAULT_BASE_URL = 'https://jsonplaceholder.typicode.com';
const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * HTTP client for the upstream posts service.
 *
 * Keeping transport concerns here lets route tests replace the dependency
 * without network I/O while contract/integration tests exercise the real
 * HTTP boundary intentionally.
 */
class JsonPlaceholderClient {
  /**
   * @param {string} baseURL absolute upstream base URL
   * @param {{ timeoutMs?: number }} options transport options
   */
  constructor(baseURL = DEFAULT_BASE_URL, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('timeoutMs must be a positive integer');
    }

    this.client = axios.create({
      baseURL,
      timeout: timeoutMs,
    });
  }

  async getPosts() {
    return this.client.get('/posts');
  }

  async getPost(id) {
    return this.client.get(`/posts/${id}`);
  }
}

module.exports = JsonPlaceholderClient;
