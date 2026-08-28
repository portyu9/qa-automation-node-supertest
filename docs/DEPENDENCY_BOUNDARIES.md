# Dependency-boundary testing

## Component boundary

Supertest component tests exercise the Express request/response pipeline in-process and inject an upstream client double. They must not depend on DNS, public APIs, fixed ports, or external service availability.

The injected double is intentionally defined at the client boundary (`getPosts()` / `getPost(id)`) rather than by mocking Express internals. This keeps route tests focused on HTTP input validation, status codes, response envelopes, correlation IDs, and dependency-failure translation.

## Transport boundary

`JsonPlaceholderClient` owns outbound HTTP transport configuration. Its unit contract verifies that the validated base URL and timeout budget are passed to Axios and that logical client operations map to the expected resource paths.

## Consumer-contract boundary

Pact tests exercise the real client implementation against Pact's generated mock server. They verify the consumer's HTTP expectations without contacting the public provider. Generated pact files are artifacts for provider verification and are not substitutes for route/component tests.

## Live integration boundary

A live-provider integration test, when required, belongs in a separate opt-in CI job with an explicitly configured environment. It should have bounded timeouts, clear ownership, and failure semantics that distinguish provider availability from consumer implementation defects.
