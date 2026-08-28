# Architecture

## Test boundary

Supertest tests import the Express application directly. They do not start a TCP listener, which keeps the fast API gate deterministic and removes port allocation from the test lifecycle. Network-bound tests against external services belong in a separate integration layer.

## Layers

- **Routes/controllers** translate HTTP input/output.
- **Clients** encapsulate upstream HTTP dependencies.
- **Contracts** verify consumer/provider compatibility.
- **Testing helpers** standardize request correlation and test-only concerns.
- **Configuration** converts process environment into validated immutable values.

Test code should assert public behavior and avoid reaching into route implementation details.

## Request correlation

Every response carries `x-request-id`. Tests may provide one, otherwise middleware generates it. A run-level identifier plus request-level UUID makes concurrent failures traceable without sharing mutable global state.

## Error envelope

Unknown routes and unhandled errors return stable machine-readable envelopes. Internal stack traces and arbitrary exception messages are not returned to clients. Server logging should contain safe identifiers and error classification while excluding authorization headers and sensitive bodies.

## External dependencies

Upstream clients require explicit timeout budgets. Retries, if added, must be limited to transient failures and idempotent operations. A POST should not be retried automatically unless the API has a defined idempotency mechanism.

## Contract testing

Pact/contract tests are separate from route tests because their purpose is compatibility, not implementation coverage. Generated pacts are CI artifacts and should be published to a broker in environments that use provider verification.
