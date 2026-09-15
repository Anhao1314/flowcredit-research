# Current status

Single source of public-facing maturity truth for FlowCredit. Other public documents link here instead of restating status.

Last updated: 2026-09-15 (Asia/Shanghai) · Repository: development workspace, branch `main`.

## IMPLEMENTED / VALIDATED

| Capability | Where it lives |
| --- | --- |
| Research Memory (versioned claims, revisions, superseded history) | `research/memory/` |
| Claim Revision proposal pipeline (proposal → pending human review; no apply writer) | `research/claim-revision/` |
| Evidence admission boundary (review records, no silent admission) | `research/admission/` |
| Text and table grounding pipeline | `research/grounding/` |
| Hybrid retrieval over the internal corpus | `research/local-retrieval/` |
| Research workspace surface (local, read-only, loopback-only) | `research/surface/` |
| Deterministic assessment engine and its API contracts (legacy prototype line) | `agent/` |

Each has offline test suites; the visible ones run in CI, and the local surface suite is published (see Repository completeness below); it runs locally from a Research Memory SQLite file or the offline public-demo fixture.

## ACCEPTED / FROZEN

| Contract | Frozen |
| --- | --- |
| ADR-0.12.1 — Claim Relation Semantics | 2026-09-14 |
| Core Proposition Contract v1 | 2026-09-14 |
| Qualifier Contract v1 | 2026-09-14 |
| Grounding Contract v1 | 2026-09-15 |

Frozen contracts state their own status, parents and revision history. Later sessions extend them; they do not get silently edited.

## RESEARCH VALIDATED

| Area | What that means here |
| --- | --- |
| Hybrid relation architecture (deterministic + verifier + small local model) | Measured 38/41 (0.927) on a synthetic development spike set; the deterministic layer decides 30/41 and is correct on what it decides. Not a generalization estimate. |
| Hybrid retrieval | Recall@20 = 1.0 on a 16-case internal locked set, with materially lower results at smaller cutoffs. Small internal set, not an external benchmark. |
| Grounded span corpus | 7,687 indexed spans in the internal research corpus. |

## CURRENT

- Field Provenance (how a structured value was produced: explicit, registry-derived, inferred) is the next design session.
- The frozen contracts are the semantic spine; runtime work continues against them.

## PLANNED

- Field Provenance contract
- RelationInput v1
- CompatibilityAssessment
- Production relation engine
- Evidence Delta / Impact
- Real What Changed loop
- Public demo fixture path

## LEGACY

- The deterministic risk-assessment prototype (External Alpha v0.1.x) is retained in `agent/` and `docs/`, with its own release history. It is not the current research direction.
- The static browser demo (`index.html`) is a historical simulation, not an integrity verification or stress-testing API.
- Legacy page-level grounding records stay readable and honest, and never satisfy Grounding v1.
- The earlier prototype's own boundaries still apply: simulated calibration references, no live connector verification, no lending or payment decisions, and a Finch integration contract that is not submitted, approved or certified. Its documentation remains in `docs/` (`docs/public-api-v1.md`, `docs/finch/`).

## NOT CLAIMED

- Production readiness, or any deployment from this repository.
- Institutional grade, enterprise ready, fully autonomous, or fully reliable behaviour.
- Live external evidence connectors, real customer data, or customer outcomes.
- Calibrated model accuracy, external benchmark parity, uptime or SLAs.
- Automated What Changed: no production loop turns new evidence into a revised belief today.
- Security certification of any kind.

## Repository completeness

The local research surface is published; some remaining research workspaces (the relation spike) and the frozen contract directories can still lag the working tree until they are committed. Runtime data — Research Memory databases, model sessions, logs — intentionally lives outside the repository and is never committed.
