# Dependency-boundary testing

## Boundary map

The framework distinguishes four dependency surfaces so failures are attributable rather than collapsed into one integration test.

| Boundary | What is real | What is substituted | Primary assertions |
| --- | --- | --- | --- |
| Component | Express middleware/routes | Upstream client | HTTP validation, envelopes, correlation, error translation |
| Transport | `PostsUpstreamClient` | Axios transport in unit tests | Explicit base URL, timeout, resource paths, error normalization |
| Consumer contract | Real client HTTP behavior | Pact mock provider | Consumer/provider interaction expectations |
| Live integration | Real client + provider | Nothing | Environment/provider compatibility; opt-in only |

## Component boundary

Supertest component tests exercise the Express request/response pipeline in-process and inject an upstream client double. They must not depend on DNS, public APIs, fixed ports, or external service availability.

The injected double is defined at the client boundary (`getPosts()` / `getPost(id)`) rather than by mocking Express internals. Route tests can therefore prove:

- path/input validation;
- status and JSON envelope semantics;
- inbound request correlation;
- whether an invalid request was rejected before dependency invocation;
- dependency-failure translation.

Application construction with an injected client does not require runtime upstream configuration. This keeps the deterministic component boundary independent of environment ownership.

## Transport boundary

`PostsUpstreamClient` owns outbound HTTP transport configuration but never chooses a provider. Its contract verifies that an explicitly supplied, validated base URL and timeout budget reach Axios and that logical operations map to expected resource paths.

The client rejects missing, non-HTTP(S), credential-bearing, query-bearing, and fragment-bearing URLs before creating transport. Raw Axios failures are normalized immediately. Routes should not branch on Axios-specific error structures.

## Runtime target boundary

`src/server.js` owns real runtime composition. `loadConfig()` requires `UPSTREAM_BASE_URL`; there is no silent public-provider fallback. Missing target ownership therefore fails before the server binds its TCP port.

Configuration contracts call `loadConfig(env)` with an injected read-only map so invalid inputs can be tested without mutating process-global environment state.

## Stable dependency-error taxonomy

The public API uses three distinct server/dependency failure classes:

| Condition | Public HTTP status | Public error code | Meaning |
| --- | ---: | --- | --- |
| Upstream timeout (`ECONNABORTED`, `ETIMEDOUT`) | 504 | `upstream_timeout` | Dependency did not complete within the client timeout budget |
| Other upstream transport failure | 502 | `upstream_unavailable` | Dependency could not be reached/used, but this is not classified as timeout |
| Unexpected application exception | 500 | `internal_server_error` | Failure is not a normalized upstream transport condition |

This distinction is part of the API contract and has deterministic component/transport tests.

### What remains internal

The underlying transport exception is retained as the JavaScript `cause` on `UpstreamServiceError` for debugging. It is not serialized into the public response.

Safe server logs include a small allowlist: request ID, error class, public code, and status. They intentionally exclude:

- request/response bodies;
- authorization headers;
- cookies;
- upstream URLs containing runtime credentials;
- raw upstream exception messages.

The response envelope remains stable even when the dependency library changes.

## Consumer-contract boundary

Pact tests exercise the real client implementation against Pact's generated mock server. They verify the consumer's HTTP expectations without contacting a public provider. Generated Pact files are reviewable provider-verification artifacts and are not substitutes for route/component tests.

A Pact mismatch answers a different question from a 502/504 component test: Pact describes the expected interaction, while component tests describe how this service behaves when its dependency succeeds or fails.

## Live integration boundary

A live-provider integration test, when required, belongs in a separate opt-in CI job with an explicitly configured environment. It should have bounded timeouts, clear ownership, and failure semantics that distinguish provider availability from consumer implementation defects.

Live-provider failures should not weaken deterministic component assertions. If a provider is temporarily unavailable, that is an environment/dependency signal, not a reason to accept an incorrect public error mapping.

## Adding a dependency

When a new external dependency is introduced:

1. define an application-facing client interface/shape;
2. inject it into component composition;
3. test route behavior with a deterministic double;
4. require explicit runtime target ownership;
5. centralize transport configuration in the concrete client;
6. define a stable public error taxonomy before exposing raw library errors;
7. retain detailed cause information internally only;
8. add contract/live layers only where they answer a distinct integration question.
