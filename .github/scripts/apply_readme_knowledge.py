from pathlib import Path
import re

path = Path('README.md')
text = path.read_text(encoding='utf-8')
marker = '## Dependency maintenance\n'
section = '''## Confidence boundaries

The framework deliberately separates failure domains because the same HTTP-looking assertion can prove very different things depending on where it executes.

| Signal | Confidence gained | Deliberate limit |
| --- | --- | --- |
| In-process Supertest component tests | Express routing, middleware, validation, response envelopes, and injected dependency behavior execute through the real application object | No TCP listener, DNS, TLS, proxy, or deployed-network behavior is involved |
| Stateful `request.agent(app)` contracts | Cookie/session continuity and native Supertest request composition work for the scenario that explicitly owns state | A shared/global agent would create order dependence; these tests do not prove an external identity system |
| Injected/mocked Axios transport tests | Timeout, target validation, error normalization, and public failure mapping are deterministic | They prove client policy, not the availability or behavior of a real upstream service |
| Pact consumer contracts | Consumer-required interactions and payload expectations remain machine-readable and executable | A passing consumer contract does not prove a provider deployment currently satisfies it unless provider verification is also executed |
| Loopback listener smoke | Real Node listener startup, socket HTTP serialization, middleware/correlation, and shutdown work without an external dependency | Loopback does not exercise public DNS, TLS termination, ingress, service mesh, or remote infrastructure |
| Packaged-runtime/container gate | The application can be built and exercised in its governed runtime packaging boundary | It does not prove a production orchestrator, autoscaling, networking, or environment configuration |
| JUnit/coverage/Pact/listener evidence | CI proves intended suites actually executed and produced semantically attributable evidence | Artifact presence alone is not proof; execution counts, identities, and conclusions remain authoritative |
| CodeQL / npm Audit / Trivy / dependency review | Independent controls inspect source, advisory, repository, image, and dependency-diff risk planes | Scanner success is scoped evidence, not proof that vulnerabilities are absent |

Prefer the **cheapest boundary that introduces the semantics under test**. Adding sockets, contracts, containers, or deployed infrastructure is useful only when those boundaries are part of the requirement being proven.

'''
if '## Confidence boundaries\n' not in text:
    if marker not in text:
        raise SystemExit('Dependency maintenance marker missing')
    text = text.replace(marker, section + marker)
path.write_text(text, encoding='utf-8')

patterns = [
    re.compile(r'\bNode(?:\.js)?\s+\d', re.I),
    re.compile(r'\bExpress\s+\d', re.I),
    re.compile(r'\bSupertest\s+\d', re.I),
    re.compile(r'\bJest\s+\d', re.I),
    re.compile(r'\bAxios\s+\d', re.I),
    re.compile(r'\bPact\s+v?\d', re.I),
    re.compile(r'\bnpm\s+v?\d', re.I),
    re.compile(r'\bnode:\d', re.I),
]
candidates = []
for md in [Path('README.md'), *Path('docs').rglob('*.md')]:
    for number, line in enumerate(md.read_text(encoding='utf-8').splitlines(), 1):
        if any(pattern.search(line) for pattern in patterns):
            candidates.append(f'{md}:{number}: {line}')
if candidates:
    raise SystemExit('Residual Supertest/tool version candidates:\n' + '\n'.join(candidates))
