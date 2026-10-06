# Investigate Loop v0.2

An abstention should be actionable.

The current offline loop turns a safe AMBIGUOUS RelationReceipt into a bounded research task:

~~~text
AMBIGUOUS
  -> identify missing context
  -> formulate explicit research question
  -> retrieve from a controlled local Evidence pool
  -> rebuild comparable context
  -> Relation re-evaluation
~~~

## Behavior fixture

The committed Northstar fixture starts with:

~~~text
Claim:
Revenue growth is accelerating.

Evidence:
Revenue grew 40 percent in 2026.
~~~

Initial result:

~~~text
ABSTAINED + AMBIGUOUS
RT_SECOND_ORDER_CONTEXT_MISSING
~~~

The planner creates:

~~~text
requirement:
PRIOR_COMPARABLE_RATE

question:
Find the previous comparable-period rate needed to test whether
revenue growth is accelerating.
~~~

The bounded retriever selects the most recent prior comparable Evidence:

~~~text
2025 revenue growth = 22 percent
~~~

The runtime then receives two comparable rates:

~~~text
22 percent -> 40 percent
~~~

and re-evaluates:

~~~text
RESOLVED + SUPPORTS
RT_SECOND_ORDER_SERIES
~~~

If the prior comparable Evidence is absent, the loop remains NEEDS_MORE_EVIDENCE and the original AMBIGUOUS receipt is retained.

## Verified properties

The CI behavior tests verify:

- one-point acceleration evidence still abstains,
- an explicit research question is created,
- retrieval uses the requested metric and a prior period,
- unrelated Evidence is ignored,
- 22% -> 40% resolves the synthetic acceleration example,
- an empty Evidence pool stays unresolved,
- zero network calls,
- zero model calls,
- no Claim mutation,
- a trace records evaluation → planning → retrieval → re-evaluation.

## Run

~~~bash
node research/investigate/cli.js
~~~

Focused tests:

~~~bash
node --test research/investigate-test/*.test.js
~~~

## Boundary

This is an **agent-loop behavior prototype**, not autonomous web research.

Current retrieval is a controlled local Evidence pool. A future tool-based investigator must preserve:

- as-of boundaries,
- Source grounding,
- Evidence admission,
- explicit provenance,
- bounded search,
- safe failure when required context cannot be found.

The investigator produces research work, not research authority.
