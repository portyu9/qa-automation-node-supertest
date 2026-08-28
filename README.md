# Node.js / Supertest API Test Framework

A Node.js API automation framework using Supertest, Jest, Express, and Pact-style contract testing. Fast component tests import the Express application directly, while configuration, correlation IDs, external clients, and contract concerns remain separated from test assertions.

## Design principles

- no TCP listener required for fast Supertest component tests;
- validated environment configuration before server startup;
- unique request IDs for parallel diagnostics;
- stable JSON error envelopes;
- coverage thresholds as a regression signal, not a substitute for behavioral assertions;
- consumer contracts kept distinct from implementation tests;
- test data and state owned by the test that creates them;
- external service calls use explicit timeout budgets;
- CI executes supported Node versions and retains evidence.

## Structure

```text
.
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config.js
│   ├── middleware/requestContext.js
│   ├── testing/apiAgent.js
│   ├── clients/
│   ├── contracts/
│   ├── routes/
│   └── tests/
├── postman/
├── docs/
├── jest.config.js
└── .github/workflows/ci.yml
```

## Installation

Node.js 22+ is required.

```bash
npm ci
```

`package-lock.json` is committed and CI uses `npm ci` so dependency resolution is reproducible. Use `npm install` only when intentionally changing dependencies, review the resulting lockfile diff, and commit the manifest and lockfile together.

## Commands

```bash
npm test                 # full Jest suite
npm run test:api         # API/component tests
npm run test:contract    # contract tests
npm run test:coverage    # suite with coverage thresholds
npm run check            # syntax/configuration sanity checks
npm start                # start the sample Express application
```

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | local server port | `3000` |
| `UPSTREAM_BASE_URL` | external service endpoint | JSONPlaceholder |
| `REQUEST_TIMEOUT_MS` | upstream request timeout budget | `8000` |
| `TEST_RUN_ID` | correlation prefix for test requests | generated UUID |

`.env.example` contains non-secret examples only. Credentials, API tokens, and broker secrets belong in CI/secret-management systems.

## Supertest usage

Prefer importing `src/app.js` directly:

```js
const app = require('./src/app');
const { apiAgent } = require('./src/testing/apiAgent');

const response = await apiAgent(app)
  .get('/health')
  .expect(200)
  .expect('content-type', /json/);
```

The helper adds a unique `x-request-id` while preserving Supertest's fluent assertion API. Avoid generic wrappers that obscure requests or make failures harder to read.

## API assertion policy

A meaningful test normally verifies more than status code: content type, headers/correlation, response shape, critical values, and observable side effects. Negative tests should verify the stable error contract, not implementation-specific exception text.

## External clients

Keep upstream calls in `src/clients`. Give every request a timeout. Retries must be intentionally limited to safe methods/transient failures; never retry mutating operations blindly. Tests should replace upstream dependencies at their boundary when deterministic failure injection is required.

## Contract testing

Contract tests answer a different question from route tests: whether independently deployed consumer/provider versions remain compatible. Generated pact files are build artifacts. In a multi-service environment they should be published and provider-verified as part of release promotion.

## Coverage

Jest collects branch/function/line/statement coverage with explicit minimums. Coverage is a change detector; high percentages do not prove meaningful assertions. Prefer behavior coverage and important failure paths over lines executed incidentally.

## CI

GitHub Actions executes Node 22 and 24, runs syntax checks and coverage tests, and publishes coverage/Pact artifacts even when a test fails. Dependency updates for npm and Actions are managed by Dependabot.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/TEST_STRATEGY.md`](docs/TEST_STRATEGY.md), and [`docs/DEPENDENCY_BOUNDARIES.md`](docs/DEPENDENCY_BOUNDARIES.md) for component boundaries, API-test governance, and upstream isolation policy.
