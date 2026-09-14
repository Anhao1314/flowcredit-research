# Evidence Selector Value & Ranking Calibration v0.11.2

This phase tests whether Qwen adds evidence ranking value after frozen Hybrid Retrieval. Source Grounding, SourceSupport, EvidenceProposal, Validator, Admission, Claim authority, canonical identities, exact SelectionHandle mapping, embedding, BM25, RRF, temporal/subject filters and K=8 remain unchanged. No frontend files or public API contracts change.

## Historical audit

The pre-code audit is `research/selector-ranking/REPOSITORY_AUDIT.md`; deterministic metrics are in `research/eval/selector-ranking/historical-metrics.json`. Historical decisions are preserved.

|Interface|Selections|Target hits|Non-target selections|Precision|Breadth/hit correlation|
|---|---:|---:|---:|---:|---:|
|v0.11 canonical|81|12/16|69|14.81%|0.7815|
|v0.11.1 handles|52|8/16|44|15.38%|0.6437|

The earlier target-hit measure rewards including the target anywhere in a broad output. Nine v0.11 hits came with 6–8 selected spans. The old prompt asks for useful page facts without a requested question. Its list is not a relevance ranking; historical Hit@1 and target rank are unavailable. Correlation is descriptive and does not prove causality or Qwen ranking uplift.

## Retrieval baseline and label quality

`retrieval-only.json` is computed offline from existing v0.11 retrieval ranking receipts. MRR uses the first relevant rank within frozen K=8; a target outside K contributes zero. Hit@K is the fraction of positive cases with a target among the first K results. Precision is relevant selected spans divided by all selected spans, including non-targets. No retrieval is rerun or tuned. Cached locked prefixes exactly match the actual v0.11.1 K=8 invocation order.

|Set|Cases|Hit@1|Hit@2|Hit@3|Hit@5|Hit@8|MRR|
|---|---:|---:|---:|---:|---:|---:|---:|
|Legacy dev, answer-containing|19|89.47%|100%|100%|100%|100%|0.9474|
|Answer-free dev, legacy labels|19|47.37%|68.42%|84.21%|94.74%|100%|0.6618|
|Locked 16|16|6.25%|31.25%|43.75%|50%|93.75%|0.3075|

The primary development comparison excludes `controls` and `capex`: the old annotator falls back to every span on a page when no exact literal matches. Such labels cannot measure discrimination. The two negative topics have no document/page target and are excluded from this exact-label positive comparison. Their exclusion is explicit; a separate hostile-source benchmark checks instruction handling. Remaining exact development labels can contain multiple relevant spans, so span precision need not equal case hits divided by selections. Locked labels each have one target.

## Ranking contract

Prompt `span-ranking-handles/v1` and schema `ranked-handles/v1` have one authored version. The model receives the answer-free requested fact and verified source data labelled S1..S8, without canonical span hashes or Gold expected IDs/values. Output is exactly:

```json
{"rankedHandles":["S4","S7","S2"]}
```

`[]` is valid abstention. The dynamic enum contains only available handles. `maxItems=3`, `uniqueItems=true`, required `rankedHandles` and `additionalProperties=false` are enforced both by Ollama structured output and exact program validation. No fuzzy repair or confidence scores. The prompt orders direct support, specific support, indirect context, then background, and asks for the smallest useful ordered set.

## Development comparison and frozen value gate

|Arm, 17 exact answer-free cases|Hit@1|Hit@2|Hit@3|MRR|Precision|Average handles|Abstention|
|---|---:|---:|---:|---:|---:|---:|---:|
|A: Retrieval ranking|41.18%|64.71%|82.35%|0.6221|22.79% over K=8|8 ranking entries|0%|
|B: Current question-free multi-select|unavailable|unavailable|unavailable|unavailable|23.26%|2.53|29.41%|
|C: Ranked Qwen v1|64.71%|94.12%|100%|0.8137|50%|2.47|0%|

Arm A's MRR uses the full K=8 ranking, not a truncated top-3 list. Its eight entries describe retrieval rank, not model output breadth. Arm B preserves the current question-free prompt and dynamic handle contract. Arm C performs the explicitly requested ranking task. Development rank uplift is +0.1917 MRR and +23.53 percentage points Hit@1. Ranking-only development uses 34 local model calls (17 multi-select plus 17 ranking), 28,620 input and 616 output tokens; ranked latency median 2.05 s, p95 3.30 s. No development interpretation calls are required to measure ranking.

`phase-gate.json` is registered after development and before any locked inference, with prompt/schema hashes, exact provider metadata, development artifact hash and frozen code hashes. Selected locked policy: ranked Qwen v1. Require both absolute MRR uplift >=0.05 and Hit@1 uplift >=0.0625 (one additional rank-1 target on 16 cases). This excludes tiny or broad-hit gains. Safety requires invalid handles, fabricated canonical support, false accept, future leakage, wrong subject, Claim mutation and timeout all zero, source fidelity 100%, and the minimum injection benchmark passing. Missing evidence or provider errors yield STAY ON SELECTOR CALIBRATION. No locked prompt tuning, canonical rerun, K sweep or cloud baseline.

## Ordered conversion and costs

An independent research layer processes rank 1, then rank 2 only after failure, then rank 3 only after failure, and stops after the first legal Candidate. It calls the existing fact interpreter, deterministic fact/support validators, proposal builder and Candidate promoter. Gold never controls fallback or acceptance. `candidateFoundAtRank` is 1/2/3/null. An unrelated legal Candidate is counted separately and never becomes Gold target success. Target conversion additionally requires the existing Gold scorer's numeric, unit, period, category and validated-chain checks.

Each interpretation is bounded by the unchanged 60 s deadline. Ranking takes one call, with at most three interpretation calls. Canonical support identity is assigned by exact deterministic resolution. The prototype stays in research; it changes neither production flow nor Admission and cannot create Evidence or mutate Claims.

Latency records ranking, each interpretation depth and the measured processing total. Retrieval is offline replay: historical ranking artifacts do not include query latency, so new retrieval latency is unavailable and is never reported as zero. Historical v0.11 retrieval timings remain in that release's results. The measured total excludes retrieval execution and is labelled accordingly. Token receipts, call counts and zero paid costs are recorded alongside results.

## Security, resume and regression

Two existing synthetic table/narrative injection fixtures guarantee hostile source data is offered to the selector. This isolates ranking safety rather than tuning retrieval. Source instructions remain data; ranked output cannot express Admission, Claims or risk authority. Existing deterministic validators and Candidate checks still govern conversion. Claims protection uses read-only identity/revision snapshots before and after real inference.

Local execution uses only the loopback-only provider with a remote-network guard. Ollama is launched with cloud disabled, the same qwen3.5:9b digest, Q4_K_M, non-thinking, temperature 0 and context 8192. No paid inference or embedding API is called. Benchmark sessions, logs and databases stay under `~/fc-agent/research-selector-ranking`. Case progress is logged and completed cases resume from `run.json`; prompt, data, gate and code drift are rejected. `caffeinate -i` covers real runs.

```bash
node research/selector-ranking/audit.js
node --test research/selector-ranking-test/*.test.js
caffeinate -i node research/selector-ranking/cli.js dev --opt-in
caffeinate -i node research/selector-ranking/security.js --opt-in
caffeinate -i node research/selector-ranking/cli.js locked --opt-in
```

Do not re-author the registered gate or prompt after starting locked inference. Repository CI imports the ranking contract/metric/conversion tests through `agent/test/selector-ranking.test.js`.

Locked results and the final decision are recorded below after the one registered run completes. This phase does not enter Claim Revision.

A follow-up audit also found that historical evaluation sorted validated proposals by Gold target membership before promotion, while its false-accept summary was fixed at zero. Historical conversion is consequently not a rank-order baseline. This phase preserves those artifacts but removes Gold from all fallback decisions and independently checks accepted facts with the frozen validators. The stricter target-semantic conversion metric additionally rejects wrong-category or unrelated facts as target successes; it does not redefine the underlying validator contract.

## Locked outcome

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
