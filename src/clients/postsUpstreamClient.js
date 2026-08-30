'use strict';

const axios = require('axios');
const { normalizeAbsoluteHttpUrl } = require('../urlPolicy');
const { normalizeUpstreamError } = require('./upstreamError');

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Provider-neutral HTTP client for the upstream posts resource.
 *
 * The client never selects an upstream provider. Target ownership belongs to
 * validated runtime configuration or an explicitly injected test/contract URL.
 * Transport failures are normalized here so Express routes do not need Axios
 * knowledge and public error behavior remains stable if the HTTP library changes.
 */
class PostsUpstreamClient {
  constructor(baseURL, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('timeoutMs must be a positive integer');
    }

    this.client = axios.create({
      baseURL: normalizeAbsoluteHttpUrl(baseURL, 'baseURL'),
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

module.exports = PostsUpstreamClient;
