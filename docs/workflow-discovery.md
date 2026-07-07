# Operator-level workflow creation and discovery

English | [日本語](workflow-discovery.ja.md)

This document is normative for the operator-level workflow creation and discovery features — the `tool` boundary level, the `responsible.oplog.v0` operation-log format, the discovery converter, and the Windows operation recorder script. Where it disagrees with [`docs/semantic-core.md`](semantic-core.md) on semantics, `docs/semantic-core.md` wins; this document wins on the log schema shape and the discovery rules.

## Motivation

Writing a business process down at the operator level — who did what, with which tool or application — normally produces detail too fine to manage. In responsible it does not: views are projections, and RBNF folds consecutive same-boundary Activities, so a flow **created or discovered** at tool granularity collapses into consistent person-, team-, and department-level views just by coarsening the boundary zoom. Record once at the finest granularity; projection does the higher-level tidying automatically.

To exploit this property, three things are added:

1. **The `tool` boundary level** — lanes can go all the way down to the tool/application used (the finest level of the viewer's hierarchical boundary zoom).
2. **The `responsible.oplog.v0` operation-log format and a discovery converter** — synthesize a `ProcessModel` of `status: "discovered"` Activities from an operation record (a foreground-window transition log).
3. **A Windows operation recorder script** — records foreground-window switches on an operator's PC as `responsible.oplog.v0`.

## What this is not

- **No semantic-core change.** `tool` is not a new modeling primitive; it is a viewer convention (an addition to the hierarchical boundary order) over one of the `responsibility` axes, which were always arbitrary.
- **Not process mining.** The discovery converter does no frequency analysis, branch inference, or trace merging. One log becomes one linear path (a trace). Merging multiple traces and aggregating back-and-forth stays out of scope as long as loop semantics is undefined (the core rejects cycles).
- **Not execution monitoring or keylogging.** Only application-name and window-title metadata is recorded. Keystrokes, screen contents, and the clipboard are never recorded (see the privacy principles below).

## The `tool` boundary level

The viewer's hierarchical boundary order (`HIERARCHICAL_BOUNDARY_ORDER` in `src/hierarchy.ts`) is extended to:

```text
company < department < section < team < person < tool
```

- The value of the `tool` axis names the instrument an Activity is performed with (an application, a SaaS, paper, a phone call, …). It expresses the means (with what) rather than the attribution of responsibility (who), but as a lane axis it is treated exactly like the other axes: `boundaryOf` resolution, nested-lane construction, and RBNF folding all follow the existing rules unchanged.
- A model without a `tool` axis resolves to the `<unassigned>` lane at `tool` zoom — identical to the existing behavior of models without a `person` axis, so this is backward compatible.
- Coarsening the boundary zoom to `person` folds one operator's consecutive work across several tools into a single node via RBNF. This folding is the point of the feature.

## The `responsible.oplog.v0` operation-log format

An operation log is JSONL (one JSON value per line). Lines should be in time order, but the converter stable-sorts by `t` before processing.

### Entry kinds

```ts
type OpLogEntry = OpLogHeader | OpLogFocus | OpLogIdle | OpLogResume | OpLogNote;

// Optional first line. Supplies defaults for subsequent entries.
type OpLogHeader = {
  kind: "header";
  schemaVersion: "responsible.oplog.v0";
  person?: string; // default `person` for subsequent entries
  machine?: string; // recording machine name (informational)
  startedAt?: string; // RFC 3339
};

// A foreground-window switch (the v0 core; discovery works from these alone).
type OpLogFocus = {
  kind: "focus";
  t: string; // RFC 3339 with offset
  person?: string; // required unless the header supplies a default
  app: { exe: string; name?: string }; // e.g. { "exe": "EXCEL.EXE", "name": "Excel" }
  window: { title: string };
};

// Input idle start/end (optional).
type OpLogIdle = { kind: "idle"; t: string };
type OpLogResume = { kind: "resume"; t: string };

// Manual annotation (optional). The v0 converter ignores these
// (reserved for future extension).
type OpLogNote = { kind: "note"; t: string; text: string };
```

Example (what the recorder script actually emits):

```jsonl
{"kind":"header","schemaVersion":"responsible.oplog.v0","person":"Sato","machine":"PC-0123"}
{"kind":"focus","t":"2026-07-06T09:00:12+09:00","app":{"exe":"OUTLOOK.EXE","name":"Outlook"},"window":{"title":"Inbox - Sato - Outlook"}}
{"kind":"focus","t":"2026-07-06T09:04:30+09:00","app":{"exe":"EXCEL.EXE","name":"Excel"},"window":{"title":"quote_2026-07.xlsx - Excel"}}
{"kind":"focus","t":"2026-07-06T09:21:05+09:00","app":{"exe":"OUTLOOK.EXE","name":"Outlook"},"window":{"title":"RE: Your quote - Message - Outlook"}}
{"kind":"idle","t":"2026-07-06T09:35:00+09:00"}
{"kind":"resume","t":"2026-07-06T09:50:00+09:00"}
```

### Validation

The parser (`parseOperationLogJsonl`) reports issues with line numbers (the convention corresponding to the JSON-path reporting of model validation):

- A line is invalid JSON / not an object.
- Unknown `kind`, or a missing/empty required field (`t`; `app.exe` / `window.title` on `focus`; `person` when no header default exists).
- `t` does not parse as RFC 3339.
- A `header` appears on a line other than the first, or its `schemaVersion` is not `responsible.oplog.v0`.

## Discovery rules (log → `ProcessModel`)

`discoverProcessModel(entries, options) -> ProcessModel` is a pure function that synthesizes deterministically by these rules:

1. **Normalization**: apply `options.titleRules` (a list of `{ pattern, replace }`, `pattern` a regular-expression string) in order to each `focus` entry's `window.title` to obtain the normalized title. The default is no transformation. Recommended examples strip application-name suffixes, e.g. `{ "pattern": " - Excel$", "replace": "" }`.
2. **Segmentation**: walk the `focus` entries stable-sorted by `t`, merging an entry into the current segment when its key `(app.exe, normalized title)` equals the previous one. Even with an equal key, the segment is cut and a new occurrence starts when:
   - the gap since the previous `focus` exceeds `options.gapMinutes` (default 15), or
   - an `idle` entry intervenes.
3. **Activity synthesis**: one Activity per segment i (1-based):
   - `id`: `op-001` style (zero-padded to at least 3 digits, in segment order).
   - `name`: the normalized title (or `app.name ?? app.exe` when empty).
   - `input` / `output`: `"Unknown"`, with `Unknown: { kind: "primitive" }` in `types`. Data types cannot be discovered from an operation log; typing is left as the human work of promoting `discovered` → `defined`.
   - `responsibility`: `{ ...options.responsibility, person, tool }` — `person` from the entry (or the header default), `tool` from `app.name ?? app.exe`. `options.responsibility` supplies fixed values for the coarser axes (company / department / section / team).
   - `status`: `"discovered"`.
4. **Flow synthesis**: one `FlowDef` per adjacent segment pair i → i+1. The result is always a simple path, so **no cycle can arise by construction** (the core rejects cycles; unrolling back-and-forth A→B→A into occurrences instead of aggregating edges is a deliberate design decision).
5. **Document shape**: return a flat `ProcessModel` with `schemaVersion: "responsible.v0"`. No root Activity is added — the loading path's existing `ensureRootActivity` wraps flat models in a synthetic root. No `views` are added either (boundary zoom is viewer state).

No folding happens on the model side. At `tool` zoom the fine occurrence-level path is visible; coarsening to `person` folds one operator's consecutive occurrences into a single node via RBNF. Tidying the back-and-forth is projection's job, not discovery's.

## Privacy principles (normative)

Operation recording can be repurposed as surveillance, so the recorder script and its documentation must satisfy:

1. **Metadata only**: record only the application executable name and display name, the window title, and timestamps. Never record keystrokes, screen contents, the clipboard, or input contents such as URL query strings.
2. **Consent and self-use**: recording is started and stopped by the recorded person, for discovering their own workflow. Features that would assist covert recording of someone else's PC (hidden startup, remote collection, automatic upload) are not implemented.
3. **Masking**: window titles can contain customer names and similar. The recorder offers regular-expression title masking (replacement with `[masked]`) as an option, documented in its README.
4. **Local only**: output goes to a local JSONL file only; nothing is sent over the network.

## Staged plan

| Stage | Scope                                                                       | Issue                                                    |
| ----- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1     | `tool` boundary level (hierarchy / viewer label / samples / docs / tests)   | `issues/open/20260707-add-tool-boundary-level.md`        |
| 2     | `responsible.oplog.v0` parser, `discoverProcessModel`, CLI, example, tests  | `issues/open/20260707-define-oplog-and-discovery.md`     |
| 3     | Windows operation recorder (`tools/recorder-win/`), masking, README, checks | `issues/open/20260707-add-windows-operation-recorder.md` |

Stages 1 and 2 are independently shippable (verifying Stage 2's acceptance is easier with Stage 1's `tool` zoom in place). Stage 3 depends on Stage 2's log format.

## Assertable subset

After Stage 2, tests must be able to assert:

- Log parsing and line-numbered error reporting.
- The segmentation rules (merging; cutting on gap / idle) and title normalization.
- A model synthesized from a log containing back-and-forth passes `validateProcessModel` and projects without a cycle error.
- `responsibility` composition (fixed axes + `person` + `tool`) and `status: "discovered"`.
- Projection at the `tool` boundary preserves the occurrence-level path, and RBNF at the `person` boundary folds one operator's consecutive occurrences.
