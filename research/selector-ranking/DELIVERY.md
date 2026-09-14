# v0.11.2 delivery report

Decision: **SELECTOR READY**. No Claim Revision, deployment, release, or production push.

## A. Historical metric audit

v0.11: 81 selections / 12 target hits / 69 non-target selections; precision 14.81%, non-target rate 85.19%, average 5.06. Historical relevance rank and Hit@1 unavailable.
v0.11.1: 52 selections / 8 target hits / 44 non-target selections; precision 15.38%, non-target rate 84.62%, average 3.25. Historical relevance rank and Hit@1 unavailable.

## B. Retrieval-only ranking baseline

Locked K=8: Hit@1 6.25%, Hit@2 31.25%, Hit@3 43.75%, Hit@5 50.00%, Hit@8 93.75%, MRR 0.3075. Offline calculation; retrieval parameters unchanged. Full dev baselines in retrieval-only.json; exact-label comparison below.

## C. Files changed

- research/selector-ranking/REPOSITORY_AUDIT.md: pre-code inputs, per-case breadth, correlation, rank audit and label limitations.
- research/selector-ranking/contract.js and ranking-output.schema.json: ordered unique dynamic handles, max 3, exact validation.
- research/prompts/span-ranking-handles-v1.txt: one requested-fact ranking prompt.
- research/selector-ranking/layer.js: isolated selection policies and bounded ordered interpretation/validation/Candidate fallback.
- research/selector-ranking/cli.js: dev A/B/C and one registered locked policy, immutable-data replay, progress, resume, drift checks, cost/safety metrics.
- research/selector-ranking/security.js: two guaranteed-exposure hostile-source fixtures, local receipts and Claims snapshots.
- research/selector-ranking/audit.js: offline historical totals and retrieval metrics verification.
- research/selector-ranking/README.md: local execution and resume instructions.
- research/selector-ranking/report.js: deterministic result and A–U report rendering.
- research/selector-ranking-test/contract.test.js, layer.test.js and artifacts.test.js: metrics, gate, exact handle validation, bounded fallback, support filtering.
- agent/test/selector-ranking.test.js: runs ranking regressions in mandatory CI.
- research/package.json: ranking CLI and test scripts.
- research/eval/selector-ranking/*.json: historical metrics, baselines, development, pre-registration, injection, locked results.
- docs/evidence-selector-ranking-v0.11.2.md and DELIVERY.md: rationale, measured outcomes and complete delivery.
Frozen frontend, retrieval, grounding, support, validator, proposal, Admission, Claims and provider implementations: zero modifications. API version identifiers unchanged.

## D. Ranking contract

`{"rankedHandles":["S4","S7","S2"]}`; smallest ordered direct-support set; [] allowed. No confidence or canonical hashes.

## E. Dynamic handle schema

`ranked-handles/v1`: current available S1..S8 enum; maxItems 3, uniqueItems true, additionalProperties false; exact deterministic S→SourceSpan mapping, no fuzzy repair.

## F. Development A/B/C

|Arm, 17 exact answer-free positives|Hit@1|Hit@2|Hit@3|MRR|Precision|Average|Abstention|
|---|---:|---:|---:|---:|---:|---:|---:|
|retrieval|41.18%|64.71%|82.35%|0.6221|22.79%|8.00|0.00%|
|multi|unavailable|unavailable|unavailable|unavailable|23.26%|2.53|29.41%|
|ranked|64.71%|94.12%|100.00%|0.8137|50.00%|2.47|0.00%|

Two page-fallback labels and two negative queries without document targets are explicitly excluded from the exact positive comparison. Retrieval arm reports all K=8 rank entries; that breadth is not an LLM selection. Multi-select has no relevance ordering.

## G. Frozen policy

span-ranking-handles/v1; ranked-handles/v1; sha256:2b1b338d42ca0fc20991d1b69aedd6348c795dd37b44b21afeedf5152be66ba9. Registered 2026-09-14T06:58:46.536Z before locked inference. Only ranked policy ×16 locked Gold. Require MRR uplift ≥0.05 and Hit@1 uplift ≥0.0625; all safety and injection gates pass. Model qwen3.5:9b / Q4_K_M / non-thinking / temperature 0; unchanged digest, context 8192, 60 s call deadline; Hybrid K=8. Code and development hashes bind the run.

## H. Locked Hit@1 / Hit@2 / Hit@3

56.25% / 75.00% / 87.50%. Compatibility target-anywhere hit 87.50%.

## I. MRR

Qwen 0.6979 versus retrieval 0.3075; absolute uplift 0.3904. Hit@1 uplift 50.00%. Development and locked are separate evidence sets; no repeated locked runs or post-lock prompt tuning.

## J. Selection precision

14/42 = 33.33%; 28 non-target selections.

## K. Average selected handles

2.63; abstention 0.00%; hard output maximum 3.

## L. Rank-1 / Rank≤2 / Rank≤3 conversion

Any legal Candidate: 8/16 / 11/16 / 11/16. Gold target-semantic conversion: 4/16 / 5/16 / 5/16. Total target conversion 5/16. An unrelated valid fact is never target success. targetScore preserves the existing pre-conversion scorer; outer targetConverted and candidateFoundAtRank are authoritative conversion fields.

## M. Retrieval miss

GOLD-11

GOLD-11 remains the frozen retrieval miss; no retrieval repair or tuning.

## N. Ranking miss and failure taxonomy

{"INTERPRETATION_ERROR":4,"NONE":5,"PARSER_ERROR":5,"RETRIEVAL_MISS":1,"RANKING_MISS":1}

## O. Latency

Ranking median 3.70 s / p95 4.68 s. Processing total median 19.49 s / p95 39.67 s, excluding offline retrieval. Historical frozen retrieval query median 33.17 ms / p95 228.95 ms (v0.11); current retrieval replay latency unavailable.
Rank 1 interpretation: 16 calls; median 11.31 s, p95 13.41 s.
Rank 2 interpretation: 8 calls; median 11.89 s, p95 12.87 s.
Rank 3 interpretation: 4 calls; median 9.97 s, p95 10.61 s.

## P. Token usage

Locked: 44 calls, input 35352, output 2669, total 38021. Development: 34 calls, input 28620, output 616. Injection: 4 calls; per-call token and phase receipts in injection.json. Warm-up was not run; no unreported benchmark inference calls.

Development retrieval: 0 model calls, input 0, output 0; offline processing median 0.07 ms. Retrieval arm processing is cached-rank lookup, not new retrieval query latency.
Development multi: 17 model calls, input 17514, output 388; offline processing median 2101.24 ms. Retrieval arm processing is cached-rank lookup, not new retrieval query latency.
Development ranked: 17 model calls, input 11106, output 228; offline processing median 2049.62 ms. Retrieval arm processing is cached-rank lookup, not new retrieval query latency.

## Q. Safety

{"invalidHandle":0,"fabricatedCanonicalSupport":0,"sourceFidelity":1,"falseAccept":0,"futureLeakage":0,"wrongSubject":0,"claimMutation":0,"timeout":0}
Injection passed: true. All offered/selected supports preserve exact identities; converted facts are rechecked with unchanged support/fact validators. No provider errors tolerated for readiness. Historical evaluator Gold-prioritized promotion and fixed-zero false-accept summaries remain unchanged; current strict ranking and contract rechecks do not use Gold for fallback or admission.

## R. Claims protection

Locked Claims unchanged: true; injection unchanged: true. Read-only identity/revision snapshots prove integrity. No Admission or Evidence writes.

## S. Paid API proof

paidInferenceApiCostUsd=0; paidEmbeddingApiCostUsd=0; paidInferenceApiCalls=0; paidEmbeddingApiCalls=0. Only loopback Ollama transport with remote guard, no cloud inference or new embedding calls.

## T. Regression

Eight ranking regressions; exact resolution/schema, honest metrics, value/safety decision, hidden canonical IDs, ordered fallback, hard rank-3 stop and wrong-subject/future rejection. Mandatory syntax, frontend discipline, isolation, agent tests and verify-release gates run; 117 agent tests and 8 focused ranking tests passed; full verify-release gate passed. CSS unchanged; brace balance checked. No frozen-area edits.

## U. Decision

**SELECTOR READY**. The registered MRR and Hit@1 uplifts pass on locked evidence, confirming independent development ranking gains; safety and injection hard gates pass. Keep ranking in the research architecture where it adds measured discrimination. This is a small exploratory benchmark, not production rollout authorization.

## Locked case details

|Case|Target rank in retrieval|Target rank in Qwen|Selected|Candidate rank|Target converted|Failure|
|---|---:|---:|---:|---:|---:|---|
|GOLD-01|6|1|3|1|no|INTERPRETATION_ERROR|
|GOLD-02|3|1|1|1|yes|NONE|
|GOLD-03|2|1|1|1|yes|NONE|
|GOLD-04|5|1|2|null|no|PARSER_ERROR|
|GOLD-05|2|1|3|1|yes|NONE|
|GOLD-06|6|2|3|null|no|PARSER_ERROR|
|GOLD-07|7|1|3|1|yes|NONE|
|GOLD-08|1|3|3|2|no|INTERPRETATION_ERROR|
|GOLD-09|3|1|3|2|no|PARSER_ERROR|
|GOLD-10|2|1|3|null|no|PARSER_ERROR|
|GOLD-11|miss|miss|3|null|no|RETRIEVAL_MISS|
|GOLD-12|7|1|3|null|no|PARSER_ERROR|
|GOLD-13|6|3|3|1|no|INTERPRETATION_ERROR|
|GOLD-14|8|2|3|1|no|INTERPRETATION_ERROR|
|GOLD-15|7|miss|3|1|no|RANKING_MISS|
|GOLD-16|2|2|2|2|yes|NONE|
