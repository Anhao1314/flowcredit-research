# Current status

Single source of public-facing maturity truth for FlowCredit Research.

Last updated: 2026-10-06 · Repository: development/test workspace · Branch: main after merge.

## IMPLEMENTED / VALIDATED

| Capability | Where it lives |
| --- | --- |
| Research Memory: versioned Claims, revisions and superseded history | research/memory/ |
| Evidence admission boundary and review records | research/admission/ |
| Text and table grounding pipeline | research/grounding/ |
| Hybrid retrieval over the internal corpus | research/local-retrieval/ |
| Research workspace surface: local, read-only, loopback-only | research/surface/ |
| RelationInput resolver against read-only Research Memory | research/claim-relation/resolve.js |
| Compatibility runtime and fail-closed Relation gate | research/claim-relation/compatibility.js, gate.js |
| Conservative prose/lexical Relation baseline | research/relation-runtime/deterministic.js |
| **Provenance-aware SemanticFrame projection runtime** | **research/semantic-frame/** |
| **Structured Semantic Compatibility + Relation path** | **research/relation-runtime/semantic-*.js** |
| Development RelationReceipt with legal status/relation matrix | research/relation-runtime/receipt.js |
| Pairwise What Changed review queue | research/what-changed/ |
| **Missing-context investigation planning** | **research/investigate/planner.js** |
| **Bounded local Evidence investigation loop** | **research/investigate/** |
| **Relation Reality reproducible benchmark + archived result** | **research/eval/relation-reality/** |
| Legacy deterministic risk-assessment prototype | agent/ |

SemanticFrame v0.2 consumes already-reviewed recorded fields. It does not yet perform arbitrary free-text semantic extraction.

The Investigate loop is currently an offline bounded behavior prototype over a controlled local Evidence pool. It is not autonomous web research.

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

The SemanticFrame development encoding, RelationReceipt and Investigation Plan are **not** newly frozen contracts. They remain versioned development runtime artifacts.

## RESEARCH VALIDATED

### Relation Reality v0.2

The real-source structured-correctness benchmark uses:

- 3 reviewed CoreWeave primary publications
- 32 reviewed Observations
- 4 explicit numeric-predicate Claims
- 128 pairwise evaluations

No LLM generates the oracle labels.

| Runtime | Exact structured-oracle match | Directional correct | Unsafe directional judgments | Runtime errors |
| --- | ---: | ---: | ---: | ---: |
| Prose / lexical baseline | 66 / 128 (51.56%) | 1 / 5 (20%) | 8 | 2 |
| SemanticFrame runtime | 128 / 128 (100%) | 5 / 5 (100%) | 0 | 0 |

Interpretation boundary:

**128 / 128 is not a claim of 100% open-ended financial-language accuracy.**

The benchmark oracle is intentionally limited to recorded metric identity, canonical unit family, recorded numeric value and explicit Claim comparator/threshold. It validates faithful execution of structured recorded facts. It does not validate general management-language interpretation, causal reasoning, arbitrary documents or unseen-domain generalization.

The directional subset is only five pairs.

The result artifact is research/eval/relation-reality/results.json and CI recomputes it.

### Investigate behavior v0.2

A committed synthetic behavior fixture verifies:

~~~text
Claim:
Revenue growth is accelerating.

Current Evidence:
Revenue grew 40 percent.

Initial:
ABSTAINED + AMBIGUOUS

Missing:
PRIOR_COMPARABLE_RATE

Retrieved local Evidence:
22 percent prior comparable rate

Re-evaluated:
22 -> 40
RESOLVED + SUPPORTS
~~~

The test confirms:

- no network call
- no model call
- explicit investigation question
- full trace from abstention through retrieval and re-evaluation
- missing prior context remains NEEDS_MORE_EVIDENCE
- no Claim mutation

### Earlier evidence retained

| Area | Evidence |
| --- | --- |
| Historical hybrid relation architecture | 38/41 on the synthetic development spike; not a generalization estimate |
| Hybrid retrieval | Recall@20 = 1.0 on a 16-case internal locked set |
| Grounded span corpus | 7,687 indexed spans in the internal research corpus |
| Compatibility gate | 29 permitted / 12 refused on frozen 41-pair regression set |

These experiments answer different questions and must not be combined into one accuracy number.

## CURRENT

The repository now has two executable relation paths.

Structured recorded facts:

~~~text
Accepted Evidence / Claim Revision
  -> SemanticFrame with field origins
  -> RelationInput
  -> Compatibility gate
  -> structured deterministic Relation
  -> RelationReceipt
~~~

Safe abstention:

~~~text
ABSTAINED + AMBIGUOUS
  -> Investigation Plan
  -> bounded local Evidence retrieval
  -> re-evaluation
  -> resolved Relation or NEEDS_MORE_EVIDENCE
~~~

What Changed exposes:

- PENDING_HUMAN_REVIEW for directional SUPPORTS / COUNTERS receipts
- NEEDS_INVESTIGATION for valid but insufficient AMBIGUOUS receipts
- no queue promotion for NOT_EVALUATED input

The chain still stops before Impact and authoritative Claim mutation.

## PLANNED

- independently human-labeled 500+ pair semantic Relation benchmark
- SemanticFrame materialization directly from real Research Memory + Grounding
- model/verifier-assisted semantic projection with explicit model provenance
- bounded tool-based investigator beyond the controlled local Evidence pool
- Evidence Delta / Impact
- persisted human review workflow
- real multi-document What Changed loop

## LEGACY

- agent/ and the root static prototype are the earlier deterministic risk-assessment line.
- Legacy Finch/API artifacts remain for historical regression compatibility.
- Legacy page-level grounding remains readable but does not satisfy Grounding v1.
- The prose/lexical Relation runtime is retained as a measured baseline, not the preferred path for structured recorded fields.

## NOT CLAIMED

- production readiness or production deployment from this repository
- institutional-grade research quality
- 100% open-ended financial reasoning accuracy
- external benchmark parity
- calibrated model accuracy
- autonomous arbitrary-company web research
- autonomous Claim revision
- automatic investment decisions
- live customer outcomes or SLAs
- security certification

## Authority boundary

A SemanticFrame is a structured projection with provenance. A RelationReceipt is an analytical artifact. An Investigation Plan is a research question.

None is authoritative Research Memory truth, Impact, a Claim revision, or an investment recommendation.

Human review remains mandatory before any future belief-state mutation.
