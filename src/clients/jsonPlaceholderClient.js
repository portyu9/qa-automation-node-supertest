'use strict';

const axios = require('axios');
const { normalizeUpstreamError } = require('./upstreamError');

const DEFAULT_BASE_URL = 'https://jsonplaceholder.typicode.com';
const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * HTTP client for the upstream posts service.
 *
 * Transport failures are normalized here so Express routes do not need Axios
 * knowledge and public error behavior remains stable if the HTTP library changes.
 */
class JsonPlaceholderClient {
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
    return this.#get('/posts');
  }

  async getPost(id) {
    return this.#get(`/posts/${id}`);
  }

  async #get(path) {
    try {
      return await this.client.get(path);
    } catch (error) {
      throw normalizeUpstreamError(error);
    }
  }
}

module.exports = JsonPlaceholderClient;
