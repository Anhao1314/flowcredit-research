# SemanticFrame Runtime v0.2

This layer materializes the structured semantics that earlier FlowCredit contracts only described.

It is intentionally narrow: **recorded fields in, provenance-preserving frame out**.

No model fills missing values. Every load-bearing field carries an origin:

- CLAIM_DEFINITION
- RECORDED_FIELD
- DERIVED_NORMALIZATION

## Real-source validation

The Relation Reality experiment projects the reviewed CoreWeave fixture:

- 3 primary publications
- 32 reviewed Observations
- 4 explicit predicate Claims
- 128 pairwise evaluations

On the narrow structured oracle, the SemanticFrame runtime reproduces 128 / 128 expected outcomes with zero unsafe directional judgments. The prose/lexical baseline reproduces 66 / 128, with eight unsafe directional judgments and two runtime errors.

See [Relation Reality v0.2](../eval/relation-reality/README.md).

This is structured-field correctness evidence, not a 100% open-ended financial-language accuracy claim.

## Research Memory boundary

Current Research Memory Evidence already records enough structured data to materialize an Evidence SemanticFrame directly:

- metric
- normalized value
- unit
- scope
- period
- Source provenance and locator

The fail-closed adapter lives in [memory-adapter.js](memory-adapter.js).

Current Research Memory Claim snapshots do **not** record an executable comparator / threshold proposition. Therefore the adapter intentionally returns:

~~~text
NOT_MATERIALIZED
CLAIM_SEMANTICS_NOT_RECORDED
~~~

for a Claim unless a separate explicit provenance-bearing Claim SemanticFrame is supplied.

The adapter never reconstructs Claim semantics from prose merely to make the structured runtime execute.

## Provenance rule

A SemanticFrame does not become authoritative merely because it is structured.

Future model-assisted fields must carry a visibly distinct model-proposal origin. They may not be silently promoted into RECORDED_FIELD or CLAIM_DEFINITION.

## Tests

~~~bash
node --test research/semantic-frame-test/*.test.js
~~~
