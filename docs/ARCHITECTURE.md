# Architecture

## Design objective

The framework separates HTTP application behavior from outbound dependency transport. Supertest exercises Express in-process; the upstream client owns Axios configuration; Pact owns consumer interaction contracts. Each boundary can fail independently and should produce an attributable signal.

```mermaid
flowchart LR
    T[Supertest component tests] --> APP[Express application]
    APP --> R[Posts router]
    R --> C[Injected posts client]
    PROD[Server composition] --> CFG[Validated runtime config]
    CFG --> APP
    PROD --> HC[PostsUpstreamClient]
    HC --> AX[Axios transport]
    P[Pact tests] --> HC
    APP --> ERR[Stable error middleware]
```

## Composition and dependency injection

`createApp({ postsClient, config })` is the composition seam for deterministic component tests. Tests inject a client double at the application-facing dependency boundary; they do not mock Express internals or open a TCP listener. When a client is injected, application construction does not read runtime environment configuration.

`src/server.js` owns production/server composition. It loads validated runtime configuration and then constructs the provider-neutral `PostsUpstreamClient`. This keeps target selection at the executable boundary rather than hiding a provider choice inside reusable application or client code.

## Configuration boundary

`src/config.js` validates runtime inputs before server startup. `loadConfig(env)` accepts an injected read-only environment map for deterministic configuration contracts and defaults to `process.env` only at the real runtime boundary.

`UPSTREAM_BASE_URL` is required. It must be an absolute HTTP(S) URL without credentials, query strings, or fragments. Optional path prefixes remain valid. Request timeout and port values must be positive integers. Run IDs are generated when not explicitly supplied.

There is no public-provider fallback. Missing upstream ownership is a configuration error before the server binds a port or Axios opens transport.

The framework does not encode credentials in upstream URLs. Authentication, if added later, belongs in a controlled transport-header/interceptor policy.

## Request correlation

`requestContext` establishes one request ID for each inbound request and returns it in `x-request-id` as well as stable JSON error envelopes. Test helpers can inject a run correlation header independently.

Request IDs are useful for one HTTP exchange; run IDs group a test execution. Do not collapse them into a single identifier because they have different cardinality and ownership.

## Upstream transport boundary

`PostsUpstreamClient` owns:

- validation of explicitly supplied upstream base URLs;
- bounded Axios timeout;
- mapping logical operations to resource paths;
- normalization of raw transport failures into `UpstreamServiceError`.

Routes consume client methods, not Axios objects. This keeps route tests independent of DNS/network availability and gives transport tests a small surface to verify.

## Stable failure taxonomy

The client/error middleware exposes a deliberate public taxonomy:

| Internal class | HTTP status | Public error code |
| --- | ---: | --- |
| Upstream timeout (`ECONNABORTED`, `ETIMEDOUT`) | 504 | `upstream_timeout` |
| Other upstream transport failure | 502 | `upstream_unavailable` |
| Unexpected application failure | 500 | `internal_server_error` |

The original cause remains available internally through the error cause chain. Public responses do not expose dependency exception messages, stack traces, URLs, or credentials.

Safe error logs contain only allowlisted fields such as request ID, error class, stable public code, and status. Request bodies and authorization headers are intentionally excluded.

## Input validation

Route parameters are validated before the upstream client is called. Invalid post identifiers return a stable 400 envelope and never consume dependency capacity.

Validation belongs at the boundary that owns the input. A transport client should not be required to understand Express path strings.

## Contract boundary

Pact tests execute the real provider-neutral consumer client against Pact's generated provider substitute. They verify HTTP expectations without contacting a live external provider.

Pact does not replace component tests: component tests validate Express routing/envelopes, while Pact validates the consumer's outbound interaction contract.

## Server lifecycle

`src/server.js` is the real TCP-hosting edge. It is the only ordinary path that requires an external upstream target. Most tests call `createApp()` with an injected client rather than spawning the server. This avoids fixed-port conflicts, public-network coupling, slow startup, and open-handle leaks in the ordinary test suite.

Graceful SIGTERM/SIGINT behavior belongs to the server lifecycle, not route tests.

## Extension rules

New behavior should preserve these boundaries:

- require explicit external-target ownership before server startup;
- validate runtime configuration before transport or listener side effects;
- inject external dependencies at client/domain seams;
- test routes in-process with Supertest;
- normalize transport implementation details before they reach public error responses;
- keep public error codes/statuses stable and documented;
- avoid logging bodies, auth headers, or raw dependency messages;
- add a deterministic test for every new failure classification;
- use Pact only for consumer/provider expectations, not as a substitute for component behavior tests.
