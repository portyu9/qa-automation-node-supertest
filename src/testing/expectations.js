'use strict';

function expectJsonResponse(response) {
  const contentType = response.headers['content-type'] || '';
  if (!/application\/json/i.test(contentType)) {
    throw new Error(`expected JSON response but received content-type ${contentType || '<missing>'}`);
  }
}

function expectHeader(name, matcher) {
  const normalized = String(name).toLowerCase();
  return (response) => {
    const value = response.headers[normalized];
    if (value === undefined) {
      throw new Error(`expected response header ${normalized}`);
    }

    const matched =
      matcher instanceof RegExp ? matcher.test(String(value)) : String(value) === String(matcher);
    if (!matched) {
      throw new Error(`unexpected ${normalized} header value`);
    }
  };
}

function expectBody(predicate, message = 'response body contract failed') {
  if (typeof predicate !== 'function') throw new TypeError('body predicate must be a function');
  return (response) => {
    if (!predicate(response.body)) throw new Error(message);
  };
}

module.exports = {
  expectBody,
  expectHeader,
  expectJsonResponse,
};
