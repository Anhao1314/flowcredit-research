# Target-Bound Evidence Conversion v0.11.3 — A–X delivery

**EVIDENCE ACQUISITION READY**. No Claim Revision, LLM-Wiki, Thesis, Multi-Agent or UI work.

## A. Push confirmation for c2e4e18

The clean complete v0.11.2 delivery c2e4e183fa197e24b222a4fb35a8b9548fe9c6fd was pushed to origin/main before implementation; remote main was independently verified with git ls-remote. Production upstream remains push-disabled. Historical artifacts and SELECTOR READY are unchanged.

## B. Pre-code post-ranking loss audit

14 Top-3 reachable cases / 5 strict conversions / 9 losses. {"CATEGORY_ERROR":1,"COMPOUND_LITERAL_ERROR":1,"INTERPRETATION_ERROR":3,"PARSER_ERROR":1,"TARGET_MISMATCH":3}. Full preserved interpretation/parser/validator/Candidate traces are in historical-traces.json; no unvisited rank outputs are fabricated.

## C. Files changed

- research/target-conversion/REPOSITORY_AUDIT.md: offline per-case and table/text diagnosis.
- research/target-conversion/research-plan.json: versioned answer-free production research requests; evaluator-only case linkage.
- research/target-conversion/domain.js: existing categories and real metric/concept registry with explicit row mappings.
- research/target-conversion/contract.js and three *.schema.json: ResearchIntent, TargetBoundInterpretation and Candidate binding sidecar.
- research/prompts/target-bound-interpretation-v1.txt: one version of the bounded semantic-match/raw-fact prompt.
- research/target-conversion/checks.js: category/concept, unit family, assertion kind, exact request dimension and known period checks.
- research/target-conversion/extraction.js: exact named-clause compound literal selection and unique identical-token source whitespace copying, with source proofs.
- research/target-conversion/layer.js: bounded rank 1→2→3 target conversion using frozen grounding/parsers/Validator/proposal/Candidate rules.
- research/target-conversion/context.js: offline frozen workspace loading.
- research/target-conversion/cli.js: offline dev, freeze registration, one real conversion-only run, receipts, progress/resume, safety and strict evaluator.
- research/target-conversion/eval.js: strict primary gate, zero wrong-target and complete fixed denominators.
- research/target-conversion/replay.js: unchanged historical count/trace verification.
- research/target-conversion/fixtures.js, synthetic-dev.py, dev.js: independently constructed synthetic development matrix.
- research/target-conversion/report.js and README.md: deterministic reporting and local workflow.
- research/target-conversion-test/*.test.js and agent/test/target-conversion.test.js: offline protections and mandatory CI integration.
- research/eval/target-conversion/*.json: audit, dev, pre-registration, locked results and resource/cost/push proof.
- docs/target-bound-evidence-conversion-v0.11.3.md and DELIVERY.md: full measured delivery.
No modifications to frozen frontend, public API contracts, retrieval, ranking, handles, grounding, SourceSupport, parsers, Validator, EvidenceProposal, Admission, Claims or existing history.

## D. ResearchIntent contract

`research-intent/v1`: intentId, subjectId, targetKind, targetCategory, targetMetricOrConcept, timeScope(kind/start/end), optional explicit geography/customer-label dimension, actualOrGuidance, explicitOrDerived, createdAt. Finite production categories/concepts, exact date semantics, additionalProperties=false. No values, normalized answers, expected spans/Evidence IDs or Gold. Customer labels are period-local dimensions, not persistent identities.

## E. TargetBoundInterpretation

`target-bound-interpretation/v1`: targetMatch supported/not_supported/ambiguous plus fact. Only supported may carry the frozen raw-fact fields; other matches require fact:null. The model proposes semantic relevance and raw explicit interpretation only. Normalization, support identity, provenance and Candidate acceptance stay deterministic.

## F. Deterministic target checks

Known category/concept compatibility; requested actual/guidance and explicit/derived; known exact period window or as-of; unit family of the requested measure; source identity/hash/subject/availability. No complex semantic guessing. Explicit named-clause value ownership prevents borrowing a different metric’s literal from the same sentence. Unknown row/phrase semantics remain a restricted model proposal.

## G. Table target binding

Known row/header mismatches and requested geography/customer row dimensions reject before a model call. Wrong table periods and unit families also reject first. The immutable table parser owns cell/unit/header extraction. Null raw fields are required by the prompt, not model-reconstructed table prose. Explicit disclosed cells and percentages are not analyst-derived merely because the issuer calculated them. Missing semantic metadata is not deterministically invented.

## H. Text target binding

One supplied sentence stays unchanged. The model must answer the requested measure, not another financial fact. Percentage growth cannot become a dollar change; customer revenue share cannot become receivables concentration. Unique identical-token source whitespace binding copies actual PDF line breaks; digits, dates, words and scales are never changed. All resulting raw fields still pass frozen exact-source parsing/validation.

## I. Compound literal handling

`exact-local-extraction/v1` can choose one literal only when an explicit named local clause uniquely binds the requested concept to that literal and its unit is source-bound. A proof records exact quote, anchor, offsets and support/hash. Respectively alignment, shared missing scales, unknown semantic anchors and ambiguous periods abstain. Joint three/six-month sensitivity remains constrained by the immutable parser and numeric risk-disclosure Validator; no coercion to actual.

## J. Dev fixtures

21 independent deterministic cases, passed=true; no Qwen/embedding calls or real smoke. correct-table-target, wrong-fact-same-span, two-metrics-target-binding, wrong-literal-same-span, guidance-is-not-actual, explicit-guidance, right-category-wrong-period, right-period-wrong-metric, table-row-mismatch, compound-explicit-clause, compound-respectively-no-guess, ambiguous-support, no-target-support, rank-fallback, unit-guess-rejected, derived-not-coerced, untrusted-source-injection, wrong-subject, future-source, rank-three-stop, tampered-source.

## K. Historical replay

Historical strict 5/16, generic 11/16, valid-but-wrong-target 6/16, post-ranking loss 9 among 14 reachable. Replay preserves old attempts and decisions verbatim; new rules do not retroactively count conversions.

## L. Locked ranking ceiling

Frozen retrieval ceiling 15/16; ranked Top-3 ceiling 14/16, maximum theoretical success 14/16. Stored ranked handles are reused exactly. No retrieval, embedding, ranking or selector A/B/C rerun; no denominator exclusion.

## M. Locked strict target conversion

11/16 = 68.75%; pre-registered floor 10/16. Every success requires legal source/parse/Validator/Candidate, intent gates, expected Gold support and the unchanged strict numeric/unit/period/category scorer. Gold is evaluator-only and never drives fallback.

## N. Conditional target conversion among Top-3 reachable cases

11/14 = 78.57%; pre-registered floor 10/14. Fixed denominator 14.

## O. Valid-but-wrong-target Candidate count

0, compared with historical 6. Pre-registered maximum 0. A valid-but-wrong-target Candidate is never target success and also fails the real-run false-accept hard gate.

## P. Generic Candidate conversion (secondary)

11/16. Strict target conversions by fallback depth: rank 1 8/16; rank≤2 10/16; rank≤3 11/16. candidateFoundAtRank is 1/2/3/null. Each accepted Candidate has a persisted sidecar binding intentId/version/hash, targetMatch, sourceSupportId/hash and rankUsed.

## Q. Failure taxonomy

{"TARGET_MISMATCH":0,"INTERPRETATION_ERROR":0,"COMPOUND_LITERAL_ERROR":1,"CATEGORY_ERROR":0,"PARSER_ERROR":2,"VALIDATOR_REJECT":0,"SUPPORT_AMBIGUOUS":0,"UNKNOWN":0,"RETRIEVAL_MISS":1,"RANKING_MISS":1,"INVALID_SELECTION_HANDLE":0,"PROVIDER_TIMEOUT":0,"PROVIDER_ERROR":0}

## R. Latency

Frozen historical ranking median 3.70 s, new ranking calls 0. Target-match plus interpretation median 7.05 s, p95 17.44 s. These operations share one model call; separate latency is unavailable and is not invented or added twice. Parser/Validator median 0.01 s. Conversion end-to-end median 13.14 s, p95 44.90 s, excluding frozen offline retrieval/ranking.

## S. Safety

{"fabricatedSupport":0,"invalidHandle":0,"sourceFidelity":1,"falseAccept":0,"futureLeakage":0,"wrongSubject":0,"claimMutation":0,"providerTimeout":0,"providerError":0}. No parser, unit, period or Validator weakening. Source identity is exact; no fuzzy handle repair. Intent mismatch/ambiguity prevents Candidate creation. Real source semantics are still a constrained model proposal, not a deterministic proof of arbitrary finance. Synthetic injection boundary is tested offline; no separate real injection or cloud benchmark was run.

## T. Claims protection

Claims 4→4; revisions 4→4; unchanged=true. Payload hash sha256:893ea5e78b0dd6332bf7c239c53cf9ffd9233bf9471478d77d89274ffcfc60a3. No Evidence or Admission writes and no Claim Revision.

## U. Paid API proof

paidInferenceApiCostUsd=0; paidEmbeddingApiCostUsd=0; paid inference/embedding API calls=0. Locked local calls 25, input 25904, output 1991, total 27895. Existing loopback-only Ollama provider with remote guard; cloud disabled.

## V. Resource usage

{"offlineDevelopment":true,"realSmokeCases":0,"realLockedCases":16,"retrievalCalls":0,"embeddingCalls":0,"rankingCalls":0,"interpretationCalls":25,"modelStartedOnlyAfterGate":true}. Ollama was off during offline diagnosis, dev and all pre-run gates; started only after registration 2026-09-14T07:25:12.848Z. One conversion-only locked run, no real development smoke, no embedding/ranking calls, no larger/cloud models, no fine-tuning. Completed cases resume with gate/code/history/schema/provider drift checks. caffeinate covers the real run. Ollama was stopped after completion; loopback port 11434 has no listener.
Observed sampled Ollama/runner RSS peak 6.10 GiB on Apple M5, 16 GiB RAM. Sampling begins at 2026-09-14T07:25:55.995Z; it does not include the earliest cold-load peak.

## W. Regression

Before real inference: 123 agent tests and 6 target-conversion tests (21 dev scenarios), syntax, frontend discipline, isolation and full verify-release PASS. After the locked run: 124 agent tests and 7 target-conversion tests PASS, including locked artifact/gate/code/history/sidecar consistency. Syntax (191 JS files), frontend discipline, development isolation and complete verify-release PASS. CSS and all frontend/frozen code remain unchanged.

## X. Decision

**EVIDENCE ACQUISITION READY**. The strict primary capability, zero wrong-target and all safety hard gates pass. A later stage may consider Claim Revision Proposal; this delivery does not start it.

## Locked per-case result

|Case|Top-3 target rank|Candidate rank|Strict target|Failure|Model calls|
|---|---:|---:|---:|---|---:|
|GOLD-01|1|1|yes|NONE|1|
|GOLD-02|1|1|yes|NONE|1|
|GOLD-03|1|1|yes|NONE|1|
|GOLD-04|1|1|yes|NONE|1|
|GOLD-05|1|1|yes|NONE|1|
|GOLD-06|2|null|no|COMPOUND_LITERAL_ERROR|3|
|GOLD-07|1|1|yes|NONE|1|
|GOLD-08|3|null|no|PARSER_ERROR|2|
|GOLD-09|1|1|yes|NONE|1|
|GOLD-10|1|null|no|PARSER_ERROR|3|
|GOLD-11|miss|null|no|RETRIEVAL_MISS|2|
|GOLD-12|1|1|yes|NONE|1|
|GOLD-13|3|3|yes|NONE|2|
|GOLD-14|2|2|yes|NONE|2|
|GOLD-15|miss|null|no|RANKING_MISS|1|
|GOLD-16|2|2|yes|NONE|2|
