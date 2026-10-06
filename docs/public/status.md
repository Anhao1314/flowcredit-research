# Current status

Single source of public-facing maturity truth for FlowCredit Research.

Last updated: 2026-10-06 · Repository: development/test workspace · Branch: `main`.

## IMPLEMENTED / VALIDATED

| Capability | Where it lives |
| --- | --- |
| Research Memory: versioned Claims, revisions and superseded history | `research/memory/` |
| Evidence admission boundary and review records | `research/admission/` |
| Text and table grounding pipeline | `research/grounding/` |
| Hybrid retrieval over the internal corpus | `research/local-retrieval/` |
| Research workspace surface: local, read-only, loopback-only | `research/surface/` |
| Reproducible public synthetic demo | `research/surface/fixtures/public-demo/` |
| RelationInput resolver against read-only Research Memory | `research/claim-relation/resolve.js` |
| Compatibility runtime and fail-closed Relation gate | `research/claim-relation/compatibility.js`, `gate.js` |
| Conservative offline Relation runtime baseline | `research/relation-runtime/` |
| Development RelationReceipt with legal status/relation matrix | `research/relation-runtime/receipt.js` |
| Pairwise What Changed candidate preview + reproducible CLI fixture | `research/what-changed/` |
| Legacy deterministic risk-assessment prototype | `agent/` |

The Relation runtime is a baseline, not a production hybrid engine. It uses conservative deterministic rules after the frozen Compatibility gate and abstains when it cannot safely resolve a pair.

## ACCEPTED / FROZEN

| Contract / decision | Frozen |
| --- | --- |
| ADR-0.12.1 — Claim Relation Semantics | 2026-09-14 |
| Core Proposition Contract v1 | 2026-09-14 |
| Qualifier Contract v1 | 2026-09-14 |
| Grounding Contract v1 | 2026-09-15 |
| Field Provenance Contract v1 | 2026-09-15 |
| RelationInput Contract v1 | 2026-09-15 |
| Compatibility Contract v1 | 2026-09-16 |

The new RelationReceipt and What Changed candidate shapes are explicitly **development schemas**, not frozen contracts.

## RESEARCH VALIDATED

| Area | Evidence |
| --- | --- |
| Historical hybrid relation architecture | 38/41 on the synthetic development spike; not a generalization estimate |
| Hybrid retrieval | Recall@20 = 1.0 on a 16-case internal locked set |
| Grounded span corpus | 7,687 indexed spans in the internal research corpus |
| Compatibility gate | Frozen 41-pair regression split: 29 permitted / 12 refused |
| What Changed runtime behavior | committed 5-pair synthetic fixture covers SUPPORTS / COUNTERS / NEUTRAL / AMBIGUOUS / NOT_EVALUATED |

The 5-pair fixture is a behavior smoke test, not an accuracy benchmark.

## CURRENT

The repository now has an executable pairwise chain:

```text
Accepted Evidence + specific Claim Revision
  -> RelationInput
  -> CompatibilityAssessment
  -> Relation gate
  -> conservative deterministic Relation
  -> RelationReceipt
  -> directional What Changed review candidate
```

The chain stops at human review. It does not produce Impact and does not mutate Claims.

## PLANNED

- larger externalized Relation benchmark with human gold labels
- semantic projection runtime integration for Field Provenance and RelationInput
- verifier/model route with visible provenance and safe fallback
- Evidence Delta / Impact
- persisted human review workflow
- real multi-document What Changed loop

## LEGACY

- `agent/` and the static `index.html` are the earlier deterministic risk-assessment prototype line.
- Legacy Finch/API artifacts remain for historical regression compatibility.
- Legacy page-level grounding remains readable but does not satisfy Grounding v1.

## NOT CLAIMED

- production readiness or production deployment from this repository
- institutional-grade research quality
- external benchmark parity
- calibrated model accuracy
- autonomous Claim revision
- automatic investment decisions
- live customer outcomes or SLAs
- security certification

## Authority boundary

A RelationReceipt is an analytical artifact. A What Changed candidate is a review queue item.

Neither is authoritative Research Memory truth, Impact, a Claim revision, or an investment recommendation.

Human review remains mandatory before any future belief-state mutation.
