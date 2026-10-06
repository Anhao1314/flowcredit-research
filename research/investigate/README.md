# Investigate Loop v0.2

An abstention should be actionable.

The current offline loop turns a safe `AMBIGUOUS` RelationReceipt into a bounded research task:

```text
AMBIGUOUS
  -> missing-context plan
  -> local Evidence retrieval
  -> augmented comparison context
  -> Relation re-evaluation
```

The first behavior fixture uses the frozen acceleration example:

```text
Claim:    Revenue growth is accelerating.
Evidence: Revenue grew 40%.
```

Initial result: `ABSTAINED + AMBIGUOUS`.

The investigator asks for the prior comparable growth rate, retrieves a synthetic prior-period 22% observation from a controlled local Evidence pool, and re-evaluates 22% → 40%.

No web request, model call, Impact inference or Claim mutation is permitted in this experiment.

This is an **agent-loop behavior test**, not a claim that the system can autonomously research arbitrary companies yet.
