# Relation Runtime

Development baseline for the pairwise Relation layer.

```text
RelationInput
  -> CompatibilityAssessment
  -> Compatibility gate
  -> conservative deterministic resolver
  -> RelationReceipt
```

This runtime is deliberately fail-closed:

- eligibility or compatibility refusal -> `NOT_EVALUATED + null`
- safely resolved direction -> `RESOLVED + SUPPORTS|COUNTERS|NEUTRAL`
- permitted pair without enough deterministic context -> `ABSTAINED + AMBIGUOUS`
- no confidence score
- no Impact
- no Claim mutation
- no network or model call

`RelationReceipt` is a development schema, not a frozen public contract. The frozen authority remains `docs/adr/ADR-0.12.1-relation-semantics.md` plus the accepted RelationInput and Compatibility contracts.

Run the reproducible demo from the repository root:

```bash
node research/what-changed/cli.js research/what-changed/fixtures/northstar-demo.json
```

The demo emits pairwise receipts and review candidates only. A candidate means “this directional evidence deserves human review”; it is not a recommendation to revise a Claim.
