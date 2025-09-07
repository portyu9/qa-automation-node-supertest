## API Testing Framework – SuperTest, Jest & Pact

I created this API‑testing repository to demonstrate a practical, production‑ready way of testing service‑layer APIs using JavaScript.  The project is built on top of **Node.js**, **Express**, **SuperTest**, **Jest**, and **Pact**, and it uses a public API (JSONPlaceholder) to give the tests a real target.  Everything is designed around separation of concerns: there is a minimal HTTP server, a service client for the upstream API, a set of tests grouped by feature, and contract tests that validate payload structure with GitHub Actions CI.

### Key Features

* **Clean project structure** – source code sits under `src/` and tests live in `src/tests/` and `src/contracts/`.  I keep configuration in its own folder and avoid mixing responsibilities.
* **Service‑layer abstraction** – `JsonPlaceholderClient` encapsulates HTTP calls to the public JSONPlaceholder API.  This hides URL details from the rest of the code and makes it easy to swap implementations or inject mocks for unit tests.
* **Express server** – `app.js` defines routes that proxy to the upstream API.  Running `npm start` spins up a local server, but tests run directly against the Express app without listening on a port.
* **SuperTest integration tests** – the Jest test suite uses SuperTest to exercise the Express routes.  SuperTest allows me to simulate HTTP requests and assert on the responses without running a browser or an external client.
* **Consumer‑driven contract tests** – Pact verifies that my API returns responses that conform to the expected contract.  This is particularly useful when collaborating with downstream consumers; you can generate pacts from these tests and share them with providers.
* **Postman collection** – there’s a small Postman collection in the `postman/` folder that you can import to manually explore the endpoints.  You can also use Newman to run these as part of a pipeline.
* **CI ready** – a GitHub Actions workflow installs dependencies and runs both unit and contract tests on every push.  You can extend this further by publishing Pact files or integrating with Pact Broker.

### Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the server locally**

   ```bash
   npm start
   ```

   The server will start on `http://localhost:3000` by default.  It proxies `/posts` and `/posts/:id` to the JSONPlaceholder API.

3. **Run tests**

   ```bash
   npm test
   ```

   This runs the Jest test suite, which includes both the SuperTest integration tests and the Pact contract tests.

4. **Run Postman collection** (optional)

   Install [Newman](https://github.com/postmanlabs/newman) globally and run:

   ```bash
   newman run postman/posts_collection.json
   ```

### Project Structure

```
qa-api-supertest/
├── README.md                # This file
├── package.json             # NPM dependencies and scripts
├── jest.config.js           # Jest configuration
├── .gitignore               # Node build artifacts
├── Dockerfile               # Container to run the app and tests
├── postman/
│   └── posts_collection.json  # Example Postman collection
├── src/
│   ├── app.js               # Express application with routes
│   ├── server.js            # Application entry point
│   ├── clients/
│   │   └── jsonPlaceholderClient.js  # Service client for JSONPlaceholder
│   ├── routes/
│   │   └── posts.js         # Express router for posts
│   ├── tests/
│   │   └── posts.test.js    # SuperTest integration tests
│   └── contracts/
│       └── posts.contract.test.js  # Pact consumer contract tests
└── .github/workflows/ci.yml # GitHub Actions pipeline
```

### Extensibility

This starter is intentionally small but extensible.  I have shown how to decouple HTTP clients, how to write tests that don’t depend on a running server, and how to verify response contracts.  Feel free to add more endpoints, mock services (for example using [Mock Service Worker](https://mswjs.io) or WireMock), or even a database layer.  You could also extend the Pact configuration to publish pacts to a broker and have provider tests verify them.
