# Dependency Governance

Dependency updates use a two-plane model: Dependabot proposes changes; GitHub Actions independently decides whether a proposal is eligible for autonomous merge. The privileged governance workflow never checks out or executes the dependency pull-request head.

## Trust boundary

The governance workflow is intentionally triggered from trusted default-branch code for `pull_request_target`, completed qualification workflows, scheduled reconciliation, and explicit manual reconciliation. Its write-capable job checks out only the default branch with credential persistence disabled. Dependency code executes only in the repository's ordinary read-only pull-request workflows.

Autonomous merge therefore requires evidence from three independent layers:

1. **Provenance** — the pull request is authored by Dependabot, lives on a Dependabot branch in this repository, contains exactly one GitHub-verified Dependabot commit, has no merge commit, and that commit is based directly on the current `main` head. A repository kill switch, explicit manual-review labels, and a maximum PR age provide human-controlled circuit breakers.
2. **Semantic scope** — changed files belong to one allowlisted dependency ecosystem and satisfy ecosystem-specific invariants. Signed Dependabot commit metadata must describe only minor or patch updates.
3. **Exact-head qualification** — the current pull-request SHA must have successful `ci`, `extended`, `security`, and `docs` workflow runs, and each run must contain its expected stable gate job with a successful conclusion.

Immediately before merge, the bot repeats the complete assessment and submits the merge with the expected head SHA. A changed head, advanced base, failed gate, or policy drift invalidates the merge attempt. After a successful merge, it explicitly dispatches the repository's main qualification workflows. This avoids relying on push events emitted by a `GITHUB_TOKEN`-initiated merge and guarantees post-merge `main` requalification is requested. Dispatch results are recorded in the governance comment; any failed dispatch turns the governance run red after the merge so an operational requalification failure cannot be hidden.

## Autonomous policy

### npm

Minor and patch changes to direct dependencies may qualify when only `package.json` and `package-lock.json` change. The bot proves that non-dependency `package.json` fields are unchanged, the lockfile root agrees with the manifest, lockfile identity/format is stable, each direct change is represented in signed Dependabot metadata, and the update does not newly introduce an install lifecycle script in a changed lock entry.

Major updates, downgrades, prereleases, non-semver specifications, dependency additions/removals, lock-only updates that cannot be tied to a direct manifest change, and `0.x` minor transitions require human review.

### Docker

Only the allowlisted application builder/runtime image may be updated autonomously. The Dockerfile may change only on `FROM` lines; image identity must remain unchanged; the image must remain pinned by a complete SHA-256 digest; the platform tag suffix must stay on the same track; and the semantic version transition must be minor or patch. Major runtime changes and platform-track changes remain deliberate migrations.

### GitHub Actions

An autonomous Actions update must alter only exact `uses:` lines, preserve action identity, remain pinned to a full commit SHA, and carry a parseable version annotation whose transition is minor or patch. Coarse annotations such as a major-only comment can be accepted only when the GitHub-verified Dependabot commit independently classifies the update as minor or patch. Security and dependency-governance workflows are control-plane code and always require human review, even for otherwise routine action updates.

## Qualification gates

The policy does not infer safety from GitHub's generic `mergeable` flag. It resolves workflow runs for the exact pull-request head and requires the configured stable gates:

| Workflow | Stable gate |
| --- | --- |
| `ci` | `ci-gate` |
| `extended` | `extended-gate` |
| `security` | `security-gate` |
| `docs` | `readme-contract` |

This is deliberate because repository rules may protect `main` without encoding every workflow conclusion as a GitHub-required status check.

## Reconciliation and failure behavior

Every qualifying workflow completion re-evaluates the pull request. A scheduled API-only reconciliation also catches missed events without executing dependency code. Old pull requests age out of autonomous eligibility even if their base has not moved. Manual workflow dispatch can perform the same assessment and defaults to no merge unless merge permission is explicitly selected.

The bot maintains one idempotent pull-request status comment describing provenance, base freshness, update class, semantic scope, exact-head workflow state, and any reason autonomous merge is blocked. It fails closed: unknown structure, API ambiguity, stale base, unsigned or non-Dependabot history, excessive change scope, or an unrecognized update type always means no autonomous merge.

## Control-plane change policy

The governance policy, implementation, tests, and privileged workflow are themselves protected from autonomous dependency changes. Modifying this control plane requires normal human-reviewed repository change management and must pass the governance self-test plus the repository's standard CI/security/documentation workflows.

The intended operating principle is simple: automate repetitive maintenance, never automate uncertainty.
