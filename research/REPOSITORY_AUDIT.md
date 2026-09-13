# Pre-implementation repository audit — 2026-09-13

This read-only audit preceded Research source code changes. Authority is the implementation and shared contracts, not the illustrative mappings in the task prompt.

## Read and inspected

- Root `README.md`, `AGENTS.md`; root has no package.json. `agent/package.json`, package-lock and CI define the Node ES module/Ajv toolchain.
- `agent/src/intake-v03.js`, `rules-v021.js`, `risk-core-v021.js`, `normalize-v021.js`, `normalize-v02.js`, `validate-v021.js`: current intake, calculation, provenance and integrity authority.
- `agent/src/server.js`, `finch-contract.js`, `session-store.js`, `idempotency-store.js`, `security.js`, `logger.js`, `harness.js`: Public API assembly, facts, sessions, authentication, model consent and deterministic override boundaries.
- Actual schemas are `agent/contracts/finch-assess-input.schema.json` and `finch-assess-output.schema.json`; also inspected contract README, example input, OpenAPI inventory, `docs/public-api-v1.md`, `docs/finch/CONTRACT.md`.
- Inspected the complete test inventory and key intake, risk-v0.2.1, Finch and Public API regression cases. Ran all existing tests before changes: **109/109**, zero failures, zero skips.
- Inspected `agent/README.md`, `docs/roadmap.md`, `docs/进展说明-20260913.md`, `docs/dev-isolation.md`, frontend delivery documentation inventory, syntax checker and `.github/workflows/ci.yml`.
- Verified clean worktree, origin development repository, disabled upstream push address, executable pre-push hook and passing development isolation check.

## Current authoritative components

| Component | Actual behavior |
|---|---|
| Intake | `flowcredit.intake/v0.3.1`; flat/guided drafts for AI inference API operators; dated primary window 27–31 days; USD, million Tokens, GPU-hours, percentages |
| Evidence readiness | 24 decision fields; missing data/evidence and five server-derived fields distinguished; grouped readiness not-ready/limited/ready |
| Evidence quality | Completeness/provenance/recency/coverage/consistency weights 25/30/15/10/20%; six accepted source domains; document-only cap 49, fewer-than-two-domain cap 69 |
| Provenance | Verification levels self_reported/uploaded_document/counterparty_confirmed/system_api/cryptographic/cross_verified; Research primary_source is not one of these |
| Risk engine | `flowcredit.risk_result/v0.2.1`, deterministic piecewise expert rules; simulation normalization/peer references only at present |
| TAI | Reconciliation/validity/physical/commercial/continuity weights 10/35/25/20/10%; missing dimensions propagate null |
| CCI | Token activity/repayment/customer/economics/continuity weights 40/25/15/10/10%; complete dimensions required; weighted score multiplied by ten |
| Grade | Veto → D; otherwise A ≥800, A- ≥750, B ≥650, C ≥500, D below; null if uncomputable |
| Integrity | Findings and unverified indicators separate from confirmed hard events; only confirmed Sybil/evidence tampering/related-party manipulation with required independent provenance can trigger veto |
| Facts/session | F1–F12 explanation facts assembled from intake/results; in-memory sessions (30-minute TTL, max 100); no durable research Claim Store |
| Public API | `/api/v1/assess`, canonical data envelope, shared schema, optional independent model consent, auth/size/rate/timeout/idempotency guards |
| Finch | Same authoritative input/assessment, versioned compatibility contract and canonical fingerprints; hashes do not establish authenticity |

## Public-company compatibility constraints

The accurate overdue field is **overdue30Pct**, not overdue30d. Revenue/compute spend require the scoring window and operator scope; quarterly consolidated revenue is only related context. Cost of revenue is not equivalent to compute spend. Top-1/Top-3 concentration is not Top-5. Incorporation age is not operating history covered by available records. Current exposure is counterparty exposure, not issuer debt. Quarterly financial series cannot become the required six contiguous monthly Token/revenue/compute rows.

SEC/company publication establishes source traceability, not independent billing, telemetry or bank verification. Risk factors, litigation and financial reporting weaknesses must not be converted into confirmed hard events. No new Research code may call the assessment server, execute the risk engine, mutate sessions or change existing contracts/UI.
