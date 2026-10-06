# v0.2C S1 Safety Failure Audit

Status: `AUDIT_FROZEN_NO_RUNTIME_CHANGE`

This audit covers only the five safety failures from the immutable v0.2C first-blind result:

- 3 directional inversions;
- 2 directional judgments on NEUTRAL / AMBIGUOUS gold.

It does **not** attempt to improve the 56.25% aggregate score.

## Finding 1 — second-order unsafe fallback

Four of five safety failures share one code path.

When a Claim asks for acceleration/deceleration, the current R2 runtime first tries to extract an explicit rate series. If that fails, it falls back to all numeric quantities in the Evidence:

~~~text
explicit comparable rates unavailable
        ↓
evidenceQuantities.map(scaled)
        ↓
treat arbitrary numbers as a rate series
        ↓
SUPPORTS / COUNTERS
~~~

That is unsafe.

Observed cases:

| Case | Gold | R2 | Safety failure |
| --- | --- | --- | --- |
| FRESH-COST-007 | AMBIGUOUS | SUPPORTS | unsafe direction |
| FRESH-JPM-004 | SUPPORTS | COUNTERS | inversion |
| FRESH-JPM-007 | AMBIGUOUS | COUNTERS | unsafe direction |
| FRESH-CRM-004 | SUPPORTS | COUNTERS | inversion |

The repair boundary is deliberately conservative:

> **No explicit comparable rate series → no directional second-order result.**

The next repair must remove the generic-number fallback and return `AMBIGUOUS` when two safely comparable rates cannot be bound.

## Finding 2 — causal contradiction loses precedence

`FRESH-CAT-008` is the most severe individual error:

~~~text
Gold: COUNTERS
R2:   SUPPORTS
~~~

Claim:

~~~text
higher sales volume fully offset cost / price pressure
→ operating profit increased
~~~

Evidence:

~~~text
operating profit decreased
negative cost / price effects
only partially offset by higher sales volume
~~~

R2 enters the causal-support path before evaluating the explicitly contradictory outcome direction. Causal wording plus lexical overlap can therefore overpower direct counter-evidence.

Safety invariant:

> **Explicit outcome contradiction must veto causal SUPPORTS.**

This becomes the second repair, after the broader second-order defect.

## Repair order

1. `S1-R1-SECOND-ORDER-FAIL-CLOSED`
2. `S1-R2-CAUSAL-CONTRADICTION-VETO`

The first repair is selected because it explains **4/5 safety incidents** and can be fixed by removing an unsafe directional fallback rather than adding more vocabulary.

## Hard boundary

During S1:

- v0.2C remains regression-only;
- the first-blind 18/32 result remains immutable;
- no label or threshold changes;
- no aggregate-score optimization;
- one safety family per repair branch;
- any repair that introduces a new directional inversion or unsafe directional judgment is rejected.
