# Blind Holdout v0.2B

This is a source-isolated holdout for the already-frozen `relation-candidate/v0.2a.1`.

## Isolation

The 24 cases use three issuers not present in the v0.2A SEC pilot:

- Amazon.com, Inc. — 2025 Form 10-K
- Alphabet Inc. — 2025 Form 10-K
- Meta Platforms, Inc. — 2025 Form 10-K

The dataset is locked before candidate evaluation. `holdout-v0.2b-lock.json` pins:

- the dataset Git blob SHA;
- all three candidate-runtime Git blob SHAs;
- the phase-gate Git blob SHA;
- the base commit.

## Rules

1. Do not modify candidate runtime code before the first holdout result is archived.
2. Do not edit labels or thresholds after seeing predictions.
3. A FAIL is a result, not a reason to lower the gate.
4. The dataset is single-review and therefore not publication gold.
5. No promotion to the default runtime follows from a PASS on 24 cases.

The next step after this holdout is determined by the measured failures, not by a prewritten roadmap.
