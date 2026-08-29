const path = require('node:path');
const { Pact, Matchers, SpecificationVersion } = require('@pact-foundation/pact');
const PostsUpstreamClient = require('../clients/postsUpstreamClient');

const pact = new Pact({
  consumer: 'PostsConsumer',
  provider: 'PostsProvider',
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
  spec: SpecificationVersion.SPECIFICATION_VERSION_V4,
});

describe('Posts API consumer contract', () => {
  test('returns post 1 when it exists', async () => {
    await pact
      .addInteraction()
      .given('a post with id 1 exists')
      .uponReceiving('a request for post 1')
      .withRequest('GET', '/posts/1')
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json; charset=utf-8' });
        builder.jsonBody({
          id: 1,
          userId: Matchers.integer(1),
          title: Matchers.like('Sample title'),
          body: Matchers.like('Sample body text'),
        });
      })
      .executeTest(async (mockServer) => {
        const client = new PostsUpstreamClient(mockServer.url);
        const response = await client.getPost(1);

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(1);
      });
  });
});
