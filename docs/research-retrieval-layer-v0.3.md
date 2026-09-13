# Research Retrieval Layer v0.3 — delivery

## A. Pre-code audit

Confirmed clean HEAD/origin `842486c`. Read v0.1 schemas/fixtures/normalization/extraction/mapping/coverage, v0.2 SQLite/revision/correction/time/CLI/tests, both previous delivery reports and CI. Baseline 109 Agent + 25 Research + 49 Memory passed. Isolation/hook intact. [Pre-code audit](../research/retrieval/REPOSITORY_AUDIT.md).

## B. Files changed

| File | Change |
|---|---|
| `research/retrieval/REPOSITORY_AUDIT.md` | Baseline and pre-code decisions |
| `research/retrieval/README.md` | Setup, commands, algorithms and limitations |
| `research/retrieval/schema.json` | Separate Document/Chunk/Candidate/HybridResult contracts |
| `research/retrieval/validation.js` | New schema validation through locked Ajv |
| `research/retrieval/parser.js` | Uniform PDF adapter/HTML parser, original hash and availability validation |
| `research/retrieval/pdf-parser.py` | Faithful pinned text-layer extraction |
| `research/retrieval/requirements.txt` | Isolated PyMuPDF dependency |
| `research/retrieval/chunker.js` | Versioned stable addressable chunks |
| `research/retrieval/index.js` | Independent transactional immutable SQLite index |
| `research/retrieval/lexical.js` | BM25/abstention |
| `research/retrieval/semantic.js` | Provider interface/versioned cache/test provider |
| `research/retrieval/fusion.js` | Deterministic RRF |
| `research/retrieval/layer.js` | Search/time/subject filtering, Candidate and citation validation |
| `research/retrieval/memory-lookup.js` | Read-only accepted Source/Evidence/correction/Claim lookup |
| `research/retrieval/corpus.json` | Scoped accepted timestamps and excluded release |
| `research/retrieval/corpus.js` | Explicit local corpus indexing |
| `research/retrieval/eval.js` | Fixed-query metrics/full eligible MRR/top-five safety |
| `research/src/retrieval.js` | JSON index/search/candidate/eval CLI |
| `research/retrieval-test/fixtures.js` | Explicitly synthetic fixtures |
| `research/retrieval-test/retrieval.test.js` | 49 regressions |
| `research/eval/coreweave/queries.json` | 21 fixed real queries and Evidence recovery IDs |
| `research/eval/coreweave/benchmark.json` | Actual metrics/rankings, including misses |
| `research/package.json` | Add CLI/test scripts |
| `research/README.md` | Link independent retrieval layer |
| `agent/scripts/check-syntax.js` | Include new JS/tests |
| `agent/scripts/verify-release.js` | Add Retrieval gate |
| `.github/workflows/ci.yml` | Pinned Python dependency/tests, read-only token |
| `docs/research-retrieval-layer-v0.3.md` | This delivery report |

## C. Architecture

Raw Source → Document → addressable Chunk → separate index → lexical/semantic → RRF → EvidenceCandidate → citation validation → STOP. Retrieved text is not a normalized reviewed fact; relevance is not confidence; valid citation is not acceptance or a Claim. No accept/Claim writer exists. `--memory-db` uses read-only SQLite and returns accepted Memory separately with Audit semantics.

Index schema version 3 is independent of Memory version 2, with distinct document/chunk/embedding/candidate kinds, hashes, parent FK and immutable triggers. Per-document indexing is atomic/idempotent and retains first knowledge times. Runtime/raw files/dependencies stay outside Git at `/Users/yimingyang/fc-agent/research-retrieval/`.

## D. Parser

PDF: PyMuPDF 1.26.5 `get_text('blocks', sort=True)`, text blocks only, one-based pages/rectangles, no numeric rewriting; version `pdf-blocks-pymupdf-1.26.5/v1`. HTML: `html-addressable/v1`, entity decoding, headings/table separators, original markup ranges. No OCR/LLM/summary. Textless/encrypted/unsupported input fails. Both actual PDF hashes match v0.1; revenue/concentration pages were rendered and checked. Release SEC/IR raw downloads returned 403 and remain excluded, never replaced with summary text.

PDF locators are coarse page rectangles; offsets address parsed text, not compressed bytes. Multi-column/table reading order remains a limitation. HTML tokenizer is static and not a complete HTML5/CSS/browser parser. Raw corporate documents are not redistributed.

## E. Chunk strategy

`page-section-lines/v1`: maximum 6,000 UTF-16 code units, overlap ≤400, line boundaries preferred, no cross-page/HTML-unit chunks, preserve surrogate pairs. Most table pages fit intact; long tables can split and need review. IDs depend on Source ID, original hash, parser/chunker version, locator/offset and text hash. Section metadata preserves found headings or explicit page context, never generated narrative.

## F. Temporal model

`documentDate` remains descriptive filing/signature date, not inferred availability. Separate Research Document sidecar `availableAt` records scoped market availability, nullable unknown. `retrievedAt` is actual raw receipt/verification at indexing; `createdAt` is first index record. Accepted Source/Memory payloads and schemas are unchanged.

Audit requires retrievedAt AND createdAt ≤ cutoff. Replay requires known availableAt ≤ cutoff, never writes historical Memory. Unknown excludes Replay. Filter before corpus statistics, semantic scoring, fusion and Candidates. Date-only means UTC end-of-day.

Annual [SEC accepted](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/0001769628-26-000104-index.htm): March 2 16:14:01 **EST** →2026-03-02T21:14:01Z. Annual wrapper pages 1–6 are omitted; first indexed page 7 is filing cover. Wrapper availability remains unknown. Q2 [SEC accepted](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000366/0001769628-26-000366-index.htm): August 11 19:24:42 **EDT** →2026-08-11T23:24:42Z, despite filing-date field August 12. These timestamps describe reproduced filing content, not first publication of the IR PDF URLs.

## G. Lexical

BM25 k1=1.2/b=.75; fixed Unicode tokens/English stopwords, no stemming. IDF log(1+(N-df+.5)/(df+.5)). Subject/time-eligible corpus only. Require ≥60% distinct query-term coverage AND score ≥.05 or abstain. Scores are relevance, never confidence. Incidental word matches may remain irrelevant; this threshold is not proof that no fact exists.

## H. Semantic

Independent synchronous embed interface and provider/model/dimension/embeddingVersion/kind metadata; finite vectors/hash checks and cosine minimum .30. Included provider: deterministic-fixture / concept-bag / 12 / test/v1, explicitly test-only, not trained semantics. No real provider/key configured. CLI semantic is unavailable; hybrid reports lexical_only degradation. Tests demonstrate synonym recovery/cutoff without fabricating real-model benchmark results.

## I. Fusion

RRF k=60: Σ 1/(60+rank_method); absent ranks contribute zero. Stable Chunk-ID ties. Return lexicalRank, semanticRank, hybridScore, finalRank. No complex/LLM reranker.

## J. Actual CoreWeave benchmark

2 original PDFs → 2 Documents / 288 Chunks / 0 real embeddings (annual 162, Q2 126). Reindex inserted=false for both; accepted Memory remains 3 Sources/32 Evidence/4 identities/4 revisions.

21 queries (19 positives/2 negatives), required categories covered. Ground truth fixed before benchmark; provisional page references corrected by PDF inspection before metric execution, never in response to scores. Recall is per-positive-query expected-location hit rate. MRR uses complete eligible rankings (288 chunks, implementation cap 1,000). Citation/safety metrics use top five. Existing Evidence IDs are included where the exact indexed Source/page exists.

| Method | Recall@1 | Recall@3 | Recall@5 | MRR |
|---|---:|---:|---:|---:|
| Lexical, actual documents | .4211 | .8421 | .8421 | .6128 |
| Semantic, unconfigured | N/A | N/A | N/A | N/A |
| Hybrid, lexical-only | .4211 | .8421 | .8421 | .6128 |

Each enabled baseline returned 92 top-five passages: citation validity 100%, future leakage 0, wrong subject 0, negatives abstain 2/2. Hybrid did not improve lexical. Controls/cash/CapEx targets were outside top five or unretrieved; misses remain in [benchmark.json](../research/eval/coreweave/benchmark.json). Accepted release Evidence is not falsely recovered through another Source. Dedicated future/unknown/other-subject tests supplement this small benchmark; it alone does not prove broad quality/safety.

## K. Negative behavior

`daily billed inference token reconciliation coverage` → insufficient_evidence, zero results. `quantum unicorn burn reconciliation` also abstains. No answer/accepted fact is synthesized.

## L. Two-date cutoff demo

Same Lexical Replay query `customer concentration`:

- June 30: top five only annual `SRC-537a3ecf4fe45a1032e9b9b2`, pages 100/101/26/37/30. Q2 is ineligible everywhere, not merely outside top five.
- September 13: annual pages 100/101/26 plus Q2 `SRC-093bb8c380a4603f1bae97f8`, pages 61/66.

Synthetic June/August Source tests validate lexical, semantic, hybrid and Candidate cutoff at July, including unknown availability. Audit before September indexing returns zero; Replay never modifies accepted knowledge history.

## M. Citation validation

Candidate CANDIDATE-cadb80c1c8d80ebcd9f9eaa0 from `Microsoft revenue 67`, Chunk CHUNK-459628441b923d19deef40e6: annual PDF page 26, rectangle [0,0,612,792], parsed unit 19 offsets 0–5681 → valid, no errors. Fabricated quote → invalid (candidate_identity, quote_not_in_chunk).

Schema/identity, Source/Chunk existence, subject, quote, locator, hashes, reconstructed Chunk, original raw bytes and reparsed units/text are checked. Raw bytes remain checked even when parsed verification is session-cached. Invalid candidates never persist. Recomputed forged text hashes do not bypass original reparse. Citation integrity is not financial truth/acceptance.

## N. Regression acceptance

Final results: Agent **109/109**, Research v0.1 **25/25**, Memory v0.2 **49/49**, Retrieval v0.3 **49/49**. Retrieval also passes **49/49 on official Node 22.19**; current runtime is Node 24.19. Syntax (96 JS files), frontend discipline (17 files), isolation (184 files/one workflow), external TypeScript and full verification all pass, including Public API/Finch contracts, secret/artifact scans and local smoke/graceful shutdown. No remote CI run or external-user validation is claimed. New tests cover parsing/stability/locators, lexical/Evidence recovery ground truth, semantic/test metadata, RRF, all-method future filtering, negative/citation/subject isolation, idempotent indexing/embeddings/Candidates, CLI process persistence and read-only accepted Memory lookup. No skips.

## O. Deliberately not implemented

Auto Evidence Write; Evidence acceptance; Claim Mutation; LLM Claim Generation; RAG Chat; LLM-Wiki; Thesis Memory; Multi-Agent; New Risk Engine; TAI/CCI/grade changes; Public API/Finch changes; UI changes; production behavior changes; Deployment. No crawler/source replacement/real semantic service/operational backup certification. All frozen frontend/agent source/contracts/existing tests and v0.1/v0.2 domain modules unchanged.

## P. Recommended next step

Evidence acceptance workflow first: reviewable quote, unit/period proposal and provenance checks followed by explicit human acceptance into existing Evidence schema, without Claim mutation. Include lexical misses, unconfigured real semantics and coarse PDF locators as validation dependencies. This recommendation is not implemented.

## Freeze/Git acceptance

Zero diff against 842486c in assets/, index.html, AGENTS.md, agent/src, agent/contracts, agent/test, Research v0.1 schemas/rules/fixtures/tests and v0.2 memory/memory-test. Existing coverage/normalization/Claim logic unchanged; only new retrieval CLI added under research/src. CSS unchanged and braces remain balanced. Upstream push disabled, production-blocking hook executable; only origin receives the development commit. No raw documents, SQLite files, packages, keys or runtime logs committed.
