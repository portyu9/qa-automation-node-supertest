const path = require('path');
const { Pact, Matchers } = require('@pact-foundation/pact');
const axios = require('axios');

// This contract test uses Pact to define the expected interaction between a
// consumer and a provider for the Posts API.  It spins up a mock provider,
// registers an interaction, performs the request, and then verifies that
// the provider returned the expected payload.  The resulting pact file will
// be written into the `.pact` directory when the test runs.

describe('Pact contract for Posts API', () => {
  const provider = new Pact({
    consumer: 'PostsConsumer',
    provider: 'PostsProvider',
    port: 1234,
    log: path.resolve(process.cwd(), 'logs', 'pact.log'),
    dir: path.resolve(process.cwd(), '.pact'),
    logLevel: 'warn'
  });

  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  test('GET /posts/1 conforms to contract', async () => {
    await provider.addInteraction({
      state: 'a post with id 1 exists',
      uponReceiving: 'a request for post 1',
      withRequest: {
        method: 'GET',
        path: '/posts/1'
      },
      willRespondWith: {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: {
          id: 1,
          userId: Matchers.integer(1),
          title: Matchers.like('Sample title'),
          body: Matchers.like('Sample body text')
        }
      }
    });

    const response = await axios.get(`http://localhost:${provider.opts.port}/posts/1`);
    expect(response.status).toBe(200);
    expect(response.data.id).toBe(1);
    await provider.verify();
  });
});
