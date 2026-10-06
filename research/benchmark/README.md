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

## Phase gate

`phase-gate-v0.2a.json` intentionally sets a hard promotion gate. The current baseline is allowed to FAIL.

A FAIL means: **do not tune the labels; improve the runtime.**

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
