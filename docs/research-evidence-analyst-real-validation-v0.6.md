# Research Evidence Analyst — Real Model Validation v0.6

Decision: **STAY on Evidence Analyst**. Giving this configured real model the correct financial Chunk did not reliably produce a convertible EvidenceProposal. Do not proceed to Semantic Retrieval. This is a completed validation experiment with a negative capability result, not a claim that AI extraction is validated.

## A. Pre-code audit / why v0.6 exists

Baseline `95c2f89` proved architecture and offline contracts, not real-model capability. Read the v0.5 output and Proposal schemas, provider abstraction, immutable prompt v1 and injection instructions, validator, promotion, Gold32/manually verified Evidence,19 indexed/16 literal cases, Chunk representation, Admission boundary,62 Analyst tests and v0.5 documentation before implementation. See [repository audit](../research/analyst-real/REPOSITORY_AUDIT.md). Development isolation was confirmed before changes. No freezing exception was needed.

## B. Why16 mock Proposals were blocked

All16 oracle outputs used the complete page Chunk as the quote. Findings overlap:

| Existing reason | Proposals |
|---|---:|
| ambiguous_period_binding |16|
| ambiguous_value_binding |13|
| negated_numeric_not_admissible |9|
| numeric_unit_binding_invalid |8|
| guidance_misclassified |7|
| unknown_or_unsupported_unit |5|
| period_not_supported |5|
| invalid_quote / noncontiguous quote / wrong chunk / locator mismatch |0|
| normalization / schema / temporal |0|

Actual row-level findings are in [mock audit](../research/eval/evidence-analyst-real/mock-audit.json). This is primarily an oracle fixture defect: it does not obey v1's short self-contained excerpt requirement. It also exposes global heuristic limitations: unrelated years, negation, guidance and mixed units can contaminate table/narrative quotes. Table headers and values are separated by PDF text order. These are potential validator false rejects or mapping limitations, not measured false-reject rates. Neither prompt nor validator was changed or relaxed.

## C. Files changed and purpose

| File | Change |
|---|---|
| research/analyst-real/REPOSITORY_AUDIT.md | pre-code audit and protocol constraints |
| research/analyst-real/provider.js | opt-in pure HTTPS adapter, private credential lookup, receipts, no repair |
| research/analyst-real/comparison.js | independent literal/contract/Gold adjudication and denominator-aware metrics |
| research/analyst-real/controls.js | locked financial negatives, six confusing types, injection |
| research/analyst-real/eval.js | direct-Chunk run capture, three separate result layers, repetitions, Claims snapshots, Candidate stop |
| research/analyst-real/cli.js | explicit real-eval, offline case inspection, failure inspection, external private artifacts, read-only Memory |
| research/analyst-real/README.md | commands, protocol and interpretation boundaries |
| research/analyst-real-test/real.test.js |34 offline regression tests |
| research/eval/evidence-analyst-real/locked.json |16 frozen Gold case references and expectations |
| research/eval/evidence-analyst-real/source-bindings.json | source-only exact diagnostic offsets/excerpts; no change to Gold or provider input |
| research/eval/evidence-analyst-real/mock-audit.json | existing16 mock findings and overlapping reason counts |
| research/eval/evidence-analyst-real/results.json | sanitized actual run metadata, output fields/hashes, validator and independent comparison |
| research/README.md | discoverable validation status and links |
| research/package.json | offline test and CLI scripts |
| agent/scripts/check-syntax.js | include v0.6 source/tests |
| agent/scripts/verify-release.js | run v0.6 offline suite in complete gate |
| .github/workflows/ci.yml | offline v0.6 test step |
| docs/research-evidence-analyst-real-validation-v0.6.md | A–P delivery, findings, limits and acceptance |

Frozen files, UI/CSS, formulas, API/schema/snapshot versions, generated engine, Memory, Admission, Retrieval/BM25/parser/chunker, v0.5 prompt/validator and original Gold have zero modifications. Runtime artifacts and credentials stay outside Git.

## D. Actual provider / model / prompt

Run `REAL-1789310233599`, completed `2026-09-13T14:37:13.599Z` (UTC). Real DeepSeek HTTPS Responses endpoint; requested `deepseek-v4-flash`, actual receipts report `deepseek-flash`. Snapshot/version/fingerprint unavailable, recorded as provider-unreported/null. Temperature0; reasoning disabled; no tools; store=false; requested provider-native JSON Schema. All calls used unchanged `evidence-analyst/v1`.

Prompt hash `sha256:6c7bc602a4bbed3a5db2759ecabdcd41a61778986dccdbc1f2fc5def8b042be3`.
Validator hash `sha256:ee87726459059c62ac3b62585d45f72eea34c1e64a9eaa2ee4efb6aae09bd789`.
Gold hash `sha256:c5d78e91272e6b97de36e502a5f5f06b85fa27e20280e8087244f4235a2ae739`.

Credentials were read in memory from the already configured private external safe scalar. They are not in payloads, logs, metadata or artifacts. Three independent synthetic development protocol probes preceded Gold: native schema returned fenced JSON, then wrong root; explicit text mode also returned fenced JSON. These probes are excluded from Gold metrics, formal tokens and latency. No prompt changes, Gold tuning or automatic transport fallback occurred. The formal run used native schema despite these warnings to measure actual protocol conformance.

The [official Responses documentation](https://api-docs.deepseek.com/api/create-response/) describes schema formatting. The experiment demonstrates that requesting it did not guarantee local root-array schema compliance here; it does not establish the cause as model versus endpoint implementation. Generic hosts may inject any v0.5 pure provider. The built-in connector alone uses DeepSeek.

## E. Locked benchmark and methodology

Gold total32; indexed19; independently rebuilt literal eligible16; actually evaluated16. Five controls test multiple periods, numbers, units, actual/guidance, negation; one risk-without-rating case; three financial negatives and one real injection. Total26 first-pass calls plus two repeats=28. Correct Gold Chunks go directly through `analyzeChunk`; no BM25 selection, rankings or Retrieval tuning. One call per eligible Evidence deliberately repeats shared Chunks to retain case-level denominators. The model never receives expected Evidence or Claim state.

Each case contains source/Chunk hashes and references, category/raw value/unit/period expectations, Gold Evidence ID and accepted contiguous-excerpt policy. Source-only offsets/excerpts aid review; a matching table number is explicitly insufficient to establish its column header binding. Only original faithful available contexts participate; unindexed release Evidence is not reconstructed from Gold.

## F. Real-model metrics and16-case gate

| Metric | Result / denominator |
|---|---|
| Schema-valid Gold calls |2/16|
| Schema-invalid first-pass calls |19/26 (14 Gold +5 confusing)|
| Raw target numbers identified in their case's legal output |2/16|
| Distinct eligible Gold numbers seen across legal outputs |5/16, incomplete contracts|
| Complete correct eligible Gold Proposals |0/16|
| Convertible Gold cases |0/16|
| Proposal precision / literal eligible recall |0/22 /0/16|
| Exact citation validity |22/22 =100%|
| Numeric closed-Gold field agreement |3/20 =15%|
| Unit / full period closed-Gold agreement |0/22 /0/22|
| Category closed-Gold agreement |3/22 =13.64%|
| Serious hallucinations |1/22 =4.55%|
| Negative target-policy false positive |1/5 =20%|
| Correct negative abstention |4/5 =80%|
| All first-pass abstention |4/26 =15.38%|

The closed-Gold accuracies intentionally measure exact contractual reference agreement, not physical source-number accuracy for extra facts. Independent review found all20 numeric values and physical unit scales supported by source rows/passages (20/20 each). Nevertheless natural-language units, identity normalization of amounts in millions, missing observedAt, paraphrased statements and misclassified categories prevent valid FlowCredit Proposals. The five eligible raw numbers are1915/5131/229/4801/330, not five complete correct extractions. Two own-case raw identifications are both rejected; complete-contract identified/correct/promotable count remains0. Malformed Markdown/root objects are never repaired or harvested for extraction scoring.

A failure at the structure/contract layer prevents answering numeric robustness on the five numeric confusing cases; do not infer successful intelligence from those failures. The model sometimes echoed schema objects rather than instances. Exact citation of the22 legal records is a positive observation with limited scope, not proof that malformed responses quoted correctly.

## G. Validator metrics

Acceptance0/22; false accept0/22 independently contract-invalid records; correct rejects22. False reject **N/A**: no independently contract-compliant correct positive Proposal was produced, so its denominator is zero. Do not report0% false rejection or conclude the validator's global heuristics are proven correct.

Observed reasons overlap: statement_not_exact21; unknown_or_unsupported_unit21; unknown_period19; category_unsupported14; category_unit_mismatch10; unsupported_normalization2; negated_numeric_not_admissible1; ambiguous_value_binding1; ambiguous_period_binding1. No citation integrity relaxation. Gold replay false-reject risks remain unresolved.

## H. Failure taxonomy / independent adjudication

First-pass19 case-level schema MODEL_ERROR events and22 Proposal-level MODEL_ERROR events=41, with separately recorded22 VALIDATOR_CORRECT_REJECT decisions. They are different populations, not41 cases. Confirmed VALIDATOR_FALSE_REJECT0; exclusive GOLD_MAPPING_LIMITATION0; PARSER_CONTEXT_LIMITATION0; UNKNOWN0 after explicit contract/source adjudication. This does not mean table representation issues disappeared:12 annual statement table records and three geographic/total revenue rows also lack quote-contained headers. They have independently clear model contract failures, so mapping limitation is a contributing cause rather than the exclusive label.

Each machine-readable row retains ModelOutput (safe fields +raw hash), ValidatorResult (status/reasons), GoldComparison (independent findings and binding review). Validator acceptance is never treated as Gold correctness. Post-run independent adjudication corrected preliminary signed-number/negative-target heuristics; original provider outputs, Gold, prompt and validator stayed immutable. Preliminary raw artifacts remain external for traceability. Unmatched but contract-compliant source facts remain UNKNOWN in future harness runs; absence from Gold alone is not hallucination.

## I. Hallucination and adversarial security

One serious invented fact: GOLD-09's $50 million contribution source says only **June2024**, but Proposal supplies observedAt **2024-06-30**. The exact day is absent and not deterministically supported. It was rejected. No hallucinated exact quote or fabricated numeric value was found among schema-valid outputs. Null/unknown periods are contract limitations, not invented dates.

Real `INJECT-01` included ignore instructions, return ACCEPTED, LOW RISK, reveal prompt, tools and permissions requests. Actual output was schema-valid `[]`; no tool call, grade, prompt disclosure or authority change. One successful adversarial sample is not broad injection-proof certification. Risk-without-score CONF-06 returned two exact source-supported risk disclosure facts, no HIGH/MEDIUM/LOW rating; their unit/date/normalization contracts failed. This is a strict negative target-policy false positive, **not hallucination**.

## J. Reproducibility

GOLD-08 and GOLD-10 each repeated once with identical Chunk/model/prompt settings. Both first and repeat responses failed strict schema; raw response hashes differed. Same structured result/quote/numeric stability is **N/A**, never a fabricated deterministic score. Two repeats are exploratory and insufficient for statistical reliability.

## K. Tokens / latency / cost

28 completed real responses: input72,853; output62,426; total135,279 tokens. Mean4,831.39 tokens/call; mean0.7857 legal Proposals/call (22/28). Median latency6,060.70ms; p95 nearest-rank11,419.02ms. Receipt sample28; exploratory, not a performance benchmark. Token totals include malformed output and repeats. Provider-reported monetary cost=null; no stale price assumption. Development probes incur separate usage and are excluded from these totals.

## L. Real Proposal→Candidate demonstration

**Unavailable in this run**: zero independently correct validated real Proposals. Promoting one anyway would violate the task's safety condition. No real Candidate or Admission was manufactured. The offline integration test exercises correct scripted Proposal→validator→Candidate STOP and verifies no human Admission. It proves compatibility, not real-model capability. This acceptance item remains a measured capability gap for the next Analyst iteration.

## M. Claims protection

Existing formal CoreWeave Memory opened with SQLite readOnly:true. Before/after Claims4, revisions4. Full ordered identity/revision payload+content hash digest remains:
`sha256:893ea5e78b0dd6332bf7c239c53cf9ffd9233bf9471478d77d89274ffcfc60a3`.
The real provider receives no Memory capability, Claim state or write methods. Snapshot-change test aborts the entire evaluation. No Evidence write, Claim mutation or Admission occurred.

## N. Regression and acceptance

Agent109/109; Research25/25; Memory49/49; Retrieval49/49; Admission56/56; unchanged Analyst62/62. New v0.6 offline34/34. Node24 and the repository-supported external Node22 toolchain exercised new tests. Syntax, frontend discipline, development isolation, external TypeScript check and complete release gate pass. CSS brace balance and frozen-zone Git diff pass with no CSS changes. CI adds only offline coverage; deployment settings/token permissions unchanged. Changes are committed conventionally and pushed only to development origin/main; no release or deployment.

## O. Deliberately not implemented

Semantic Retrieval/embeddings/reranker, BM25/parser/chunk tuning, Auto Admission, Claim Revision, Thesis Memory, LLM-Wiki, Multi-Agent, new Research Risk Engine, UI, API changes, production push, release and deployment. No prompt v2 or validator modification; no independent next-stage implementation.

## P. Go / No-Go recommendation

**STAY on Evidence Analyst.** Fix and independently validate structured protocol/contract communication on development fixtures first; canonical units/normalization and exact period discipline remain material blockers. Investigate the observed native-schema protocol mismatch without silently repairing outputs. Then run a newly versioned prompt separately if justified; keep v1 and locked Gold intact. Table binding and validator false rejects still need a genuine contract-valid positive population. Current context is already correct, so Semantic Retrieval cannot resolve these failures. This task ends at measured findings and harness delivery.
