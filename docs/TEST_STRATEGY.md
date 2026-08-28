# API test strategy

## Coverage model

For each endpoint, cover successful behavior plus representative validation, authentication/authorization, not-found, conflict/idempotency, malformed input, and dependency-failure cases where applicable. Choose equivalence classes and risk boundaries rather than enumerating every possible payload.

## Assertion depth

Status-only tests provide weak signal. Assertions should cover response headers, content type, stable error envelopes, important field semantics, and side effects. Schema/contract validation supplements these assertions but does not replace them.

## Isolation

Import the app directly for component-level HTTP tests. Avoid fixed ports and background servers. Tests that create persistent state must own cleanup and unique identifiers. Do not depend on test execution order.

## Mocks and stubs

Mock an upstream dependency at its boundary, not internal functions across the codebase. A useful stub also verifies the outgoing request contract so it cannot silently hide client drift.

## Failure injection

Exercise upstream timeout, 4xx, 5xx, malformed response, and connection failure paths. The framework should demonstrate that failures are translated consistently and do not leak secrets or internal details.

## Contract gates

Consumer contracts should be versioned with the consumer and verified against providers before release. Contract failures are compatibility failures, distinct from code coverage or route-test failures.

## Performance and security

Supertest component tests are not load tests. Use a dedicated load tool for concurrency/latency SLOs. Security checks should include authorization boundaries and input handling here, with active scanning isolated into an authorized security pipeline.
