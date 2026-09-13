# Research Memory Core v0.2

Append-only local persistence for reviewed Source, Evidence, Claim identity and numbered Claim revisions. It answers current beliefs, historical knowledge, changes and their provenance. It is independent of Risk Engine, investment recommendations, RAG, LLM-Wiki and Thesis Engine.

## Commands

From the repository root, using the existing locked agent Ajv dependencies:

```sh
node research/src/memory.js ingest coreweave
node research/src/memory.js claims coreweave
node research/src/memory.js claims coreweave --as-of 2026-06-30
node research/src/memory.js history CLAIM_ID
node research/src/memory.js diff coreweave --from 2026-06-30 --to 2026-09-13
node research/src/memory.js provenance CLAIM_ID --version 1 --as-of 2026-09-13
node --test research/memory-test/*.test.js
```

All commands output JSON. Each accepts `--db /absolute/external/path/memory.sqlite`; alternatively set `FC_RESEARCH_MEMORY_DB`. Default is repository-sibling `fc-agent/research-memory/memory.sqlite` (in this workspace `/Users/yimingyang/fc-agent/research-memory/memory.sqlite`). Database, WAL and SHM must remain outside the repository, including through symlinks. A query against a missing database fails; ingest creates it. Unknown/duplicate/missing options fail. No network calls or UI/auth changes.

The validation seed used `/Users/yimingyang/fc-agent/research-memory/v0.2-coreweave.sqlite`; specify that path to query the delivered local dataset. It was first ingested on **2026-09-13**, so June 30 as-of correctly returns zero Claims. It is not retroactively assigned knowledge of reports subsequently published/ingested.

Original v0.1 compatibility pipeline remains unchanged:

```sh
node research/src/coverage.js coreweave
node --test research/test/*.test.js
```

## Storage choice and interface

Native `node:sqlite` DatabaseSync, tested on Node 22.19 and 24.19, avoids new native/npm dependencies while using real SQLite transactions. The Node 22/24 binding is still experimental: [versioned documentation](https://nodejs.org/download/release/v22.18.0/docs/api/sqlite.html). Common APIs are isolated in `sqlite-backend.js`; no domain logic issues SQL. This is synchronous, small-workload local storage, not a distributed/network-filesystem service. Do not describe the binding as stable or this prototype as production storage certification.

Backend interface:

- `get(kind, id)` / `list(kind)` → `{payload, createdAt}` records.
- `append(kind, payload, createdAt, links)` inside a transaction only.
- `transaction(callback, {write})`; synchronous only, nested savepoints, rollback on error.
- `close()`.

Write transactions begin IMMEDIATE, reads use a consistent transaction snapshot. WAL is required for disk databases (no durability fallback), synchronous FULL, foreign keys enabled, five-second busy timeout. Concurrent first-open WAL lock errors receive bounded retry; schema/version validation is inside the serialized transaction. Primary keys, unique Claim/version and correction predecessor/successor constraints protect identities; triggers deny UPDATE/DELETE of records/links. Unknown storage versions/unversioned nonempty databases fail explicitly. Storage version is 2, unrelated to public intake/API versions.

## Domain interface

`ResearchMemory` exposes `putSource/getSource`, `putEvidence/getEvidence/listEvidence`, `createClaim/reviseClaim/getClaim/getClaimHistory`, `getClaimsAsOf`, `diffClaims`, `provenance`, `correctEvidence`, `markStale`, `ingest`, `counts`, `transaction` and `close`. `openMemory` selects the backend; callers can inject another implementation of the storage interface.

All writes validate existing v0.1 schemas and source/evidence/reference chains. Memory identity/revision/correction objects have additional Draft 2020-12 schemas. There is no public HTTP endpoint, automatic model writer or assessment integration. Imported fixtures are not rewritten.

## Identity, immutability and corrections

- **Source:** retain the existing stable subject/publisher/document-key ID. Reingesting identical core content is a no-op; repeated retrieval preserves first retrieval and memory creation time. All other source fields, including URL, type, contentHash and provenance metadata, must match. Same ID with different content/hash rejects; source replacement/supersession is not implemented.
- **Evidence:** preserve existing content-addressed ID/hash and raw fact. Same ID with different content rejects; only creation-time variation on otherwise identical input is ignored. Raw-to-normalized conversion and content identity are validated. Old facts are never overwritten/deleted.
- **Correction:** append a new valid Evidence plus a correction linking old → replacement, structured reason and nonempty note. Source/subject/metric must match. Linear correction chains can continue, but branches, cycles, merges and same-ID replacements reject. Get/list APIs reveal supersession; historical queries do not show future corrections. References to replaced facts remain in old Claim history; new revisions cannot reuse superseded facts.
- **Claim identity:** ID supplied at creation, preserving current v0.1 IDs and subject. It is not regenerated from revised wording/rules. Creating the same original Claim again is idempotent, even after later revisions; differing beliefs require explicit `reviseClaim`.
- **Revision:** ID `CLAIM_ID:vN`, sequential version, previous version/revision ID, complete Claim snapshot, reason/note and temporal metadata. Every revision appends. Supported needs primary-source Evidence; partially_supported needs supporting Evidence; disputed needs support and counter Evidence. Cross-subject/orphan references reject. Optional `expectedVersion` detects stale callers.

Structured reasons: initial_ingest, new_supporting_evidence, new_counter_evidence, evidence_corrected, stale_evidence, manual_review, rule_change. Evidence-specific reasons require actual new/replacement references. No automatic reevaluation is asserted: a reviewer supplies a revision with its justification. `correctEvidence(..., {claimRevisions:[...]})` atomically appends correction and affected revisions; if any reference/revision fails, all new facts/links/revisions roll back. If no revisions are supplied, the current Claim still refers to its original fact and provenance exposes the correction, requiring review.

## Temporal model and as-of

| Time | Meaning |
|---|---|
| Source `documentDate` | Publication/filing date (v0.1 quarter source uses signature date) |
| Evidence `observedAt` | Observation/reporting-period date; not knowledge availability |
| Memory envelope/revision `createdAt` | First actual system ingestion/recording time, from injectable clock |
| Revision `effectiveAt` | Intended belief-effective time; dependencies must already have been ingested |

Original v0.1 Source retrievedAt and Evidence extraction createdAt are retained in their payloads. The separate memory envelope createdAt is system ingestion time. Imported Claim snapshots use identity creation time and revision update time; no original fixture is changed.

As-of selects the highest numbered revision for each subject identity satisfying **createdAt ≤ query AND effectiveAt ≤ query**. Source and Evidence must be available by effectiveAt; a revision cannot precede its identity/dependencies, regress effectiveAt, or schedule future effectiveness beyond recording time. Late entry with an earlier permissible effectiveAt does **not** appear in earlier knowledge-time queries because createdAt still filters it. Same-time revisions tie-break by version. Global recording time cannot move backwards.

ISO date-only queries mean **end of that UTC day**. Datetime queries are exact instants, normalized to UTC; invalid dates/implicit timezone strings reject. Historical staleness and corrections are journaled events, never recomputed/inserted on read. A future cutoff returns only existing recorded knowledge, not a forecast.

## Staleness

```sh
node research/src/memory.js stale coreweave --at ISO_DATETIME --max-age-days 365
```

Explicit evaluation time and age threshold are required; evaluation cannot be future or target a superseded revision. Age uses the latest observedAt among all supporting/counter Evidence; strictly greater than maxAgeDays yields an appended stale revision. No-reference Claims are not aged. The revision stores structured `staleEvaluation` (reference date, threshold, latest observation), not just a note. Repeated evaluation of already stale Claims is a no-op. Clock injection and fixed evaluation dates make tests reproducible; reads never depend on a hidden “today” aging rule.

## Diff rules

Compare belief snapshots: status, confidence, text/category/method and sorted supporting/counter IDs. Ignore timestamps/reason metadata when judging belief equality. One exclusive category per Claim, in this priority:

1. Missing before/after → added/removed. Append-only subject state normally has no removals.
2. Equal belief → unchanged.
3. Newly stale → stale; newly disputed → disputed.
4. Status-order increase/decrease → strengthened/weakened: supported > partially_supported > disputed > unverified > stale.
5. Same status confidence increase/decrease → strengthened/weakened.
6. Other belief/reference change with equal status/confidence → changed (not falsely unchanged).

Status transition takes precedence over opposing confidence delta. These ranks are comparison rules, not a stored risk/investment score. Output includes before/after provenance, added/removed Evidence IDs and intervening revision reasons/notes, all from a consistent database snapshot.

See [pre-code storage audit](STORAGE_AUDIT.md) and [delivery report](../../docs/research-memory-core-v0.2.md). Synthetic correction/counter scenarios live only in `memory-test/fixtures.js`; their imaginary source/values and controlled clock are explicitly labeled, separate from CoreWeave.
