# Fresh Blind Holdout v0.2C — Frozen Protocol

This file defines the experiment **before any new v0.2C benchmark cases are collected**.

## Frozen runtime

Base commit:

`b7817dedd1c6d9b59cde15558b2036ca421c4ff7`

Candidate:

`relation-candidate/v0.2b-r2`

The exact Git blob SHAs for the R2 runtime, evaluator, schema and phase gate are pinned in `holdout-v0.2c-protocol.json`.

## Corpus plan

The fresh holdout will contain exactly **32 cases** from **4 previously unused issuers**, 8 cases per issuer.

Issuers used by earlier relation experiments are excluded:

- Apple Inc.
- Microsoft Corporation
- NVIDIA Corporation
- Amazon.com, Inc.
- Alphabet Inc.
- Meta Platforms, Inc.
- CoreWeave, Inc.

Only primary SEC filing material may be used for this engineering holdout.

### Case composition

| Bucket | Cases |
| --- | ---: |
| Numeric / trend | 8 |
| Hard negative | 4 |
| Second-order | 4 |
| Causal attribution | 4 |
| Scope / metric binding | 4 |
| Insufficient context / AMBIGUOUS | 4 |
| Mixed hard cases | 4 |
| **Total** | **32** |

The bucket counts are frozen before source selection. Individual cases must not be swapped between buckets after seeing model predictions merely to improve the score.

## Execution order

1. Freeze this protocol. **This step.**
2. Select four unseen issuers and primary filings.
3. Author and review all 32 Claim × Evidence pairs without running R2 on them.
4. Commit the complete dataset and record its Git blob SHA.
5. Verify runtime, evaluator, schema and gate SHAs still match this protocol.
6. Run R2 exactly once against the locked dataset.
7. Archive the full first-run result, including failures, whether PASS or FAIL.
8. After that first run, v0.2C stops being blind and becomes a repair/regression set.

## Prohibited shortcuts

Before the first v0.2C prediction:

- no R2 runtime changes;
- no evaluator or schema changes;
- no gate changes;
- no per-case probing against R2;
- no label edits based on R2 output.

After the first prediction:

- no relabeling to match the candidate;
- no relaxing thresholds;
- no replacing difficult cases to improve the score;
- no calling a repair replay a fresh blind result.

## Existing gate

The unchanged promotion thresholds remain:

| Metric | Threshold |
| --- | ---: |
| Overall accuracy | >= 85% |
| Directional accuracy | >= 90% |
| Directional inversion | <= 2% |
| Unsafe directional error | <= 5% |
| AMBIGUOUS abstention recall | >= 90% |

A PASS is diagnostic evidence only. This 32-case engineering holdout is not publication-grade gold and does not authorize promotion to the default runtime.

## Current state

`PROTOCOL_FROZEN_NO_DATASET`

No v0.2C issuer, filing, case, label or score exists yet.
