'use strict';

const axios = require('axios');
const { normalizeUpstreamError } = require('./upstreamError');

const DEFAULT_TIMEOUT_MS = 8_000;

function validateBaseUrl(baseURL) {
  if (typeof baseURL !== 'string' || !baseURL.trim()) {
    throw new Error('baseURL is required');
  }

  let parsed;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new Error('baseURL must be an absolute URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('baseURL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('baseURL must not contain URL credentials');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('baseURL must not contain a query string or fragment');
  }

  return baseURL.replace(/\/$/, '');
}

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
      baseURL: validateBaseUrl(baseURL),
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
