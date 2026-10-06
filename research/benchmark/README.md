# FlowCredit Reality Benchmark v0.2A

This directory turns Relation evaluation from a handful of synthetic examples into a reproducible benchmark program.

## Why this exists

The existing frozen relation spike and compatibility suites are useful engineering evidence, but they are too small and too synthetic to support a generalization claim. v0.2A therefore separates three things:

1. **synthetic regression** — protects frozen semantics and old behavior;
2. **real-source pilot** — exposes the current runtime to real SEC facts and harder semantic pairings;
3. **future locked benchmark** — 500+ independently reviewed pairs with adjudication.

The current SEC pilot is intentionally labelled:

`PILOT_SINGLE_REVIEW_NOT_PUBLICATION_GOLD`

It must not be marketed as a final benchmark.

## Design influences

The protocol borrows experimental discipline from:

- FEVER / FEVEROUS: claim verification with explicit evidence and an abstention / insufficient-evidence class;
- FinQA and TAT-QA: real financial reports and numerical/table reasoning;
- FinanceBench: ecologically valid financial-document evaluation and manual error analysis.

FlowCredit's task is different: one Accepted Evidence record × one specific Claim Revision, with a directional Relation or safe abstention.

## Current pilot

`data/real-sec-pilot-v0.1.json` contains 32 manually curated pairs from three SEC filings:

- Apple 2025 Form 10-K
- Microsoft 2025 Form 10-K
- NVIDIA 2026 Form 10-K

The filing text is **not copied into the dataset**. Evidence statements are concise paraphrases of source facts, with accession URLs and section locators retained for re-checking.

The final eight cases are challenge cases targeting known weaknesses:

- reverse temporal mention order,
- semantic state language,
- second-order claims,
- mix inference,
- causal attribution,
- causal hard negatives,
- causal insufficiency.

## Metrics

The evaluator reports:

- overall exact state accuracy;
- directional accuracy on SUPPORTS / COUNTERS gold;
- directional inversion rate;
- unsafe directional error rate on NEUTRAL / AMBIGUOUS gold;
- AMBIGUOUS abstention recall;
- per-label and per-challenge accuracy.

The safety metrics matter more than a flattering aggregate. A system that gets many easy numeric cases right but turns insufficient evidence into a directional claim is not ready.

## Measured A/B result

The validated default baseline remains untouched. The v0.2A candidate is evaluated side-by-side on the same 32 cases.

| Runtime | Exact | Directional | Inversion | Unsafe direction | Ambiguous abstention |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 71.88% | 78.26% | 4.35% | 33.33% | 80% |
| v0.2A candidate | **100%** | **100%** | **0%** | **0%** | **100%** |

The final pilot failure exposed a generic tokenizer defect: digits inside identifiers such as `H20` were being interpreted as quantities. v0.2A.1 fixes that only in the isolated candidate reader; the validated baseline and its archived measurements remain unchanged.

Archived result: `results/real-sec-pilot-v0.1.json`.

## Phase gate

`phase-gate-v0.2a.json` sets a hard experimental promotion gate. The baseline fails it; the isolated candidate passes all five thresholds.

Passing this gate means **the candidate may proceed to larger locked evaluation**. It does not mean the candidate replaces the default runtime.

The pilot remains single-review and is not publication gold. A PASS must not be advertised as production or generalization evidence.

## Run

```bash
node research/benchmark/cli.js
```

The benchmark is also executed in CI.

## Path to 500+

A publication-grade lock requires:

- >= 500 pairs;
- issuer and sector diversity;
- text + table + mixed evidence;
- temporal, scope, unit, denominator and causality challenges;
- independent double annotation;
- adjudication for disagreement;
- inter-annotator agreement reported before adjudication;
- train/dev/test separation by source document or issuer, never random near-duplicate pair splitting;
- a blind locked test partition;
- no benchmark imports from runtime code;
- source availability / as-of metadata retained.

Until those conditions hold, public docs must call this a pilot.


## Blind holdout v0.2B

After v0.2A.1 reached 32/32 on its development pilot, the candidate runtime was frozen before evaluating a new source-isolated set.

The holdout uses 24 cases from Amazon, Alphabet and Meta 2025 Form 10-K filings. None of those issuers appear in the v0.2A development pilot.

| Metric | v0.2B blind holdout |
| --- | ---: |
| Exact state accuracy | **70.83% (17/24)** |
| Directional accuracy | **66.67%** |
| Directional inversion | **0%** |
| Unsafe directional error | **0%** |
| AMBIGUOUS abstention recall | **66.67%** |
| Phase gate | **FAIL** |

The candidate was **not modified after dataset lock and before this result was archived**.

The seven failures cluster around causal attribution, metric binding, mix inference, second-order language and one directional-loss formulation. The zero inversion / zero unsafe-direction result is useful: the dominant failure mode is under-resolution, not unsafe overclaiming.

This result supersedes any temptation to treat the v0.2A pilot's 32/32 as generalization evidence. The next runtime repair must be selected from the archived holdout failures and validated on a separate regression set; the holdout itself remains locked.


### Repair replay R1 — explicit causal reflection

The first repair cycle targets exactly one archived failure family: financial attribution expressed as `primarily/largely/mainly reflected`.

R1 is isolated as `relation-candidate/v0.2b-r1`; the original v0.2A.1 candidate and the authoritative first-blind 17/24 result are unchanged.

| Metric | First blind v0.2B | R1 replay |
| --- | ---: | ---: |
| Exact state accuracy | 70.83% (17/24) | **75.00% (18/24)** |
| Directional accuracy | 66.67% | **72.22%** |
| Directional inversion | 0% | **0%** |
| Unsafe directional error | 0% | **0%** |
| AMBIGUOUS abstention recall | 66.67% | **66.67%** |
| Causal attribution | 1/3 | **2/3** |
| Phase gate | FAIL | **FAIL** |

R1 repaired `HOLD-AMZN-005` and no other archived holdout case. Six failures remain. The Meta causal-attribution failure is intentionally untouched because it is a separate driver/outcome role-binding problem.

Archived replay: `results/causal-reflection-r1-replay-v0.2b.json`.

A one-case improvement is evidence for the narrow repair, not evidence that the Relation engine now generalizes.


### Repair replay R2 — causal driver/outcome binding

R2 isolates a second semantic repair: explicit causal statements are parsed into two roles, `driver` and `outcome`, then aligned independently across active and passive constructions.

Examples of the supported shape:

~~~text
Claim:    higher subscription revenue drove operating profit growth
Evidence: operating profit increased, driven by higher subscription revenue
~~~

R2 does not treat reversed roles, a different driver, or simple co-occurrence as SUPPORTS.

| Metric | First blind | R1 replay | R2 replay |
| --- | ---: | ---: | ---: |
| Exact state accuracy | 17/24 (70.83%) | 18/24 (75.00%) | **19/24 (79.17%)** |
| Directional accuracy | 66.67% | 72.22% | **77.78%** |
| Directional inversion | 0% | 0% | **0%** |
| Unsafe directional error | 0% | 0% | **0%** |
| AMBIGUOUS abstention recall | 66.67% | 66.67% | **66.67%** |
| Causal attribution | 1/3 | 2/3 | **3/3** |
| Phase gate | FAIL | FAIL | **FAIL** |

R2 repaired exactly `HOLD-META-007`. Five non-causal failures remain. The original 17/24 first-blind result remains the only source-isolated estimate; R1 and R2 are post-failure repair replays.

Archived replay: `results/causal-role-r2-replay-v0.2b.json`.
