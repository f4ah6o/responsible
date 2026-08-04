# Agent and CI interface

`responsible` exposes a stable, dependency-free CLI surface for CI systems, coding agents, and LLM tool adapters. The contract version is `responsible.cli.v1`.

This interface is intentionally centered on semantic data rather than UI automation or BPMN diagram manipulation. Agents can validate a generated model, migrate it, project it onto any responsibility axis, and inspect operational semantics without opening the viewer.

## Capability discovery

Run capability discovery before constructing commands when the installed package version is not known:

```sh
responsible capabilities --compact
```

The JSON document declares supported schema versions, stdin behavior, boundary-expression syntax, commands, output kinds, and exit codes. New optional fields may be added compatibly; existing `responsible.cli.v1` fields retain their meaning.

## Input contract

Commands accept UTF-8 JSON files. The file name `-` reads one document from stdin:

```sh
cat generated.responsible.json | responsible validate - --format json
```

A command invocation may contain the stdin sentinel at most once. `migrate`, `project`, and `analyze` accept exactly one input document. `validate` accepts one or more documents.

## Deterministic JSON

`migrate`, `project`, `analyze`, and `capabilities` write JSON to stdout. Use `--compact` for a single-line representation suitable for tool transport.

`validate --format json` writes this envelope to stdout and emits no successful-file diagnostics to stderr:

```json
{
  "protocolVersion": "responsible.cli.v1",
  "command": "validate",
  "ok": true,
  "results": [{ "source": "model.json", "ok": true }]
}
```

Invalid results add an `issues` array whose entries contain a JSON-style `path` and a human-readable `message`.

## Boundary expressions

Responsibility axes are model-defined. They are not restricted to organizational lanes or the common `company / department / section / team / person` hierarchy.

A single key selects one axis:

```sh
responsible project model.json --boundary system
```

Comma-separated keys select a composite boundary path:

```sh
responsible project model.json --boundary company,department
```

Dotted keys remain available for nested responsibility values, for example `organization.department`.

## Semantic analysis

`responsible analyze` invokes the public `analyzeProcessModel` API and returns a report with five sections:

- `summary`: Activity, leaf/composite, flow, type, view, and status counts.
- `topology`: entry, exit, isolated Activities, and strongly connected flow cycles.
- `semantics`: responsibility keys, contract coverage, effect counts, and referenced types.
- `responsibility`: assigned/unassigned Activities, boundary groups, and cross-boundary handoffs.
- `automation`: declared `automatable` Activities, explicit readiness signals, and missing declarations.

```sh
responsible analyze model.json --boundary department --compact
```

`readySignalActivityIds` is a conservative modeling signal, not proof that an Activity can be executed safely. An Activity appears there only when it is a leaf, has `status: "automatable"`, resolves at the selected responsibility boundary, and declares both `requires` and `ensures`. Runtime availability, authorization, idempotency, failure recovery, and effect execution remain downstream concerns.

The analysis keeps responsibility, contracts, effects, and maturity visible together. This is the main interface for reasoning beyond control-flow notation.

## Exit codes

| Code | Meaning                                                        |
| ---: | -------------------------------------------------------------- |
|  `0` | Success                                                        |
|  `1` | Invalid model, failed projection, or failed analysis operation |
|  `2` | Invalid command-line usage                                     |

Agents should branch on the numeric code first, then parse stdout or stderr according to the selected command and output format.

## Recommended agent sequence

```sh
responsible capabilities --compact
responsible validate candidate.json --format json --compact
responsible analyze candidate.json --boundary department --compact
responsible project candidate.json --boundary company,department --compact
```

Validation should precede analysis and projection when commands are orchestrated independently. The CLI also validates internally before every model operation.
