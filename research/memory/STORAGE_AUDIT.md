# Storage design audit — Research Memory Core v0.2

Recorded before Memory implementation. The repository was clean at `b9bac1a`.

Reviewed the existing Research audit/README, all four schemas, explicit mapping rules, all CoreWeave source/observation/claim fixtures, seven source modules, 25 tests and v0.1 delivery report. Rechecked current shared agent contracts, agent/research package/runtime, syntax/CI/release gates and in-memory SessionStore/IdempotencyStore. Baseline tests passed: 109 Agent + 25 Research. Isolation and executable production-blocking push hook remain intact.

## Findings

- Sources and observations have only checked-in fixture lifecycle; normalized Evidence and Claim are rebuilt on every coverage invocation. No persistence or historical revision abstraction exists.
- Agent sessions/idempotency are in-memory Maps with TTL. Browser draft storage is UI-specific and unsuitable for transactional, immutable research provenance. No existing durable abstraction can safely be reused.
- Actual runtime is Node 24.19.0. Native `node:sqlite` successfully opened a database and committed a primary-key transaction; embedded SQLite is 3.53.3. CI currently pins Node 22.19.0.
- Native DatabaseSync is available without a flag from Node 22.13, but the Node 22/24 binding is still experimental. See [versioned Node SQLite documentation](https://nodejs.org/download/release/v22.18.0/docs/api/sqlite.html). Do not claim its API is stable merely because SQLite's transaction engine is mature.

## Decision before coding

Use native SQLite behind a generic append-only backend interface. Restrict usage to common DatabaseSync exec/prepare/run/get/all/close operations, verify on Node 22.19 and Node 24, and reject unsupported runtimes explicitly. No new npm dependency/build chain is necessary.

Use WAL, synchronous FULL, foreign keys, unique identity/version/supersession constraints and immediate write transactions. Nested writes use savepoints. No domain module may issue SQL. Updates/deletes are blocked for immutable records and links. Keep all database/WAL/SHM files outside the repository; never connect this backend to the assessment server.

Trade-offs: experimental Node binding, synchronous small-workload storage, a single local database (not distributed/network-filesystem storage), and schema-versioned migration responsibility. These are acceptable for this isolated development CLI; portability is tested rather than assumed. A hand-written JSON/JSONL store was rejected because crash recovery, multi-process serialization and atomic provenance writes would add unnecessary correctness risk.

Source conflicts will reject rather than overwrite. Evidence correction will append a new fact plus an explicit supersession record. Claim identity will remain fixed while numbered revisions append. Knowledge-time as-of requires both createdAt and effectiveAt ≤ query time; dependencies must have actually been ingested by effectiveAt. The seed must not be backdated to documentDate/observedAt.
