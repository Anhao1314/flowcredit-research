# What Changed

Pairwise review-candidate preview built on the development Relation runtime.

```text
Evidence + specific Claim Revision
  -> RelationReceipt
  -> directional review candidate
  -> STOP
```

Only `SUPPORTS` and `COUNTERS` receipts become candidates. `NEUTRAL`, `AMBIGUOUS` and `NOT_EVALUATED` remain visible in the receipt stream but do not pretend that a Claim should change.

A candidate is always:

```text
PENDING_HUMAN_REVIEW
claimMutationAllowed = false
```

This module does not implement Impact, multi-evidence aggregation, Claim revision or investment recommendations.

Run the committed synthetic demo:

```bash
node research/what-changed/cli.js research/what-changed/fixtures/northstar-demo.json
```

Expected behavior of the five pair fixture:

```text
SUPPORTS
COUNTERS
AMBIGUOUS
NOT_EVALUATED
NEUTRAL
```

The first two become human-review candidates. The fixture is a behavior smoke test, not a statistical benchmark.
