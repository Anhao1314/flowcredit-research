# FlowCredit Evidence Admission Layer v0.4

## A. Pre-code audit

Baseline: `19871f6`. Read the actual v0.1 schemas/extractor/normalization, v0.2 SQLite immutability/correction/time/provenance, v0.3 Candidate/citation/retrieval/eval/CLI, CI and documentation before coding. See [repository audit](../research/admission/REPOSITORY_AUDIT.md). Actual Candidates have query IDs and null proposed fact fields; they are not formal Evidence. Existing strict Evidence contracts cannot accept extra admission fields. Admission therefore adds an independent relation, not a replacement Evidence schema.

Retrieval finds a passage; citation validation proves its identity/location, not correct metric, unit, period, materiality or admissibility. Retrieved Chunk ≠ Candidate ≠ accepted Evidence ≠ Claim.

## B. Files changed

| File | Delivery |
| --- | --- |
| research/admission/REPOSITORY_AUDIT.md | Actual pre-code contract and storage audit |
| research/admission/README.md | CLI, authority, mapping, time and limitations |
| research/admission/schema.json | Independent strict Review/fact input schemas |
| research/admission/validation.js | Schema validation using existing locked dependency |
| research/admission/mapping.js | Literal mapping, existing deterministic normalization and fact identity |
| research/admission/layer.js | Explicit review, revalidation, history, deduplication, queue and deep lineage |
| research/memory/sqlite-backend.js | Additive optional admission participant on existing SQLite transaction |
| research/src/admission.js | Explicit single-candidate human CLI and read queries |
| research/admission-test/fixtures.js | Isolated test-capability fixtures |
| research/admission-test/admission.test.js | 56 boundary, concurrency, CLI and regression tests |
| research/admission/experiments/coreweave-recovery.json | Deterministic existing-Evidence recovery summary |
| research/admission/experiments/synthetic-admission.json | Controlled new-admission/rejection/lineage summary |
| research/README.md | v0.4 documentation link |
| research/package.json | Admission CLI/test scripts; existing package version retained |
| agent/scripts/check-syntax.js | Include new JS directories |
| agent/scripts/verify-release.js | Include Admission suite in complete gate |
| .github/workflows/ci.yml | Add Admission suite to existing read-only CI |
| docs/evidence-admission-layer-v0.4.md | This acceptance record |

No changes to frozen UI/assets/index/AGENTS, agent source/contracts/tests, v0.1 schemas/fixtures/rules/tests, v0.3 retrieval/parser/chunks/BM25/provider/eval/ground truth/benchmark. The Memory backend change is explicitly additive, not a claim of zero Memory edits. No external runtime database/raw source/dependency/key is delivered.

## C. Admission architecture

Candidate → fresh validation → explicit Review → accepted v0.1 Evidence or rejected history. Admission imports no Claim builder/writer, risk engine or model harness. Existing concise Claim → Evidence → Source provenance remains unchanged.

The optional SQLite participant lazily adds immutable `admission_reviews` and `admission_fact_links` to the same Memory database, retaining existing records/links and user_version=2. Evidence, Review and duplicate link share one write transaction and roll back together. Foreign keys bind accepted Reviews to Evidence; UPDATE/DELETE triggers protect history. Retrieval is held in a read snapshot. Final fresh original-byte/reparse checks and full snapshot comparison run immediately before journal append. Concurrent independent processes converge on one Evidence/Review for identical requests.

## D. Review schema and authority

Review records: id, candidateId, subjectId, version, previousReviewId, decision, reasonCode, reviewerType/id, reviewedAt, note, candidateHash, requestHash, validationSnapshot, Source/Document/Chunk/Candidate snapshot, resultingEvidenceId, factKey, mapping, availableAt, candidateCreatedAt, acceptedAt, evidenceMemoryCreatedAt, outcome and recordedAt. Accepted decisions reference Evidence; rejected decisions do not. Reasons include verified_primary_source/verified_existing_evidence and all structured rejection reasons required by the task.

Real CLI writes require explicit human, reviewer identity, subject, Candidate hash, reason and note. There is no system_test CLI flag, agent/LLM/policy authority, quote editing or batch accept. `allowSystemTest:true` is an explicit programmatic capability only for isolated tests. Demonstrations below are system_test simulations, not actual human decisions.

Security boundary: local human identity is self-asserted, not authenticated multi-user authorization. Agents/LLMs may propose outside this layer; only an explicit trusted human invocation admits real facts. Future trusted policy is not implemented. A caller with writable database access can bypass application policy. Immutable triggers/hashes are integrity controls, not protection from an adversarial filesystem owner. Older Memory writers ignore the additive relation and must not be used to bypass Admission workflow.

External raw files cannot be locked by SQLite. Final checks plus copied reviewed snapshots identify the admitted bytes/passage; changing a file after the final check is a known OS boundary. Future operations revalidate; committed history remains intact. No global filesystem atomicity/security certification is claimed.

## E. Candidate lifecycle and rejection memory

Pending → accepted/rejected derives from the latest visible immutable Review. Invalid current citations overlay stale only on pending items; workflow state and citation validity are separate. Explicit re-review requires the exact latest supersedes ID and appends a version. An accepted Candidate cannot be remapped to another fact; generate another Candidate. Rejection after acceptance preserves the original Evidence and review; correction is a separate operation.

Queue filters cover subject, queryId, source, creation date, method, validation, state and as-of. Actual Candidate stores query ID rather than wording. History preserves rejected Candidate/Source/quote/reason/reviewer/time and validation. No rejection training or reranking. Historical queue state does not retroactively apply today's raw-file failure; its displayed validation is current, not archived. Review snapshots are the historical validation record.

## F. Duplicate policy and mapping

Identical latest review request is idempotent after fresh validation. Different Candidates with the same Source/canonical exact locator/quote/normalized semantics share Evidence; query, reviewer and confidence do not affect fact identity. First Evidence confidence is preserved. Existing accepted Evidence additionally matches exact Source/page and declared fact fields except confidence; ambiguous matches require a correct explicit Evidence ID. Original manual paraphrase/locator/hash are retained, never rewritten.

New Evidence statement is exactly the Candidate quote. Strict fact input requires literal raw value and existing supported normalization; unit scaling is recomputed. Unsupported boolean/structured/transformed facts fail closed. Without a fact input, only a pure quotation is stored, not an invented financial value. Confidence=1 for literal copying is not issuer truth or model calibration. Human review must establish contextual metric/unit/period; numeric occurrence alone is insufficient. Superseded Evidence cannot receive a fresh admission.

## G. Temporal model

| Time | Meaning |
| --- | --- |
| availableAt | Scoped Source content public availability; nullable, never replaced with acceptance date |
| candidateCreatedAt | Discovery in Retrieval |
| reviewedAt | Start of explicit review |
| acceptedAt | Successful completed admission/acknowledgment |
| evidenceMemoryCreatedAt | First actual Evidence ingest; may predate a new Review of existing Evidence |
| recordedAt | Completed immutable journal knowledge time |

Future Candidate/Document/public-time context and clock rollback fail closed. Review historical queries require recordedAt ≤ cutoff. Existing Memory historical state uses actual ingest time; a later acknowledgment does not backdate a fact. Replay passage eligibility still uses availableAt. Unknown availability remains unknown and is excluded from Replay, although explicit current review may admit it. observedAt and fact periods retain their actual source context, not today's date.

## H. New Evidence demonstration

[Synthetic result](../research/admission/experiments/synthetic-admission.json), explicitly imaginary Primary Source fixture: retrieve → Candidate → valid citation → system_test Review → new formal Evidence.

`CANDIDATE-ac2d18170881279b03f67dc8` → `REVIEW-40c2165969c5b0dd23584e5f` → `EVID-ce75956e86293f371e6c5d15`.

May 2026 revenue of 32 USD millions deterministically becomes 32,000,000 USD. availableAt=2026-06-01; candidateCreatedAt=2026-07-01T12:00Z; reviewedAt/acceptedAt=2026-09-13T12:00Z. One Source/one Evidence added, zero Claims/revisions. Runtime database and raw fixture remain outside the repository.

## I. Rejection demonstration

`CANDIDATE-e00f5e48dc52dcce47f1484b` has valid citation to that May passage but was proposed for June. `REVIEW-ee664ecd9af011f93e31ec33` rejects it with wrong_period and preserved context. Citation validity ≠ admissibility. No Evidence/Claim added by rejection.

## J. Existing CoreWeave recovery

[Recovery summary](../research/admission/experiments/coreweave-recovery.json): use existing fixed retrieval-eval queries/ground truth and literal supported facts; explicit isolated system_test reviews.

| Measure | Result |
| --- | --- |
| Reviewed | 13 |
| Matched existing | 13 |
| New Evidence | 0 |
| Duplicates | 0 |

Before/after: Sources 3/3, Evidence 32/32, Claim identities 4/4, revisions 4/4, corrections 0/0. Each candidate has its own immutable already_accepted Review and existing Evidence ID. No benchmark tuning. Existing lexical Recall@1=42.11%, Recall@3/5=84.21%, MRR=0.6128 remain baseline figures; real semantic provider remains unconfigured/unverified.

## K. Deep provenance and correction

Synthetic chain:

`EVID-ce75956e86293f371e6c5d15` → `REVIEW-40c2165969c5b0dd23584e5f` → `CANDIDATE-ac2d18170881279b03f67dc8` → `CHUNK-40b3a9654e5b328ecff39074` → `DOC-459fcdc772174ffdafe2400e` → `SRC-a7de48b7810bb01bcb9f8c2d`.

CLI provides review-history and deep-provenance with preserved snapshots. v0.2 correction/supersession remains the mechanism for erroneous accepted facts; Admission explains why entry was originally allowed. Both histories survive. Deep provenance follows known replacement/correction lineage back to original Admission, with as-of filtering, without changing the concise v0.2 API.

## L. No Claim mutation proof

CoreWeave before/after Claims 4→4 and revisions 4→4; synthetic 0→0 and 0→0. Admission has no Claim mutation API/import and tests assert unchanged counts/revisions. Accepting a Candidate cannot silently change a Claim.

## M. Regression and gates

Agent 109/109; Research 25/25; Memory 49/49; Retrieval 49/49; Admission 56/56, total 288. Admission also passes on external Node22.19 and Node24.19. Tests cover all rejection reasons, fresh validation/hash/stale/TOCTOU, atomic rollback, idempotency, cross-candidate/legacy duplicates, concurrent separate processes, strict actors/CLI/quote inputs, clocks/as-of, rejection history, correction/deep lineage and no Claim mutation.

Required syntax, frontend discipline, development isolation, complete existing Agent tests, complete release gate and external TypeScript check pass. Frozen differences and CSS brace balance are checked before submission. Complete release gate is a local verification script, not deployment or publication.

## N. Deliberately not implemented

Auto Accept; Agent Accept; LLM Review Authority; Claim Mutation; Thesis Memory; LLM-Wiki; Real Semantic Provider; Multi-Agent; Research Risk Engine; TAI/CCI changes; Public API changes; UI changes; Deployment. No trading, target price, portfolio, reranking or retrieval tuning. No authenticated multi-user review service or adversarial database security certification.

## O. Recommended next phase

Recommend **LLM-assisted Evidence Extraction**, separately scoped: current Candidates have no populated fact proposals, so human mapping still supplies metric/unit/period. A proposal-only extractor can reduce that work while retaining exact citation validation and human-only admission. It must never accept evidence or mutate Claims automatically. Real semantic performance and Claim Revision Proposal remain separate future work. This recommendation is not implemented.
