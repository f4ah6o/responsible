# Operator-level workflow creation and discovery

English | [日本語](workflow-discovery.ja.md)

This document is normative for operator-level workflow creation and discovery: the `tool` boundary level, the `responsible.oplog.v0` JSONL format, deterministic conversion into a discovered `ProcessModel`, and the Windows recorder. Where this document conflicts with [`semantic-core.md`](semantic-core.md), the semantic core wins. This document is authoritative for the operation-log schema and discovery conversion rules.

## Goal

An operator can record a foreground-window trace, convert it into a cycle-free sequence of `status: "discovered"` Activities, and inspect the result through the existing responsibility-boundary projections.

The source model keeps the discovered occurrences in time order. Boundary projection remains lossy by design:

- `tool` projection groups adjacent Activities that resolve to the same tool boundary;
- `person` projection groups adjacent Activities that resolve to the same person boundary;
- the unprojected `ProcessModel` is the source of truth for occurrence-level detail.

The `tool` view is therefore a tool-run view, not an occurrence-preserving trace viewer. A future trace-specific view may expose every occurrence without quotienting, but that is outside this design.

## Scope

This design adds:

1. `tool` as the finest viewer hierarchy level: `company < department < section < team < person < tool`.
2. `responsible.oplog.v0`, a local JSONL operation-log format.
3. A pure discovery converter that synthesizes a flat, cycle-free `ProcessModel`.
4. A consent-based Windows recorder that captures foreground-window metadata only.

It does not add process-mining inference, trace merging, hidden monitoring, keylogging, screen capture, clipboard capture, or automatic upload.

## `tool` boundary level

`tool` names the instrument used to perform an Activity, such as Excel, Outlook, a browser, paper, or a telephone. It is a responsibility axis used by the viewer, not a new semantic primitive.

The hierarchy is:

```text
company < department < section < team < person < tool
```

Existing projection rules remain unchanged. In particular, adjacent Activities with the same selected boundary are quotient-folded. Consequently:

- switching between two Excel windows creates distinct source Activities when their normalized titles differ, but an adjacent Excel-to-Excel run becomes one composite at `tool` projection;
- switching Excel → Outlook → Excel remains three projected nodes at `tool` projection because the equal Excel boundaries are not adjacent;
- coarsening to `person` may fold the whole run when one operator performed it.

A model without `tool` resolves to `<unassigned>` at the `tool` level, matching existing behavior for missing responsibility axes.

## `responsible.oplog.v0`

The format is JSONL: one JSON object per non-empty line.

```ts
type OpLogEntry = OpLogHeader | OpLogFocus | OpLogIdle | OpLogResume | OpLogNote;

type OpLogHeader = {
  kind: "header";
  schemaVersion: "responsible.oplog.v0";
  person?: string;
  machine?: string;
  startedAt?: string; // RFC 3339 timestamp with Z or a numeric offset
};

type OpLogFocus = {
  kind: "focus";
  t: string; // RFC 3339 timestamp with Z or a numeric offset
  person?: string;
  app: { exe: string; name?: string };
  window: { title: string }; // non-empty
};

type OpLogIdle = { kind: "idle"; t: string };
type OpLogResume = { kind: "resume"; t: string };
type OpLogNote = { kind: "note"; t: string; text: string };
```

A `focus` entry resolves its operator as `entry.person ?? header.person`. The resolved value must be non-empty.

Example:

```jsonl
{"kind":"header","schemaVersion":"responsible.oplog.v0","person":"Sato","machine":"PC-0123","startedAt":"2026-07-06T09:00:00+09:00"}
{"kind":"focus","t":"2026-07-06T09:00:12+09:00","app":{"exe":"OUTLOOK.EXE","name":"Outlook"},"window":{"title":"Inbox - Outlook"}}
{"kind":"focus","t":"2026-07-06T09:04:30+09:00","app":{"exe":"EXCEL.EXE","name":"Excel"},"window":{"title":"quote-a.xlsx - Excel"}}
{"kind":"focus","t":"2026-07-06T09:08:10+09:00","app":{"exe":"EXCEL.EXE","name":"Excel"},"window":{"title":"quote-b.xlsx - Excel"}}
{"kind":"idle","t":"2026-07-06T09:35:00+09:00"}
{"kind":"resume","t":"2026-07-06T09:50:00+09:00"}
```

## Validation

`parseOperationLogJsonl` reports every issue with a 1-based line number. It rejects:

- invalid JSON, arrays, primitives, and unknown `kind` values;
- missing or empty required fields;
- a `header` anywhere except the first non-empty line;
- a header whose `schemaVersion` is not `responsible.oplog.v0`;
- a `focus` entry without a non-empty resolved person;
- an empty `focus.app.exe` or `focus.window.title`;
- invalid timestamps;
- a document with no `focus` entry, including an empty, header-only, or idle-only log.

A document-level missing-focus issue is reported at line 1 so the issue shape remains consistent even for an empty input.

Timestamp validation must not rely on `Date.parse` alone. A timestamp is accepted only when it:

1. matches the explicit v0 form `YYYY-MM-DDTHH:mm:ss[.fraction](Z|±HH:mm)`;
2. contains a real calendar date and valid clock/offset fields;
3. parses to a finite instant.

The v0 parser rejects date-only strings, locale-dependent strings, timestamps without an offset, impossible dates, and leap-second `:60` values. The same rule applies to `t` and optional `header.startedAt`.

## Discovery conversion

```ts
discoverProcessModel(entries, options) -> ProcessModel
```

The function is pure and deterministic.

### 1. Resolve and normalize

For each `focus` entry:

- resolve `person` from the entry or header;
- trim `app.exe` and canonicalize it for Windows-style case-insensitive identity, producing `normalizedExe`;
- retain `app.name` only as optional display metadata;
- apply `options.titleRules` in order to `window.title` to obtain `normalizedTitle`.

The default title rule list is empty. `normalizedExe`, not the optional display name, is the stable tool identity throughout one log.

### 2. Stable ordering

Stable-sort timestamped entries by their validated instant. Preserve original line order for equal timestamps.

### 3. Segmentation

The segment key is:

```text
(resolved person, normalizedExe, normalized title)
```

A `focus` entry joins the current segment only when its key equals the previous focus key. A new segment is always started when:

- the resolved person changes;
- the app or normalized title changes;
- the gap exceeds `options.gapMinutes` (default 15);
- an `idle` entry intervenes.

Including the resolved person in the key preserves operator handoffs even when both operators use the same application and window title.

### 4. Activity synthesis

Create one Activity for each segment, in segment order:

- `id`: `op-001`, `op-002`, ...;
- `name`: normalized title, falling back to `app.name ?? app.exe` when normalization produces an empty string;
- `input` and `output`: `"Unknown"`;
- `responsibility`: `{ ...options.responsibility, person, tool }`, where `tool = normalizedExe`;
- `status`: `"discovered"`.

The model includes `Unknown: { kind: "primitive" }` in `types`. `app.name` may be retained outside the responsibility boundary as display metadata in a future schema, but its presence or absence must not change `tool` identity.

### 5. Flow synthesis

Create exactly one flow for each adjacent segment pair. Repeated visits receive distinct Activity IDs, so A → B → A becomes `op-001 → op-002 → op-003`, not a graph cycle.

### 6. Document shape

Return a flat `responsible.v0` model. Do not add a root Activity or predefined views. The existing loading path may wrap the model with `ensureRootActivity`.

## Projection expectations

Tests must distinguish source-model preservation from boundary projection:

- the source model preserves every discovered segment and adjacent flow;
- `tool` projection follows the existing quotient rule and may merge adjacent same-tool segments;
- segments from the same executable resolve to the same `tool` boundary even when `app.name` is present on only some entries;
- non-adjacent repeated tools remain distinct in the projected path;
- `person` projection may merge a longer adjacent run;
- an operator change prevents person-level folding across the handoff.

No new occurrence identity is encoded into the `tool` boundary solely to defeat RBNF. Doing so would conflate the tool axis with trace identity and break the meaning of boundary projection.

## Recorder requirements

The Windows recorder emits logs accepted by the parser.

When `GetWindowTextW` cannot obtain a non-empty title, the recorder must write a non-empty fallback, in this order:

1. `app.name`, when available;
2. `app.exe`.

It must never emit `window.title: ""`.

Timestamps use an RFC 3339 value with an explicit offset. The recorder writes only application executable/display name, window title, timestamp, operator, and machine metadata.

## Privacy principles

1. **Metadata only:** no keystrokes, screenshots, clipboard data, or window contents beyond the title.
2. **Consent and self-use:** the recorded operator starts and stops the recorder for their own workflow discovery.
3. **Masking before persistence:** title masking happens before a line is written; the unmasked title is never persisted.
4. **Local only:** no network transmission, remote collection, hidden startup, or automatic upload.

## Staged implementation

| Stage | Scope                                                                         | Issue                                                    |
| ----- | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1     | Add `tool` hierarchy/viewer support and projection tests                      | `issues/open/20260707-add-tool-boundary-level.md`        |
| 2     | Implement oplog parsing, discovery conversion, CLI, examples, and tests       | `issues/open/20260707-define-oplog-and-discovery.md`     |
| 3     | Add the consent-based Windows recorder and format checks                      | `issues/open/20260707-add-windows-operation-recorder.md` |

## Assertable subset

After Stage 2, automated tests must cover:

- explicit RFC 3339-with-offset validation, including rejection of date-only, offset-less, locale, and impossible values;
- line-numbered parser issues and rejection of logs without a `focus` entry;
- segmentation by resolved person, app, title, gap, and idle;
- cycle-free occurrence synthesis for back-and-forth traces;
- source-model occurrence preservation;
- stable `tool` identity derived from normalized executable names;
- quotient behavior at `tool` and `person` boundaries;
- operator handoff preservation;
- valid `status`, `responsibility`, and `Unknown` type output.
