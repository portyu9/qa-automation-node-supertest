'use strict';

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

class UpstreamServiceError extends Error {
  constructor(publicCode, statusCode, cause) {
    super(publicCode, { cause });
    this.name = 'UpstreamServiceError';
    this.publicCode = publicCode;
    this.statusCode = statusCode;
  }
}

function normalizeUpstreamError(error) {
  if (error instanceof UpstreamServiceError) return error;

  if (TIMEOUT_CODES.has(error?.code)) {
    return new UpstreamServiceError('upstream_timeout', 504, error);
  }

  return new UpstreamServiceError('upstream_unavailable', 502, error);
}

module.exports = { UpstreamServiceError, normalizeUpstreamError };
