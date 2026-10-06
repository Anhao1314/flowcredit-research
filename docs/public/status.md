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
| Research Workbench UI-2.0: local, read-only, loopback-only | research/surface/ |
| RelationInput resolver against read-only Research Memory | research/claim-relation/resolve.js |
| Compatibility runtime and fail-closed Relation gate | research/claim-relation/compatibility.js, gate.js |
| Conservative prose/lexical Relation baseline | research/relation-runtime/deterministic.js |
| **Provenance-aware SemanticFrame projection runtime** | **research/semantic-frame/** |
| **Research Memory Evidence → SemanticFrame adapter** | **research/semantic-frame/memory-adapter.js** |
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


### SEC Semantic Relation Pilot v0.2A

A complementary curated pilot evaluates open-text pairwise semantics that the CoreWeave structured oracle intentionally does not cover.

- 32 Evidence × Claim pairs
- Apple 2025 10-K, Microsoft 2025 10-K, NVIDIA 2026 10-K
- numeric, temporal-order, hard-negative, second-order, mix and causal challenges
- evidence statements are paraphrased facts with SEC accession URLs and section locators
- status: `PILOT_SINGLE_REVIEW_NOT_PUBLICATION_GOLD`

| Runtime | Exact | Directional | Unsafe direction | Inversion | Ambiguous abstention |
| --- | ---: | ---: | ---: | ---: | ---: |
| Default lexical baseline | 71.88% | 78.26% | 33.33% | 4.35% | 80% |
| Isolated v0.2A candidate | **100%** | **100%** | **0%** | **0%** | **100%** |

The v0.2A.1 candidate passes all five experimental thresholds and reproduces all 32 pilot labels, but it is **not promoted to the default runtime**. The pilot lacks independent double review and a blind locked partition. The final fix was a generic candidate-only tokenizer repair for embedded identifier digits (`H20`, `A100`, `Q2`, `GPT-5`); benchmark labels, frozen Compatibility semantics, and the validated baseline were not changed.

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


### Blind SEC Holdout v0.2B

The isolated `relation-candidate/v0.2a.1` was frozen before first evaluation on a new 24-case holdout from Amazon, Alphabet and Meta 2025 Form 10-K filings.

| Metric | Result |
| --- | ---: |
| Exact state accuracy | **17 / 24 (70.83%)** |
| Directional accuracy | **66.67%** |
| Directional inversion | **0%** |
| Unsafe directional error | **0%** |
| AMBIGUOUS abstention recall | **66.67%** |
| Existing phase gate | **FAIL** |

This is the first source-isolated generalization check after the 32/32 SEC development pilot. It demonstrates that the candidate does **not** yet meet the promotion threshold on unseen issuers. The primary observed weakness is under-resolution of causal, metric-binding, mix and second-order relations; no unsafe directional error was observed in this 24-case holdout.

The holdout is single-review and not publication gold. Its bytes, candidate-runtime blobs, and gate are pinned in `research/benchmark/holdout-v0.2b-lock.json`. The failure is retained as research evidence and must not be erased by relabeling or threshold changes.

#### Causal repair replay R1

The first isolated repair adds recognition for the narrow financial attribution construction `primarily/largely/mainly reflected`. It does not alter the original candidate or first-blind result.

| Metric | First blind | R1 replay |
| --- | ---: | ---: |
| Exact | 17/24 (70.83%) | **18/24 (75.00%)** |
| Directional | 66.67% | **72.22%** |
| Unsafe direction | 0% | **0%** |
| Causal attribution | 1/3 | **2/3** |
| Gate | FAIL | **FAIL** |

R1 repaired exactly one archived case, Amazon's explicit `primarily reflected` attribution. The remaining Meta causal failure is a different driver/outcome metric-role binding problem and is deliberately left for a separate repair cycle.


#### Causal repair replay R2

R2 adds a minimal causal-role representation for explicit constructions:

~~~text
driver -> outcome
~~~

The runtime aligns the driver and outcome separately instead of relying on undifferentiated lexical overlap between the two financial statements.

| Metric | First blind | R1 | R2 |
| --- | ---: | ---: | ---: |
| Exact | 17/24 (70.83%) | 18/24 (75.00%) | **19/24 (79.17%)** |
| Directional | 66.67% | 72.22% | **77.78%** |
| Causal attribution | 1/3 | 2/3 | **3/3** |
| Directional inversion | 0% | 0% | **0%** |
| Unsafe direction | 0% | 0% | **0%** |
| Gate | FAIL | FAIL | **FAIL** |

R2 repaired exactly one additional archived case, the Meta driver/outcome role-binding failure. It remains an isolated experimental candidate and is not promoted to the default runtime. R1/R2 replay results are repair evidence, not fresh blind generalization estimates.


### Fresh Blind Holdout v0.2C — PROTOCOL FROZEN

The next source-isolated evaluation is frozen before dataset construction.

| Item | Frozen state |
| --- | --- |
| Runtime | `relation-candidate/v0.2b-r2` |
| Base commit | `b7817dedd1c6d9b59cde15558b2036ca421c4ff7` |
| Issuers | 4 previously unused issuers |
| Cases | 32 total, 8 per issuer |
| Gate | unchanged v0.2A thresholds |
| Dataset | **locked: 32 cases / 4 issuers** |
| Score | **does not exist yet** |

The selected unseen issuers are Costco Wholesale Corporation, JPMorgan Chase & Co., Salesforce, Inc. and Caterpillar Inc. Each contributes exactly eight cases. Apple, Microsoft, NVIDIA, Amazon, Alphabet, Meta and CoreWeave remain excluded.

Dataset Git blob SHA: `5602c516d3333f1fde665738fc8385bcd7b8a6d0`.

The frozen R2 runtime was executed once against this dataset. The first-run result is:

| Metric | Result |
| --- | ---: |
| Exact | **18/32 (56.25%)** |
| Directional accuracy | **50.00%** |
| Directional inversion | **15.00%** |
| Unsafe directional error | **16.67%** |
| AMBIGUOUS abstention recall | **25.00%** |
| Gate | **FAIL — all five checks** |

This fresh cross-industry result is the current generalization signal. It overrides any temptation to interpret the v0.2B repair progression (17/24 → 18/24 → 19/24) as evidence of broad generalization. R2 is not ready for promotion.

The result is immutable at `research/benchmark/results/real-sec-fresh-blind-v0.2c-first-run.json`, pinned by `research/benchmark/holdout-v0.2c-result-lock.json`.

Current state: **`FIRST_BLIND_ARCHIVED_FAIL`**. v0.2C is now regression-only.

#### Safety failure audit S1

The five archived safety failures are now traced to two implementation families:

| Root cause | Incidents | Priority |
| --- | ---: | --- |
| Second-order generic-number fallback | **4 / 5** | **Repair first** |
| Causal support before outcome contradiction | **1 / 5** | Repair second |

The second-order path is the broader safety defect: when an explicit comparable rate series is unavailable, generic Evidence quantities can be treated as a rate series and produce unsupported direction. The next candidate repair must remove that fallback and abstain instead.

This audit changes no runtime behavior. Its purpose is to freeze the safety diagnosis and repair order before code changes begin.


## PLANNED

- independently human-labeled 500+ pair semantic Relation benchmark
- explicit Claim semantic binding for real Research Memory; Evidence adaptation is implemented, while prose-only Claims remain fail-closed
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
