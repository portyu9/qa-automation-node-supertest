# Test strategy

## Purpose

The suite is designed so request behavior, dependency transport, and consumer contracts can fail independently. Deterministic component tests are the primary service gate; live external availability is not required to prove route/error semantics.

## Layer model

| Layer | Runner | External network? | Primary concern |
| --- | --- | ---: | --- |
| Framework/unit | Jest | No | Configuration, validation helpers, client normalization |
| Component | Jest + Supertest | No | Express middleware/routes, envelopes, correlation, failure translation |
| Transport contract | Jest with Axios double | No | Base URL, timeout, resource mapping, normalized transport failures |
| Consumer contract | Pact | Local generated provider | Consumer/provider HTTP expectations |
| Live provider | Optional integration | Yes | Environment/provider compatibility |

## Configuration-negative tests

Runtime configuration must fail before server startup when inputs are unsafe. Tests cover:

- non-positive request timeout;
- non-absolute upstream URL;
- URL credentials;
- query-bearing upstream URL;
- fragment-bearing upstream URL.

The validated base URL may include a path prefix. Authentication must not be encoded in URL user-info.

## Component-test rules

Component tests call the Express application directly with Supertest and inject a client double. They do not:

- bind a TCP port;
- contact the real upstream provider;
- mock internal Express response objects;
- depend on test order.

This makes route validation, correlation, and error envelopes deterministic and fast.

## Dependency-failure coverage

The public taxonomy is explicitly tested:

- timeout → HTTP 504 + `upstream_timeout`;
- other upstream transport failure → HTTP 502 + `upstream_unavailable`;
- unexpected application exception → HTTP 500 + `internal_server_error`.

Tests should assert both HTTP status and stable public code. They should also verify the response includes a request ID and does not expose the raw dependency error message.

Transport tests separately prove which raw codes are classified as timeout. If Axios changes an error shape, the normalization test should fail before public component semantics drift silently.

## Input-validation strategy

Invalid route identifiers are rejected before the client is called. Every boundary validation test should assert the dependency was not invoked. This protects both correctness and dependency capacity.

## Contract strategy

Pact tests verify interactions the consumer expects from its provider. They are useful for compatibility, not for Express route behavior or dependency-outage semantics.

Keep Pact interactions minimal and semantically meaningful. A generated Pact file is an artifact for provider verification, not a substitute for deterministic service tests.

## Coverage policy

Jest collects coverage from application/framework code while excluding the executable server edge and test/contract files where appropriate. Global thresholds are a floor, not a target: critical error/validation branches should be covered even if aggregate percentage would pass without them.

## Logging and evidence

Automatic server error logs are allowlisted and exclude bodies/authorization data. Test failures should first use Jest/Supertest assertion output and the request correlation ID.

Do not make assertions against unstable raw exception text unless the text itself is a contract. Public API tests should prefer stable error codes/statuses.

## Parallelism and lifecycle

In-process component tests avoid fixed ports and server-process cleanup, making them naturally safer for parallel execution. Client doubles are test-local.

Any future stateful database/cache dependency requires per-test or transaction-scoped isolation before concurrency is increased.

## Failure classification

| Failure class | First interpretation |
| --- | --- |
| Configuration | Runtime input/framework policy defect |
| Component 4xx assertion | Request validation or route contract defect |
| Component 502/504 assertion | Dependency-failure translation defect |
| Transport normalization | Client/library-boundary defect |
| Pact | Consumer/provider expectation mismatch |
| Live provider | Environment/provider issue until deterministic layers disagree |
| Open-handle warning | Lifecycle cleanup defect |

## Exit criteria

A service/framework change is ready when:

- syntax checks pass across execution boundaries;
- Jest tests and coverage thresholds pass on supported Node versions;
- configuration-negative contracts pass;
- every changed public failure classification has deterministic component coverage;
- consumer contracts pass when changed;
- no live dependency is required for the ordinary component gate;
- logs/public responses remain free of raw secret-bearing dependency context;
- documentation reflects any changed boundary or public error semantics.
