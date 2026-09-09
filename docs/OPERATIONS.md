# Operations Guide

## Purpose

This guide owns the detailed operating contract for the Node.js / Supertest API Quality Engineering Framework: local execution, runtime configuration, native Supertest protocol usage, stable failure taxonomy, correlation, listener/container evidence, dependency maintenance, and failure triage.

The main [`README.md`](../README.md) is intentionally concise. Deep application/transport ownership remains in [`ARCHITECTURE.md`](ARCHITECTURE.md), dependency ownership remains in [`DEPENDENCY_BOUNDARIES.md`](DEPENDENCY_BOUNDARIES.md), dependency governance remains in [`DEPENDENCY_GOVERNANCE.md`](DEPENDENCY_GOVERNANCE.md), and risk-based layer selection remains in [`TEST_STRATEGY.md`](TEST_STRATEGY.md).

## Local execution

```bash
npm install --global --ignore-scripts npm@11.19.1
npm ci --ignore-scripts
npm run check
npm run test:coverage
python .github/scripts/validate_readme.py
```

Exercise the real listener boundary without an external dependency:

```bash
npm run test:live-smoke
```

Start the real service only with an explicitly approved upstream:

```bash
UPSTREAM_BASE_URL=https://api.test.example.internal npm start
```

Ordinary component tests should not start `src/server.js`. Listener lifecycle and upstream availability are separate concerns.

## Command reference

| Command | Purpose |
| --- | --- |
| `npm run check` | Syntax-check execution boundaries and verify immutable workflow Action pins |
| `npm test` | Complete Jest suite |
| `npm run test:api` | Component/transport/framework tests, including native Supertest protocol contracts |
| `npm run test:contract` | Pact consumer contracts |
| `npm run test:coverage` | Full Jest suite with thresholds |
| `npm run test:live-smoke` | Real loopback TCP listener with injected dependency |
| `npm run workflow-pins:check` | Reject mutable external GitHub Action references |
| `npm start` | Intentional runtime listener; requires explicit upstream |

## Runtime configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Real listener port | `3000` |
| `UPSTREAM_BASE_URL` | Approved posts dependency | required |
| `REQUEST_TIMEOUT_MS` | Axios timeout | `8000` |
| `TEST_RUN_ID` | Correlation prefix | generated UUID |

`loadConfig(env)` accepts an injected environment map for deterministic tests and defaults to `process.env` only at the runtime edge. Missing/unsafe URLs, invalid ports, and invalid timeout budgets are configuration errors rather than retry candidates.

`UPSTREAM_BASE_URL` has no public fallback. It must be absolute HTTP(S), contain a hostname, use a valid explicit port when supplied, and contain no credentials, query, or fragment.

## Native Supertest protocol surface

`src/testing/apiAgent.js` builds on `request.agent(app)`, preserving Supertest's fluent request object while adding one stable framework concern: bounded request/run correlation.

`src/testing/expectations.js` supplies composable `.expect(fn)` contracts for JSON content type, exact/regex headers, and arbitrary body predicates. These augment rather than replace native `.expect()` chains.

`src/tests/supertestCapabilities.test.js` proves:

- agent-owned cookie persistence across related in-process requests;
- native `.query()` and `.send()` composition;
- request correlation as ordinary HTTP behavior;
- redirect following through `.redirects()`;
- `HEAD` and `OPTIONS` coverage alongside normal REST verbs;
- reusable expectation functions composed with native status/header/body assertions.

Stateful agents should be scoped to the smallest scenario that requires state. A global shared agent creates hidden order dependence.

## Stable public failure taxonomy

| Failure class | HTTP | Public `error` | Ownership |
| --- | ---: | --- | --- |
| Invalid post identifier | 400 | `invalid_post_id` | Input |
| Route missing | 404 | `not_found` | Routing |
| Dependency timeout | 504 | `upstream_timeout` | Upstream latency/transport |
| Dependency unavailable/reset | 502 | `upstream_unavailable` | Upstream availability/transport |
| Unknown application failure | 500 | `internal_server_error` | Application/unknown |

The public vocabulary is intentionally independent of Axios exception messages. Transport-library changes must not silently redefine the API contract.

## Request correlation

`requestContext` preserves inbound `x-request-id` only when it matches the bounded correlation-token policy. Unsafe or oversized values are replaced before they can be reflected into headers, envelopes, or shared diagnostics.

```text
TEST_RUN_ID
└── request ID
    ├── response x-request-id
    ├── error envelope requestId
    └── diagnostic metadata
```

Run identity groups an execution; request identity names one HTTP exchange. Neither is a carrier for credentials or business payloads.

## Deterministic listener and contract testing

`scripts/live-smoke.js` binds the real Express application to an ephemeral loopback port, injects a deterministic dependency client, verifies health/posts/validation/correlation, and closes the listener. No DNS, TLS, runtime upstream configuration, or public service is involved.

Pact is a distinct compatibility plane. A Pact failure represents consumer/provider contract drift; it is not a reason to weaken component assertions or add retries.

## Evidence and security

Shared diagnostics retain bounded metadata such as request ID, public error code/status, and error class. Authorization values, cookies, request bodies, upstream bodies, and raw Axios configuration are excluded.

CI treats execution evidence semantically:

- the Jest gate derives executed tests from passed plus failed counts so pending/todo cases do not inflate proof;
- at least 60 tests must actually execute;
- coverage must be measured;
- Pact interactions must be non-empty;
- listener evidence must represent a real loopback execution;
- stable aggregate gates collapse matrix detail into durable conclusions.

Security controls remain separate:

- CodeQL JavaScript/TypeScript SAST;
- npm HIGH/CRITICAL advisory scanning of the committed lock graph;
- Trivy repository dependency/configuration/secret scanning;
- Trivy built-container-image scanning;
- pull-request Dependency Review when GitHub Dependency graph is available.

These controls inspect different risk planes and should not be treated as interchangeable.

## Confidence boundaries

| Signal | Confidence gained | Deliberate limit |
| --- | --- | --- |
| In-process Supertest component tests | Express routing, middleware, validation, response envelopes, and injected dependency behavior execute through the real application object | No TCP listener, DNS, TLS, proxy, or deployed-network behavior |
| Stateful `request.agent(app)` contracts | Cookie/session continuity and native Supertest request composition work for explicitly owned state | Does not prove an external identity system and must not become global state |
| Injected/mocked Axios transport tests | Timeout, target validation, error normalization, and public failure mapping are deterministic | Proves client policy, not real upstream availability/behavior |
| Pact consumer contracts | Consumer-required interactions remain machine-readable and executable | Does not prove a live provider deployment currently satisfies them unless provider verification runs |
| Loopback listener smoke | Real Node listener startup, socket HTTP serialization, middleware/correlation, and shutdown work | Does not exercise public DNS, TLS termination, ingress, service mesh, or remote infrastructure |
| Packaged-runtime/container gate | The app builds and executes in its governed packaging boundary | Does not prove production orchestration, autoscaling, networking, or environment configuration |
| JUnit/coverage/Pact/listener evidence | CI proves intended suites actually executed and produced attributable evidence | Artifact presence alone is insufficient; semantic counts and conclusions remain authoritative |
| CodeQL / npm Audit / Trivy / Dependency Review | Independent controls inspect source, advisory, repository, image, and dependency-diff risk | Scanner success is scoped evidence, not proof of vulnerability absence |

Prefer the cheapest boundary that introduces exactly the semantics under test.

## Dependency maintenance

Dependabot maintains **npm**, **Docker**, and **GitHub Actions**.

- updates run weekly Monday at 09:00 America/New_York;
- routine npm minor/patch updates are grouped;
- npm major upgrades remain standalone for attributable Express/Jest/Axios/Pact review;
- Docker minor/patch updates maintain the digest-pinned Node image within the supported major;
- Node base-image major updates remain outside scheduled maintenance until the support matrix intentionally expands;
- Actions are executable supply-chain dependencies and repository checks reject mutable workflow refs;
- dependency PRs are evaluated by component, contract, listener, container, security, and docs workflows as applicable.

Automation proposes changes; support-policy fit, test evidence, and release-impact review decide whether they are safe.

## Failure triage

| Signal | First interpretation |
| --- | --- |
| Component failure | Express/application contract |
| Agent/cookie mismatch | Stateful in-process HTTP contract |
| Query/body/header/redirect mismatch | Native Supertest protocol composition |
| Transport unit failure | Client policy/error normalization |
| Pact failure | Consumer/provider compatibility |
| Listener-only failure | TCP/runtime/serialization lifecycle |
| Container build/entrypoint | Packaging/runtime compatibility |
| npm advisory gate | Committed dependency-graph vulnerability |
| Container security | Base-image or packaged dependency vulnerability |
| `502` / `504` contract mismatch | Dependency failure semantics |
| External-target-only failure | Environment/dependency integration |
| Security/docs | Independent repository governance |

## Explicit anti-patterns

- starting a real listener for every Supertest case;
- global/shared `request.agent()` state across unrelated tests;
- wrapping Supertest until native request/response semantics disappear;
- routes importing Axios directly;
- public provider defaults;
- leaking Axios error strings into public error contracts;
- broad retries around application assertions;
- unbounded caller-controlled correlation IDs;
- request/auth/upstream payloads in global logs;
- interpreting Pact as a replacement for component behavior tests.

## Related documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — application, transport, listener, container, and evidence boundaries.
- [`DEPENDENCY_BOUNDARIES.md`](DEPENDENCY_BOUNDARIES.md) — deterministic component, transport, contract, and live-integration ownership.
- [`DEPENDENCY_GOVERNANCE.md`](DEPENDENCY_GOVERNANCE.md) — governed dependency qualification and control-plane safety model.
- [`TEST_STRATEGY.md`](TEST_STRATEGY.md) — risk-based layer selection and exit criteria.

A strong Supertest framework makes the failed boundary obvious: application behavior, stateful in-process HTTP semantics, input policy, transport normalization, compatibility, listener runtime, packaged runtime, or explicit external dependency.
