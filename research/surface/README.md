# FlowCredit Research Workbench — UI-2.0

A development-only, read-only, loopback-only web workbench for **Auditable Belief Memory & Evidence Reasoning Infrastructure for Research Agents**.

UI-2.0 replaces the previous FlowCredit risk-assessment frontend and the earlier object-browser Research Surface with one active product UI.

The product question is no longer “which database object do I want to browse?” It is:

> **What do we currently believe, why, what counters it, what changed, and what requires human attention?**

## Product model

```text
Research Inbox
    ↓
Belief
    ↓
Evidence roles / pairwise reasoning boundary
    ↓
Provenance + as-of
    ↓
Proposed change
    ↓
Human Review
    ↓
Future authoritative revision
```

Hard semantic boundaries remain unchanged:

- Evidence ≠ Claim.
- Recorded Evidence link role ≠ persisted RelationReceipt.
- Relation ≠ Impact.
- AI proposal ≠ truth.
- Human authority remains above every authoritative belief change.
- Historical and as-of provenance must remain reproducible.

## Run

```bash
node research/surface/server.js
# optional
node research/surface/server.js --port 4317
```

Open:

```text
http://127.0.0.1:4317
```

The server binds loopback only.

## Active routes

| Route | Product surface |
|---|---|
| `/` | Research Inbox — attention-first workspace |
| `/beliefs` | Beliefs — current recorded Claims in product language |
| `/claim/:claimId` | Belief Workbench — belief state, supporting/counter Evidence, history, reasoning boundary |
| `/review` | Human Review — real capability boundary; synthetic preview with `?demo=1` |
| `/evidence` | Evidence index |
| `/evidence/:evidenceId` | Evidence Receipt — fact, source, admission, provenance, belief links |
| `/timeline` | Research Timeline — persisted events in recorded time order |
| `/company/:subjectId` | Research subject context |

Historical compatibility aliases remain read-only:

- `/claims` → Beliefs renderer
- `/changes` → Timeline renderer

They are not part of the UI-2.0 navigation.

## Why server-first

UI-2.0 intentionally keeps the existing server-first model instead of introducing a SPA framework merely for fashion.

The current product benefits from:

- deterministic SSR;
- zero browser fetch;
- zero browser storage;
- zero browser mutation;
- strict CSP;
- all persisted strings escaped before HTML output;
- no remote assets or CDN dependencies;
- predictable, inspectable GET URLs;
- browser JavaScript limited to keyboard focus and synthetic review-preview toggles.

The backend Research Memory and Relation semantics remain the authority.

## Research Inbox

Inbox is action-first. It surfaces real signals computed from Research Memory:

- admitted Evidence not referenced by a current belief;
- beliefs with thin recorded supporting Evidence;
- recently recorded Evidence;
- linking counts;
- admission provenance depth;
- latest recorded activity.

These are workflow signals, not risk scores, confidence scores or investment opinions.

## Belief Workbench

A Belief Workbench page shows:

- the current recorded Claim statement and status;
- current revision;
- supporting Evidence;
- counter Evidence;
- revision timeline;
- recorded Evidence link roles;
- provenance and authority boundaries.

Important: supporting/counter links stored on a Claim revision are displayed as **recorded roles**, not as fabricated RelationReceipts. When no persisted real RelationReceipt exists, the inspector says so explicitly.

## Evidence Receipt

Evidence is rendered as an auditable factual receipt:

- recorded statement;
- metric/value/period/scope;
- Source;
- source location;
- Admission review records;
- provenance depth;
- beliefs that currently reference it;
- correction/supersession state where present.

Evidence never becomes a Claim or investment conclusion merely because it was admitted.

## Human Review

Real mode is intentionally empty until a real ClaimRevisionProposal + Human Review Receipt write contract exists.

`/review?demo=1` may display isolated synthetic proposal examples. Review buttons are preview-only:

- no request is sent;
- nothing is stored;
- no Claim is revised;
- refresh restores the initial state.

This is deliberate. A believable review UI is not permission to invent a write path.

## Timeline

Timeline is generated from persisted Research Memory events:

- Evidence recording;
- Evidence admission reviews;
- corrections;
- Claim revision records.

It separates **when information arrived** from **when a belief changed**.

UI-2.0 does not yet reconstruct a historical full snapshot at an arbitrary `asOf`. The interface states that limitation instead of simulating time travel.

## Public synthetic demo

A deterministic public demo remains available:

```bash
node research/surface/fixtures/public-demo/build.js /tmp/flowcredit-demo.sqlite

FC_SURFACE_MEMORY_DB=/tmp/flowcredit-demo.sqlite \
FC_SURFACE_PUBLIC_DEMO=1 \
node research/surface/server.js
```

Rendered pages never expose the local file path.

## Security and integrity

- GET / HEAD only. Other methods return 405.
- SQLite opened read-only with query-only behavior.
- restrictive CSP:
  - `default-src 'none'`
  - local styles/scripts/images only
  - `form-action 'self'`
  - `base-uri 'none'`
  - `frame-ancestors 'none'`
- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- no remote frontend dependencies.
- no inline styles.
- no client network calls.
- no browser persistence.

## Tests

```bash
node --test research/surface-test/*.test.js
```

Repository CI also imports the surface suite through `agent/test/surface.test.js`.

The frontend discipline gate additionally asserts that the legacy root frontend does not return.

## Current limitations

- no persisted real RelationReceipts in the real Research Memory surface;
- no persisted real ClaimRevisionProposal queue;
- no human-review write path;
- no arbitrary historical as-of reconstruction;
- no SourceSpan sentence/table-cell joins;
- search remains deterministic substring search;
- AI runtime remains OFF in this surface.

Those are product boundaries, not CSS bugs.
