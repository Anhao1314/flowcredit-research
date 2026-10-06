# AGENTS.md — FlowCredit Research collaboration rules

This file defines how humans and coding agents may change this repository. README explains the product; frozen contracts and ADRs define semantics; this file defines engineering discipline.

## 1. Repository identity

Repository: `Anhao1314/flowcredit-research`.

This is a **development and test workspace for auditable investment-research memory**. It is not a production deployment repository.

The current direction is:

```text
Source
-> Grounding
-> Evidence admission
-> Research Memory
-> RelationInput
-> Compatibility
-> RelationReceipt
-> What Changed review candidate
-> human authority
```

The older deterministic risk-assessment / Finch prototype remains under `agent/`, `assets/` and historical docs. It stays tested for regression compatibility but is **legacy**, not the product direction.

## 2. Truth hierarchy

When documents disagree, use this order:

1. accepted/frozen contracts in `docs/contracts/`
2. accepted/frozen ADRs in `docs/adr/`
3. `docs/public/status.md` for maturity claims
4. runtime code and tests
5. README / design history

Never change a frozen contract merely to make an implementation or benchmark pass. A frozen semantic change requires an explicit new version or ADR.

## 3. Human authority

Hard boundary:

```text
AI / rules propose analysis.
Humans retain research authority.
```

Code in this repository must not silently:

- admit Evidence,
- mutate a Claim,
- rewrite historical state,
- convert a Relation into Impact,
- aggregate multiple Evidence records inside Relation v1,
- make an investment decision.

A RelationReceipt is analytical only. A What Changed candidate is pending review only.

## 4. Relation invariants

The frozen Relation layer remains:

```text
1 Accepted Evidence
x
1 specific Claim Revision
x
1 explicit asOf
```

Legal state matrix:

- `RESOLVED + SUPPORTS|COUNTERS|NEUTRAL`
- `ABSTAINED + AMBIGUOUS`
- `NOT_EVALUATED + null`
- `ERROR + null`

Never use NEUTRAL as “not sure”. Never use AMBIGUOUS for invalid or forbidden input. Prefer abstention over unsupported direction.

No generic confidence score belongs in Relation v1.

## 5. Current runtime boundary

The development runtime is:

```text
research/claim-relation/resolve.js
research/claim-relation/compatibility.js
research/claim-relation/gate.js
research/relation-runtime/
research/what-changed/
```

The deterministic resolver is intentionally conservative and offline. Adding a model/provider route must preserve:

- visible provenance,
- explicit route identity,
- fail-closed behavior,
- no hidden promotion of model guesses into deterministic truth,
- no network requirement for core regression tests.

Development RelationReceipt / What Changed candidate shapes are not frozen contracts unless a later contract explicitly says so.

## 6. Research Memory integrity

Historical records are append/version oriented. Do not overwrite history to simplify a test.

As-of boundaries are integrity-bearing. Future information must never leak into:

- RelationInput,
- Compatibility,
- deterministic resolution,
- verifier/model prompts,
- RelationReceipt.

Corrections and superseded Evidence remain inspectable.

## 7. Legacy isolation

Treat `agent/`, root `index.html`, `assets/` and Finch-era artifacts as legacy unless the task explicitly targets them.

Do not:

- revive legacy product claims in public docs,
- couple new research runtime logic to the static legacy UI,
- remove legacy tests merely because the current direction changed.

The existing agent test glob is also used as a repository-wide CI entry point; thin importers for research suites are allowed.

## 8. Public-claim discipline

Public surfaces must distinguish:

- `IMPLEMENTED / VALIDATED`
- `ACCEPTED / FROZEN`
- `RESEARCH VALIDATED`
- `CURRENT`
- `PLANNED`
- `LEGACY`

Do not claim production readiness, institutional grade, customer outcomes, benchmark parity, calibrated accuracy, or deployment unless evidence for that exact claim exists.

Synthetic demos must be labelled synthetic.

## 9. Required verification

At minimum for code changes:

```bash
cd agent
npm run check
```

Research suites relevant to the change must also pass. Important direct commands include:

```bash
node --test research/claim-relation-test/*.test.js
node --test research/relation-runtime-test/*.test.js
node --test research/surface-test/*.test.js
```

CI is the final repository gate. Do not merge a red PR.

## 10. Commit discipline

- use focused commits with conventional English prefixes
- no force push or history rewriting
- preserve frozen-contract provenance
- commit deterministic fixtures needed for reproducibility
- never commit API keys, local databases, model sessions, logs or machine-specific paths

A delivery note should state what changed, which authority boundary was preserved, and which tests actually passed.
