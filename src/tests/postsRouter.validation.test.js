const { positiveInteger } = require('../routes/posts');

describe('posts route identifier parser', () => {
  test.each([
    ['1', 1],
    ['42', 42],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('accepts %s as %p', (raw, expected) => {
    expect(positiveInteger(raw)).toBe(expected);
  });

  test.each(['0', '-1', '1.5', '1e3', ' 1', '1 ', '', '9007199254740992'])(
    'rejects %p',
    (raw) => {
      expect(positiveInteger(raw)).toBeNull();
    }
  );
});
