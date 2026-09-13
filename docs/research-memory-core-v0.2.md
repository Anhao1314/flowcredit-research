# Research Memory Core v0.2 — delivery record

## A. Pre-code audit

Baseline commit: `b9bac1ae2574f3d4388024351e9321725b22dd0a`. Reviewed Research v0.1 schemas, source/evidence/claim normalization, rules, CoreWeave fixtures, coverage, tests and delivery documents; also agent contracts, verification scripts, CI and runtime boundaries. Before changes, Agent **109/109** and Research **25/25** passed. v0.1 persisted reviewed fixture files, not a transactional revision journal. The pre-code decision and constraints are recorded in [STORAGE_AUDIT.md](../research/memory/STORAGE_AUDIT.md).

## B. Storage decision

Use native `node:sqlite` behind a replaceable synchronous backend interface. Real transactions and foreign keys avoid the multi-file partial-write problems of JSON/JSONL without adding native npm dependencies. Tested against Node 22.19 and 24.19; the binding is experimental in these versions, not a stable/production certification. See [official versioned documentation](https://nodejs.org/download/release/v22.18.0/docs/api/sqlite.html).

Disk databases require WAL, synchronous FULL and foreign keys. IMMEDIATE transactions serialize writers; bounded busy retry handles concurrent first-open WAL initialization. Schema initialization/version checks are serialized. Nested savepoints roll back failed operations even when a caller catches the error. Read transactions provide consistent graph/diff snapshots. Unknown versions and unversioned nonempty databases reject. UPDATE/DELETE triggers, unique indexes, FK links and canonical hashes protect append-only records. This is local small-workload storage, not a distributed database.

Runtime databases, WAL/SHM and dependencies stay outside the repository. Default: `/Users/yimingyang/fc-agent/research-memory/memory.sqlite`; repository and symlink paths into it reject. Querying a missing database fails rather than inventing an empty state.

## C. Per-file delivery

| File | Change |
|---|---|
| `research/memory/STORAGE_AUDIT.md` | Pre-code v0.1/storage/runtime audit and choice |
| `research/memory/README.md` | Commands, architecture, temporal and correction contracts, limitations |
| `research/memory/sqlite-backend.js` | Independent transactional append-only SQLite backend |
| `research/memory/time.js` | Strict UTC date/instant validation |
| `research/memory/identity.schema.json` | Stable subject-scoped Claim identity |
| `research/memory/revision.schema.json` | Version chain, structured reasons, four-time metadata |
| `research/memory/correction.schema.json` | Immutable Evidence correction links |
| `research/memory/validation.js` | New schemas plus existing v0.1 validation |
| `research/memory/store.js` | Source/Evidence/Claim persistence, revisions, historical graphs, correction and explicit staleness |
| `research/memory/diff.js` | Deterministic belief comparison |
| `research/memory/open.js` | Backend factory and external runtime default |
| `research/src/memory.js` | JSON CLI: ingest, claims/as-of, history, diff, provenance, stale |
| `research/memory-test/fixtures.js` | Explicitly synthetic controlled-clock scenarios |
| `research/memory-test/memory.test.js` | 49 persistence, temporal, provenance, correction and concurrency regressions |
| `research/package.json` | Add memory CLI/test scripts; retain v0.1 pipeline/version |
| `research/README.md` | Link independent v0.2 Memory implementation |
| `agent/scripts/check-syntax.js` | Include new Memory implementation and tests |
| `agent/scripts/verify-release.js` | Add independent Memory test gate |
| `.github/workflows/ci.yml` | Add Memory tests to read-only CI |
| `docs/research-memory-core-v0.2.md` | This delivery/acceptance record |

## D–G. Architecture, identity, times and persistence

CLI → ResearchMemory domain layer → backend interface → SQLite. Domain code owns validation and provenance; only the backend issues SQL. Existing public schemas/API, Risk Engine and UI are independent.

Sources preserve stable v0.1 IDs and immutable content/provenance/hash. Repeated retrieval preserves the first retrieval and memory creation time. Same-ID changed content rejects; source replacement is deliberately not implemented. Evidence retains immutable raw facts and content-addressed identity. Corrections append a new Evidence and a reasoned old→new record, never overwrite. Branches, merges, cycles and orphan/cross-subject references reject.

Claim identity preserves the original v0.1 ID and subject regardless of changed wording. Numbered complete revisions use `CLAIM_ID:vN`, previous version/revision links and mandatory structured reason/note. Explicit evidence reasons require real new/replacement references. No hidden reassessment occurs. Correction plus supplied affected Claim revisions is atomic; correction without revisions leaves the existing belief intact and exposes its replaced fact in provenance.

`documentDate` is source publication; `observedAt` is the fact's observation/reporting period; memory `createdAt` is actual ingestion/recording; `effectiveAt` is belief effectiveness. Original extraction/retrieval payload dates remain separate. As-of requires **both createdAt and effectiveAt ≤ cutoff**, selects highest visible version and resolves only available dependencies/corrections. Late entry never creates retrospective knowledge. Date-only cutoff means end of UTC day. Explicit staleness appends a revision with reference date, threshold and latest observation; reads do not silently age history.

Actual CLI ingested CoreWeave twice into `/Users/yimingyang/fc-agent/research-memory/v0.2-coreweave.sqlite`. Both runs: **Source 3 / Evidence 32 / Claim identities 4 / revisions 4 / corrections 0**. Reopening/separate-process queries retain data. Existing coverage remains **9.52% weighted / 0% strict**. No new financial metrics were invented.

## H. Actual historical query

First memory ingestion: **2026-09-13T09:04:54.528Z**. `claims coreweave --as-of 2026-06-30` returns **0**, correctly reflecting no recorded knowledge at that time. `--as-of 2026-09-13` returns **4 supported v1 Claims**, each confidence **0.95**. Source publication/observation alone cannot backdate system knowledge.

## I. Actual and synthetic diffs

Actual CoreWeave June 30 → September 13 diff: **added 4**, every other category zero. This reflects first ingestion, not a financial judgment change.

Separate explicitly **synthetic** database `/Users/yimingyang/fc-agent/research-memory/v0.2-synthetic-demo.sqlite` demonstrates belief evolution with an imaginary publisher and controlled clock. Claim `CLAIM-2bcdd721112110c60eca293c`: Jan 2 v1 supported/0.82 → Feb 2 v2 partially_supported/0.65 with new counter Evidence → Mar 2 v3 partially_supported/0.70 after correction. Jan 2 → Feb 2 diff is **weakened 1**, carrying added counter `EVID-bbe234f217c8fe22989d14e0`, reason and complete provenance. These are not CoreWeave facts.

Diff categories: added, removed, unchanged, stale, disputed, strengthened, weakened and changed. Status transition precedes confidence delta; equally ranked changes in text/references remain changed. The comparison order is not a risk score. Before/after provenance and intervening reasons are included.

## J. Evidence correction demonstration

Synthetic original `EVID-8c500415ff5a916021e29b46` retains raw 32 USD. Replacement `EVID-9e300cfbd5ce2173a7899171` records raw 32 USD_millions, normalization scale 1,000,000, normalized 32,000,000 USD. The append-only correction records `unit_extraction_error` and explanation; v3 references the replacement, v1/v2 retain the original. Earlier as-of queries cannot see the later correction. Demo counts: **1 Source / 3 Evidence / 1 identity / 3 revisions / 1 correction**.

## K. Acceptance

Final results: Existing Agent **109/109**, Existing Research **25/25**, New Research Memory **49/49**. Memory also passes **49/49 on official Node 22.19** (current runtime Node 24.19). JavaScript syntax (82 files), frontend discipline (17 files), development isolation (161 files/one workflow), external TypeScript check and complete release verification all pass, including contracts, production-like local smoke, graceful shutdown, secrets/artifact scans. No production deployment was performed. Tests cover idempotency, real reopen/process persistence, v1/v2/v3 history, as-of availability, all diff categories, counter provenance, atomic corrections/rollback, orphan/cross-subject rejection, immutable hashes/raw facts, stale metadata, path guards and concurrent ingestion. The concurrency test exposed an actual first-open WAL lock race; bounded initialization retry fixed it, and the regression remains.

## L. Boundaries and deliberately unimplemented work

No Hybrid RAG, vector index, retrieval/LLM generation, Thesis Engine, LLM-Wiki, multi-agent orchestration, live connector, investment recommendation or scoring calibration. No new public API/schema/snapshot versions, risk formulas/TAI/CCI/grade changes, UI/theme changes or deployment. No source supersession, automatic judgment recomputation, distributed storage, write authorization service or operational backup certification. External real-evidence validation remains a separate dependency. All synthetic examples are isolated from reviewed CoreWeave fixtures.

## M. Next-phase recommendation

The provenance/revision foundation is ready for a bounded Hybrid RAG experiment, not an automatic research agent. First validate retrieval against a fixed reviewed corpus, citation integrity and historical cutoffs. Candidate Evidence should pass existing schema/provenance validation and explicit review before persistent writes. Implement no such next-phase component in this delivery.

## Freeze and Git review

Frozen `assets/`, `index.html`, `AGENTS.md`, `agent/src`, `agent/contracts`, existing `agent/test`, Research v0.1 fixtures/rules/schemas/test and existing normalization/coverage modules have zero changes against the baseline. No CSS change; brace balance remains unchanged. Only origin is a permitted push target; upstream push remains disabled and the executable pre-push isolation hook remains in place. No runtime database or dependency artifacts are committed.
