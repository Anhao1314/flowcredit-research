# v0.2C S1 Safety Failure Audit

Status: `AUDIT_FROZEN_NO_RUNTIME_CHANGE`

This audit covers only the five safety failures from the immutable v0.2C first-blind result. It does **not** modify R2 and it does **not** optimize the 18/32 aggregate result.

## Frozen provenance

| Artifact | Frozen identity |
| --- | --- |
| First-blind result | `research/benchmark/results/real-sec-fresh-blind-v0.2c-first-run.json` · blob `0916d30a964d6878d1de8b683c42d37ae9773527` |
| Locked dataset | `research/benchmark/data/real-sec-fresh-blind-v0.2c.json` · blob `5602c516d3333f1fde665738fc8385bcd7b8a6d0` |
| Evaluated runtime | `relation-candidate/v0.2b-r2` · `candidate-r2-deterministic.js` blob `2b8b612e2f27fbf67722ba26a9f8e06cb6244676` |

v0.2C is regression-only after this archived first run. A repair replay is never a new blind result.

## Executable failure taxonomy

Severity is about safety, not embarrassment:

- **CRITICAL**: a resolved directional judgment is inverted against directional gold.
- **HIGH**: the runtime emits direction where the locked gold requires `ABSTAINED + AMBIGUOUS`.

| Case | Failure | Severity | Root cause | Affected rule | Case-specific trigger |
| --- | --- | --- | --- | --- | --- |
| `FRESH-COST-007` | AMBIGUOUS → SUPPORTS | HIGH | `SF-SECOND-ORDER-UNSAFE-FALLBACK` | `RT_SECOND_ORDER_SERIES` | Only absolute 2024/2025 membership-fee revenue levels; no prior growth-rate comparison. |
| `FRESH-JPM-004` | SUPPORTS → COUNTERS | CRITICAL | `SF-SECOND-ORDER-UNSAFE-FALLBACK` | `RT_SECOND_ORDER_SERIES` | Evidence has 9% growth in 2024 and 12% in 2025, but current temporal rate binding does not yield two distinct comparable rates; generic fallback takes over. |
| `FRESH-JPM-007` | AMBIGUOUS → COUNTERS | HIGH | `SF-SECOND-ORDER-UNSAFE-FALLBACK` | `RT_SECOND_ORDER_SERIES` | Only one 3% annual growth observation plus an absolute level; generic fallback fabricates a second-order series. |
| `FRESH-CRM-004` | SUPPORTS → COUNTERS | CRITICAL | `SF-SECOND-ORDER-UNSAFE-FALLBACK` | `RT_SECOND_ORDER_SERIES` | Evidence has 9% growth in fiscal 2025 and 10% in fiscal 2026, but temporal rate binding fails and generic fallback takes over. |
| `FRESH-CAT-008` | COUNTERS → SUPPORTS | CRITICAL | `SF-CAUSAL-CONTRADICTION-PRECEDENCE` | `RT_EXPLICIT_CAUSAL_ATTRIBUTION` | Evidence says operating profit decreased 15% and volume only partially offset pressure; causal SUPPORTS returns before outcome contradiction can veto it. |

## Generic defect A — second-order unsafe fallback

Four of five safety failures share one generic defect:

~~~text
second-order claim
      ↓
orderedRateSeries does not yield 2 safely comparable rates
      ↓
evidenceQuantities.map(scaled)
      ↓
absolute levels / isolated rates / unrelated numbers become a pseudo-series
      ↓
unsupported SUPPORTS or COUNTERS
~~~

The unsafe part is **not** that parsing can miss a valid rate pair. Parsers miss things. The unsafe part is converting that miss into a directional answer using generic numbers.

Two subgroups matter:

1. **Insufficient evidence by construction**: `FRESH-COST-007`, `FRESH-JPM-007`. These must abstain.
2. **Valid rates present but parser coverage misses them**: `FRESH-JPM-004`, `FRESH-CRM-004`. These expose a separate `RATE_SERIES_TEMPORAL_BINDING_GAP`. After the safety repair they may safely abstain until that coverage defect is repaired on its own branch.

Safety invariant:

> **No two safely bound explicit comparable rates → no directional second-order result.**

## Generic defect B — causal contradiction precedence

`FRESH-CAT-008` is a separate defect family.

Claim:

~~~text
higher sales volume fully offset cost / price pressure
→ operating profit increased
~~~

Evidence:

~~~text
operating profit decreased 15%
negative cost / price effects
only partially offset by higher sales volume
~~~

The current causal path can return `RT_EXPLICIT_CAUSAL_ATTRIBUTION / SUPPORTS` before explicit outcome direction is checked.

Safety invariant:

> **Explicit contradiction of the claimed outcome must veto causal SUPPORTS.**

## Frozen repair priority

1. `S1-R1-SECOND-ORDER-FAIL-CLOSED`
   - remove the generic-number fallback from second-order resolution;
   - do not expand rate parsing in the same repair;
   - accept safe abstention on JPM-004 / CRM-004 if necessary;
   - reject any new directional inversion or unsafe direction on the locked v0.2C regression set.
2. `S1-R2-CAUSAL-CONTRADICTION-VETO`
   - enforce outcome contradiction before causal SUPPORTS;
   - keep this isolated from second-order work.

Aggregate accuracy is explicitly **not** the acceptance criterion for either safety repair.

## Hard boundary

During S1:

- no R2 runtime modification;
- no benchmark-case, gold-label, threshold, dataset-byte, or first-blind-result modification;
- no ordinary non-safety accuracy repair;
- no parser-coverage repair;
- no R2 promotion;
- no later v0.2C replay may be described as blind.
