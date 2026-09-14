# ADR-0.12.1 — Claim Relation Semantics

Status: Accepted / Frozen for v0.12.1A

Target:
v0.12.1A — Relation Contract & Benchmark Hardening

Date: 2026-09-14

Scope of this document: normative semantics only. It freezes what the relation
layer means for v0.12.1A. It does not freeze schemas, routing, prompts,
benchmarks or runtime code; those are listed under "Deferred to Session 2".

Where this ADR and an earlier spike or design document disagree, this ADR wins
for v0.12.1A.

## 1. Normative purpose

The relation layer answers exactly one question:

> Given one Accepted Evidence record and one specific Claim Revision, what
> directional relationship does the Evidence have to the core proposition
> asserted by that Claim Revision?

The relation layer does NOT decide whether the Claim is ultimately true or false.

The relation layer does NOT determine Claim impact.

The relation layer does NOT create or mutate a Claim Revision.

The relation layer does NOT aggregate multiple Evidence records.

The relation layer does NOT produce an investment recommendation.

v0.12.1 pipeline:

```text
Accepted Evidence
+
Specific Claim Revision
        ↓
Relation Evaluation
        ↓
RelationReceipt
        ↓
STOP
```

## 2. Scope

Relation v1 must satisfy:

```text
1 Accepted Evidence
×
1 specific Claim Revision
```

Relation is therefore:

```text
pairwise
evidence-specific
revision-specific
as-of-aware
```

Associating only

```text
Evidence → Claim
```

is forbidden. The relation must always be evaluated against:

```text
Evidence → specific Claim Revision
```

## 3. Frozen relation taxonomy

Relation v1 has exactly four semantic labels:

```text
SUPPORTS
COUNTERS
NEUTRAL
AMBIGUOUS
```

Adding further labels is forbidden, explicitly including:

```text
UNKNOWN
MAYBE
OTHER
CONTRADICTS
WEAKENS
STRENGTHENS
```

### 3.1 SUPPORTS

Definition:

> The Evidence provides information that is directionally consistent with the
> core proposition asserted by the Claim Revision.

Example:

```text
Claim:
Customer concentration remains high.

Evidence:
Largest customer share increased from 48% to 55%.

Relation:
SUPPORTS
```

Frozen non-implications:

```text
SUPPORTS ≠ Claim is proven
SUPPORTS ≠ Claim is certainly true
SUPPORTS ≠ automatically strengthen Claim
SUPPORTS ≠ automatically revise Claim
```

### 3.2 COUNTERS

Definition:

> The Evidence provides information that moves against the direction of the
> Claim's core proposition.

Example:

```text
Claim:
Customer concentration remains high.

Evidence:
Largest customer share declined from 62% to 48%.

Relation:
COUNTERS
```

Frozen boundaries:

```text
COUNTERS ≠ CONTRADICTS
COUNTERS ≠ FALSE
COUNTERS ≠ WEAKEN
COUNTERS ≠ REVISE
COUNTERS ≠ REJECT
```

Relation describes direction only. Impact belongs to a later layer and is not
part of this contract.

### 3.3 NEUTRAL

Definition:

> The Evidence is sufficiently understood, but it does not provide meaningful
> directional support for or against the Claim's core proposition.

Example:

```text
Claim:
Customer concentration remains high.

Evidence:
The company opened a new office.

Relation:
NEUTRAL
```

Frozen distinction:

```text
understood but non-directional
→ NEUTRAL

not sufficiently understood
→ AMBIGUOUS
```

NEUTRAL must not be used as a catch-all for "not sure". NEUTRAL is a resolved
judgment, not a refusal to judge.

### 3.4 AMBIGUOUS

Definition:

> A meaningful relation may exist, but the available input is insufficient to
> determine that relation safely.

This is:

```text
intentional abstention
```

It is not:

```text
error
model failure
invalid input
```

Typical causes include:

```text
subject unclear
metric unclear
unit unclear
basis unclear
period unclear
comparison period missing
scope unclear
referent unclear
denominator missing
actuality unclear
qualifier meaning unclear
```

Example:

```text
Claim:
Revenue growth is accelerating.

Evidence:
Revenue grew 40%.

Relation:
AMBIGUOUS
```

Rationale: growth is not acceleration. The evidence reports a magnitude, but no
comparison growth rate, so no safe directional reading exists.

### 3.5 Abstention principle (frozen)

> FlowCredit prefers safe abstention over unsupported directional inference.

> It is better to know that the system does not know than to fabricate
> directional certainty.

An incorrect SUPPORTS or COUNTERS is more serious than one extra AMBIGUOUS.

## 4. Processing status is separate from relation

The following processing statuses are frozen:

```text
processingStatus:

RESOLVED
ABSTAINED
NOT_EVALUATED
ERROR
```

Processing status and relation are two different dimensions. Processing status
describes what the system did; relation describes the semantic judgment that
was reached, if any.

### 4.1 RESOLVED

RESOLVED means the semantic judgment completed successfully. Only these
combinations are legal:

```text
RESOLVED + SUPPORTS
RESOLVED + COUNTERS
RESOLVED + NEUTRAL
```

### 4.2 ABSTAINED

ABSTAINED means the input was valid and evaluation was permitted, but the
context is insufficient, so the system deliberately refuses a directional
judgment. Only this combination is legal:

```text
ABSTAINED + AMBIGUOUS
```

### 4.3 NOT_EVALUATED

NOT_EVALUATED means the relation engine was not allowed to perform semantic
evaluation at all. Examples:

```text
Evidence is not ACCEPTED
Claim Revision does not exist
Claim Revision unavailable as-of requested time
future evidence violates as-of policy
source integrity prerequisite fails
input contract invalid
```

Required output:

```text
processingStatus = NOT_EVALUATED
relation = null
```

### 4.4 ERROR

ERROR means evaluation was permitted, but an unexpected runtime failure
occurred. Examples:

```text
unexpected internal exception
model runtime failure after permitted retry policy
serialization failure
unexpected rule-engine failure
```

Required output:

```text
processingStatus = ERROR
relation = null
```

System failure must never be disguised as AMBIGUOUS.

### 4.5 Normative legal state matrix

| Processing Status | Relation           | Legal |
| ----------------- | ------------------ | ----- |
| RESOLVED          | SUPPORTS           | YES   |
| RESOLVED          | COUNTERS           | YES   |
| RESOLVED          | NEUTRAL            | YES   |
| RESOLVED          | AMBIGUOUS          | NO    |
| RESOLVED          | null               | NO    |
| ABSTAINED         | AMBIGUOUS          | YES   |
| ABSTAINED         | SUPPORTS           | NO    |
| ABSTAINED         | COUNTERS           | NO    |
| ABSTAINED         | NEUTRAL            | NO    |
| NOT_EVALUATED     | null               | YES   |
| NOT_EVALUATED     | any relation label | NO    |
| ERROR             | null               | YES   |
| ERROR             | any relation label | NO    |

This matrix is normative and must later be enforced by schemas and tests.

### 4.6 Invalid input is not ambiguity

Invalid or forbidden evaluation is not AMBIGUOUS.

Example — forbidden evaluation:

```text
Evidence.status = CANDIDATE
```

must not produce:

```text
AMBIGUOUS
```

it must produce:

```text
NOT_EVALUATED + null
```

Example — genuine ambiguity:

```text
Claim:
Revenue growth is accelerating.

Evidence:
Revenue grew 40%.
```

must produce:

```text
ABSTAINED + AMBIGUOUS
```

and must not be reported as ERROR.

## 5. Frozen invariants on identity and time

### 5.1 Revision-specific invariant

A RelationReceipt must bind:

```text
claimId
claimRevisionId
evidenceId
```

Rationale: the same Evidence can have different relations to different
historical revisions of the same Claim.

### 5.2 As-of invariant

Relation evaluation must be explicitly constrained by:

```text
asOf
```

Future Evidence must never enter:

```text
RelationInput
deterministic comparison
verifier input
LLM prompt
```

This inherits the existing Replay / look-ahead prevention principle of Research
Memory and the Claim Revision pipeline.

## 6. Boundary conditions

### 6.1 Relation is not Impact

```text
Relation
≠
Impact
```

For v0.12.1:

```text
Evidence
↓
Relation
↓
STOP
```

Only later layers may combine:

```text
Relation
+
Evidence Delta
+
Previous Claim State
+
Existing Evidence Balance
        ↓
Impact
        ↓
ClaimRevisionProposal
```

No Impact taxonomy is designed in this ADR.

### 6.2 No multi-evidence aggregation

Given:

```text
E1 → SUPPORTS
E2 → SUPPORTS
E3 → COUNTERS
```

Relation v1 must not compute:

```text
overallRelation
claimConfidence
weighted relation
net support
```

These belong to future Evidence Balance / Impact layers.

### 6.3 No generic confidence score

Frozen:

```text
No generic confidence score in Relation v1.
```

Designing output such as:

```text
confidence: 0.87
```

is forbidden, because it would be misread as Claim confidence, Evidence
quality, model probability, research conviction or investment probability.

The nature of a judgment must instead be expressed through:

```text
processingStatus
route
compatibility
reasonCodes
resolver metadata
```

### 6.4 No hidden inference authority

The following pattern is forbidden:

```text
LLM guesses semantic field
        ↓
deterministic resolver consumes it
        ↓
receipt claims deterministic resolution
```

The provenance of every critical field must remain visible downstream.
LLM-inferred semantics must never be silently upgraded into deterministic truth.

This ADR freezes the principle only; no `fieldOrigins` schema is designed here.
That belongs to Session 2.

## 7. Truth hierarchy and human authority

### 7.1 Truth hierarchy (frozen)

```text
Source
↓
Accepted Evidence
↓
Claim Revision
↓
Analytical Relation Receipt
```

A RelationReceipt is:

```text
analytical artifact
```

It is not:

```text
authoritative Research Memory truth
```

### 7.2 Human authority

```text
RelationReceipt
≠
Human Decision
```

Relation must never directly lead to:

```text
Claim mutation
ClaimRevision write
investment action
```

Future human review belongs to a downstream workflow, outside this contract.

## 8. Frozen semantic invariants

1. Relation inputs are one Accepted Evidence and one specific Claim Revision.
2. Relation evaluation is pairwise.
3. Relation labels are exactly SUPPORTS / COUNTERS / NEUTRAL / AMBIGUOUS.
4. COUNTERS is not contradiction, falsification, impact, or revision.
5. NEUTRAL means sufficiently understood but non-directional.
6. AMBIGUOUS means semantic abstention caused by insufficient safe context.
7. Invalid or forbidden evaluation is not AMBIGUOUS.
8. Processing status is independent from semantic relation.
9. NOT_EVALUATED and ERROR always have relation = null.
10. Relation is revision-specific.
11. Relation is as-of-aware.
12. Relation does not aggregate multiple Evidence records.
13. Relation does not mutate Claim state.
14. Relation does not expose generic confidence scores.
15. Relation output is an analytical artifact, not authoritative Research Memory.
16. Safe abstention is preferred over unsupported directional inference.
17. v0.12.1 terminates at RelationReceipt.

## Deferred to Session 2

The following are intentionally NOT frozen by this ADR:

- RelationInput v1 fields
- Claim semantic field structure
- Evidence semantic field structure
- fieldOrigins
- CompatibilityAssessment
- MATCH / MISMATCH / UNKNOWN / NOT_APPLICABLE semantics
- deterministic routing rules
- rule IDs
- verifier contract
- Qwen fallback policy
- RelationReceipt schema
- reason-code vocabulary
- benchmark composition
- release thresholds

## References

- `docs/adr/claim-relation-engine-v0.12-spike.md` — measured spike result and
  the hybrid direction this contract formalizes.
- `docs/claim-revision-proposal-v0.12.md` — as-of / Replay and look-ahead
  prevention principles the relation layer inherits.
