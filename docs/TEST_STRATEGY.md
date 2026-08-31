# Test strategy

## Purpose

The suite is designed so request behavior, dependency transport, consumer contracts, packaged execution, and security controls can fail independently. Deterministic component tests are the primary service gate; live external availability is not required to prove route/error semantics.

## Layer model

| Layer | Runner | External network? | Primary concern |
| --- | --- | ---: | --- |
| Framework/unit | Jest | No | Configuration, validation helpers, client normalization |
| Component | Jest + Supertest | No | Express middleware/routes, envelopes, correlation, stateful protocol behavior |
| Transport contract | Jest with Axios double | No | Explicit base URL, timeout, resource mapping, normalized transport failures |
| Consumer contract | Pact | Local generated provider | Consumer/provider HTTP expectations |
| Packaged execution | Docker + `npm test` | No | Dockerfile build, non-root execution, writable test evidence |
| Repository security | CodeQL + Trivy | Tool registries only | SAST, dependency/configuration/secret risk |
| Container security | Docker + Trivy | Tool registries only | Vulnerability exposure in the built image |
| Dependency change | GitHub Dependency Review | GitHub service | Newly introduced dependency risk when Dependency graph is available |
| Live provider | Optional integration | Yes | Environment/provider compatibility |

## Configuration-negative tests

Runtime configuration must fail before server startup when inputs are missing or unsafe. Tests cover:

- missing `UPSTREAM_BASE_URL`;
- non-positive request timeout;
- non-absolute or hostless upstream URL;
- URL credentials;
- query-bearing upstream URL;
- fragment-bearing upstream URL;
- unsafe/overlong run correlation values.

The validated base URL may include a path prefix. Authentication must not be encoded in URL user-info. There is no implicit public-provider default.

`loadConfig(env)` accepts an injected environment map so these contracts do not mutate process-global state. The real server entry point uses `process.env` only when it owns runtime composition.

## Component-test rules

Component tests call `createApp({ postsClient })` directly with Supertest and inject a client double. They do not:

- bind a TCP port;
- load external runtime configuration;
- contact a real upstream provider;
- mock internal Express response objects;
- depend on test order.

This makes route validation, correlation, and error envelopes deterministic and fast.

## Stateful Supertest capability rules

`apiAgent()` is intentionally scoped per test/flow. It wraps a native `request.agent(app)` only to own cookie state, validated run correlation, and generic verb dispatch.

The capability suite proves that native chaining remains available for:

- query parameters and JSON bodies;
- request and response headers;
- `.expect(fn)` callbacks;
- cookie persistence across related requests;
- redirect following;
- `HEAD` and `OPTIONS` behavior.

Run and request identity remain separate: `x-test-run-id` is stable for the execution, while `x-request-id` is a fresh bounded UUID for each request. A global shared agent is prohibited because it would make cookies and transport state order-dependent.

## Transport-client rules

`PostsUpstreamClient` is provider-neutral and requires a target to be supplied explicitly. Its unit contract rejects missing/unsafe URLs before Axios transport is created, verifies timeout/base-URL/resource mapping, and proves normalization of transport failures.

Provider identity must never be encoded in the reusable client name or default constructor behavior. Environment selection belongs to server composition or an explicitly configured integration test.

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

Pact tests verify interactions the consumer expects from its provider. They use the same provider-neutral client against Pact's repository-controlled mock server, not a public service.

Keep Pact interactions minimal and semantically meaningful. A generated Pact file is an artifact for provider verification, not a substitute for deterministic service tests.

## Packaged execution strategy

The tracked root Dockerfile is validated in required CI rather than assumed correct because a source-level test passes.

The container gate must prove:

- the locked dependency graph installs with dependency lifecycle scripts disabled;

- the Dockerfile builds from the committed context;
- the image executes the repository's ordinary `npm test` entrypoint;
- tests run as the non-root `node` user;
- Pact evidence can be written without root privileges;
- `.dockerignore` prevents local `.env`, `node_modules`, reports, Pact output, Git metadata, logs, and editor state from entering the build context.

The security workflow separately scans the **built image** for fixed HIGH/CRITICAL vulnerabilities so a successful build is not mistaken for supply-chain safety.

Docker base-image updates are managed separately by Dependabot. Minor/patch maintenance stays within the supported Node major. Major Node runtime changes remain deliberate compatibility decisions even when their generated PR checks pass: the CI matrix, supported-runtime documentation, and packaged base must move together.

## Security strategy

Security signals remain independent from application-test retries and coverage:

- CodeQL performs JavaScript/TypeScript SAST with the extended query suite;
- Trivy scans the repository filesystem for fixed HIGH/CRITICAL dependency findings, supported HIGH/CRITICAL misconfiguration findings, and committed secret findings;
- Trivy scans the built application image for fixed HIGH/CRITICAL vulnerabilities in the packaged runtime/dependency surface;
- GitHub Dependency Review evaluates pull-request dependency deltas when the repository Dependency graph is available.

If GitHub Dependency graph is unavailable, the workflow must record that limitation. Repository and container-image Trivy scans remain required whole-repository controls, but they are not presented as equivalent to diff-aware Dependency Review.

## Coverage policy

Jest collects coverage from application/framework code while excluding the executable server edge and test/contract files where appropriate. Global thresholds are a floor, not a target: critical error/validation branches should be covered even if aggregate percentage would pass without them.

## Logging and evidence

Automatic server error logs are allowlisted and exclude bodies/authorization data. Test failures should first use Jest/Supertest assertion output and request/run correlation identifiers.

Do not make assertions against unstable raw exception text unless the text itself is a contract. Public API tests should prefer stable error codes/statuses.

Security evidence is retained separately from application evidence so vulnerability/configuration findings do not become mixed with behavioral test artifacts. Required CI rejects empty Jest, coverage, Pact, or listener evidence rather than treating artifact-upload success as proof of execution.

## Parallelism and lifecycle

In-process component tests avoid fixed ports and server-process cleanup, making them naturally safer for parallel execution. Client doubles and stateful agents are test-local.

Any future stateful database/cache dependency requires per-test or transaction-scoped isolation before concurrency is increased.

## Failure classification

| Failure class | First interpretation |
| --- | --- |
| Missing/unsafe runtime target | Configuration/ownership defect |
| Correlation-token rejection | Input/evidence identity contract |
| Component 4xx assertion | Request validation or route contract defect |
| Stateful agent/cookie/verb assertion | Supertest protocol-state contract |
| Component 502/504 assertion | Dependency-failure translation defect |
| Transport normalization | Client/library-boundary defect |
| Pact | Consumer/provider expectation mismatch |
| Container build/entrypoint | Packaging, permissions, dependency image, or test-runtime defect |
| Repository security | Source/dependency/configuration/secret risk |
| Container security | Base-image or packaged dependency vulnerability |
| Dependency Review | Newly introduced dependency risk or unavailable GitHub Dependency graph |
| Live provider | Environment/provider issue until deterministic layers disagree |
| Open-handle warning | Lifecycle cleanup defect |

## Exit criteria

A service/framework change is ready when:

- syntax checks pass across execution boundaries;
- Jest tests and coverage thresholds pass on supported Node versions;
- missing/unsafe configuration and correlation contracts pass without process-global mutation;
- every changed public failure classification has deterministic component coverage;
- stateful agent and native protocol-capability contracts pass;
- provider-neutral transport-client contracts pass;
- consumer contracts pass when changed;
- the tracked container builds and runs tests non-root;
- CodeQL, repository Trivy, and built-image Trivy gates pass;
- pull-request Dependency Review passes when GitHub Dependency graph is available, or its service limitation is explicitly recorded while independent Trivy gates remain successful;
- any Node major runtime change is reflected consistently in CI, container, and documentation rather than being adopted by an isolated image update;
- no live dependency is required for the ordinary component gate;
- server startup cannot silently select a public provider;
- logs/public responses remain free of raw secret-bearing dependency context;
- documentation reflects any changed boundary, support policy, or public error semantics.
