# AGENTS.md — FlowCredit Research collaboration rules

This file defines how humans and coding agents may change this repository. README explains the product; frozen contracts and ADRs define semantics; this file defines engineering discipline.

## 1. Repository identity

Repository: Anhao1314/flowcredit-research.

This is a **development and test workspace for auditable investment-research memory and evidence reasoning**. It is not a production deployment repository.

The current direction is:

~~~text
Source
-> Grounding
-> Evidence admission
-> Research Memory
-> SemanticFrame
-> RelationInput
-> Compatibility
-> RelationReceipt
-> Human Review or Investigation
-> human authority
~~~

The older deterministic risk-assessment / Finch prototype remains under agent/, assets/ and historical docs. It stays tested for regression compatibility but is **legacy**, not the product direction.

## 2. Truth hierarchy

When documents disagree, use this order:

1. accepted/frozen contracts in docs/contracts/
2. accepted/frozen ADRs in docs/adr/
3. docs/public/status.md for maturity claims
4. runtime code and tests
5. README / design history

Never change a frozen contract merely to make an implementation or benchmark pass. A frozen semantic change requires an explicit new version or ADR.

## 3. Human authority

Hard boundary:

~~~text
AI / rules propose analysis.
Humans retain research authority.
~~~

Code in this repository must not silently:

- admit Evidence,
- mutate a Claim,
- rewrite historical state,
- convert a Relation into Impact,
- aggregate multiple Evidence records inside Relation v1,
- make an investment decision.

A RelationReceipt is analytical only. A What Changed candidate is pending review only. An Investigation Plan is a research question only.

## 4. Relation invariants

The frozen Relation layer remains:

~~~text
1 Accepted Evidence
x
1 specific Claim Revision
x
1 explicit asOf
~~~

Legal state matrix:

- RESOLVED + SUPPORTS|COUNTERS|NEUTRAL
- ABSTAINED + AMBIGUOUS
- NOT_EVALUATED + null
- ERROR + null

Never use NEUTRAL as “not sure”. Never use AMBIGUOUS for invalid or forbidden input. Prefer abstention over unsupported direction.

No generic confidence score belongs in Relation v1.

## 5. Current runtime boundary

The current development runtime includes:

~~~text
research/semantic-frame/
research/claim-relation/resolve.js
research/claim-relation/compatibility.js
research/claim-relation/gate.js
research/relation-runtime/
research/investigate/
research/what-changed/
~~~

There are now two relation paths:

- prose/lexical baseline retained for comparison and legacy compatibility,
- provenance-aware structured SemanticFrame path for already-recorded fields.

Do not silently route a structured recorded field back through lexical reconstruction when the SemanticFrame is available.

Development SemanticFrame, RelationReceipt, Investigation Plan and What Changed candidate encodings are not frozen contracts unless a later normative document explicitly says so.

## 6. Semantic provenance rule

A structured field is only as trustworthy as its origin.

The current deterministic origins are:

~~~text
CLAIM_DEFINITION
RECORDED_FIELD
DERIVED_NORMALIZATION
~~~

Hard rules:

- never mark an inferred field as RECORDED_FIELD,
- never mark a model-proposed field as CLAIM_DEFINITION,
- DERIVED_NORMALIZATION must name the transformation,
- source/locator information must remain attached when present,
- absent fields stay absent; do not manufacture values to make Relation execute.

Any future model-assisted SemanticFrame path must introduce an explicit model-proposal provenance class. Downstream deterministic code must be able to distinguish it from recorded truth and must not silently upgrade it.

## 7. Investigation boundary

The investigator exists to turn a safe abstention into a bounded next research action.

Allowed pattern:

~~~text
AMBIGUOUS
-> explicit missing-context requirement
-> bounded Evidence retrieval
-> provenance-preserving context
-> Relation re-evaluation
~~~

Current v0.2 behavior uses a controlled local Evidence pool.

The investigator must not:

- mutate Claims,
- invent missing Evidence,
- ignore as-of boundaries,
- search indefinitely,
- convert retrieval failure into a directional relation,
- treat a research question as an answer.

If required context is unavailable, the state remains NEEDS_MORE_EVIDENCE.

A future tool/web retrieval path must preserve the same source-grounding and as-of constraints before its Evidence can enter Relation evaluation.

## 8. Research Memory integrity

Historical records are append/version oriented. Do not overwrite history to simplify a test.

As-of boundaries are integrity-bearing. Future information must never leak into:

- RelationInput,
- SemanticFrame projection,
- Compatibility,
- deterministic resolution,
- verifier/model prompts,
- Investigation retrieval,
- RelationReceipt.

Corrections and superseded Evidence remain inspectable.

## 9. Experiment discipline

Experiments are product code here, not README decoration.

Requirements:

- define the question before interpreting the result,
- prefer executable or independently reviewed gold authority,
- never let the evaluated model generate its own gold labels,
- preserve baseline failures instead of repairing them out of the comparison,
- archive measured results when they become a public claim,
- make CI recompute archived metrics from committed inputs,
- state what a benchmark does **not** measure.

Relation Reality v0.2 is explicitly a structured-correctness benchmark. Its 128/128 SemanticFrame result may not be described as 100% general financial-language accuracy.

A larger human-labeled semantic benchmark remains required.

## 10. Legacy isolation

Treat agent/, root index.html, assets/ and Finch-era artifacts as legacy unless the task explicitly targets them.

Do not:

- revive legacy product claims in public docs,
- couple new research runtime logic to the static legacy UI,
- remove legacy tests merely because the current direction changed.

The existing agent test glob is also used as a repository-wide CI entry point; thin importers for research suites are allowed.

## 11. Public-claim discipline

Public surfaces must distinguish:

- IMPLEMENTED / VALIDATED
- ACCEPTED / FROZEN
- RESEARCH VALIDATED
- CURRENT
- PLANNED
- LEGACY

Do not claim production readiness, institutional grade, customer outcomes, external benchmark parity, calibrated accuracy, autonomous arbitrary-company research, or deployment unless evidence for that exact claim exists.

Synthetic demos must be labelled synthetic. Structured-oracle experiments must be labelled as such.

## 12. Required verification

At minimum for code changes:

~~~bash
cd agent
npm run check
~~~

Relevant focused suites include:

~~~bash
node --test research/claim-relation-test/*.test.js
node --test research/relation-runtime-test/*.test.js
node --test research/semantic-frame-test/*.test.js
node --test research/investigate-test/*.test.js
node --test research/surface-test/*.test.js
~~~

Useful reproducible experiments:

~~~bash
node research/eval/relation-reality/cli.js
node research/investigate/cli.js
~~~

CI is the final repository gate. Do not merge a red PR.

## 13. Commit discipline

- use focused commits with conventional English prefixes,
- no force push or history rewriting,
- preserve frozen-contract provenance,
- commit deterministic fixtures needed for reproducibility,
- never commit API keys, local databases, model sessions, logs or machine-specific paths.

A delivery note should state what changed, which authority boundary was preserved, which experiment actually ran, and which tests actually passed.
