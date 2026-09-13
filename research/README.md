# FlowCredit Research Evidence Bridge v0.1

A small, offline, deterministic bridge from reviewed public disclosures to traceable research facts, explicit claims and a compatibility assessment against the **current** FlowCredit intake contract.

It is not an Investment Agent, stock picker, trading system, new Risk Engine, RAG platform or LLM-Wiki implementation. It produces no investment advice, credit decision, TAI, CCI or risk grade.

## Run

From the repository root, with the existing locked `agent/` dependencies available:

```sh
node research/src/coverage.js coreweave
node research/src/coverage.js coreweave --json
node --test research/test/*.test.js
```

Node 22.19 or ≥24 is supported, matching the repository. CI installs the existing agent package-lock; Research adds no dependencies or package-lock. Local dependencies/runtime stay outside the repository according to AGENTS.md. Paths resolve from module locations, not the caller's working directory. Unknown subjects, options, references and invalid schemas fail explicitly.

## Architecture

```text
Source (stable publication identity + original-byte hash when available)
  ↓ normalize-source.js
Evidence (reviewed observation → explicit unit normalization + source/locator)
  ↓ extract-evidence.js
Claim (separate, explicit threshold predicate + supporting/counter evidence)
  ↓ build-claims.js
FlowCredit Mapping (current contract + explicit rules + period/scope/metric)
  ↓ map-flowcredit.js
Coverage Audit (public taxonomy counts; no assessment invocation)
  ↓ coverage.js
```

`extract-evidence.js` consumes curated, reviewed observations. It is **not an automatic PDF/HTML parser**. No LLM or live connector is introduced. The first corpus is three CoreWeave primary publications with 32 factual observations and four explicit predicate claims. Raw corporate documents were reviewed/downloaded outside the repository and are not redistributed here.

## Core schemas

Draft 2020-12 schemas reject unknown properties and invalid dates, confidence ranges, hashes and enum values:

- Source supports seven publication types, subject/publisher/document key, URL, document and retrieval dates, fiscal period/year, primary classification and nullable original-byte hash with an explicit unavailable status. Stable IDs use subject, publisher and document key, never URL alone. `isPrimarySource` is reviewed metadata, not automatic publisher authentication.
- Evidence retains raw and normalized values, explicit conversion, metric, scope, dates, source ID, section, page or location, verification and provenance. IDs/content hashes use canonical fact payloads; creation time is excluded. Cross-subject, orphan, duplicated or tampered facts fail validation. Numeric unit normalization is recomputed during validation.
- Claim separates judgment from facts. Statuses: supported, partially_supported, disputed, unverified, stale. Supported claims require actual primary-source evidence and cannot contain counter evidence. Builder uses declared metric/unit/threshold predicates at the latest observation and an explicit as-of/staleness window. Confidence is a reviewed extraction attribute, **not a calibrated probability that the company disclosure is true**.
- Mapping declares public/operator group, target field/component, status, availability, evidence IDs, transformation, restrictions and candidate value. Only full numeric mappings can emit an input candidate. Partial mappings emit context, never a silently converted input.

The mapping target names and numeric bounds come from the real shared `agent/contracts/finch-assess-input.schema.json`; the scoring window is read from immutable `INTAKE_SCHEMA_V03`. Research never changes these authorities. The shared Ajv toolchain is loaded via agent package resolution. These are the only core/tooling dependencies; no server, risk-core, model harness, browser state or session store is imported.

## Coverage algorithm

The versioned declarative taxonomy has 21 public dimensions: the 19 requested categories plus valuation and industry context. Nine operator fields and provenance are checked separately and do not enlarge the denominator.

- Strict coverage = full / N × 100.
- Weighted compatibility = (full + 0.5 × partial) / N × 100.
- Ambiguous and unsupported contribute zero; N=0 yields zero. Round to two decimals only at output.
- One row per public dimension; duplicates/unknown statuses/groups fail. Categories can reuse a fact, so this measures compatibility breadth, not independent signals.

The partial weight is a transparent convention, not measured task completion or evidence readiness. Changing taxonomy/weight requires an explicit new methodology and regression update. Availability is separate: a concept can be disclosed but unsupported, or not found in this small corpus. “Unavailable” is **not** a claim that no public disclosure exists anywhere.

## Boundary

Existing FlowCredit Risk Engine **≠** Research Coverage Engine.

Revenue/costs require matching AI inference API scope, exact metric, validated units and the actual 27–31-day date-difference window. Consolidated quarter/year revenue is partial context. Accounting cost of revenue is not compute spend; Top-one/Top-three is not Top-five; founding age is not covered operating records. Legal/control disclosures are not confirmed Sybil, tampering or related-party hard events. SEC/IR publication is not system API, cryptographic or cross-verified operator evidence. A checksum detects changed bytes, not authenticity or financial truth.

No API, TAI/CCI/grade calculation, Finch schema/version, UI, authentication or deployment behavior is changed. Only development syntax/CI/full verification checks gain Research coverage. The v0.1 fixture pipeline remains unchanged; the independent [Research Memory Core v0.2](memory/README.md) now persists Sources, Evidence and Claim revisions with historical queries.

See [pre-implementation audit](REPOSITORY_AUDIT.md), [corpus notes](fixtures/coreweave/README.md) and [full compatibility report](../docs/research-evidence-bridge-v0.1.md).

Independent [Research Retrieval Layer v0.3](retrieval/README.md) searches verified raw documents and validates Candidate citations. It never writes accepted Evidence or Claim revisions.

[Evidence Admission Layer v0.4](admission/README.md) adds explicit immutable human reviews, atomic Evidence admission and duplicate recognition. It never changes Claims.

Research Evidence Analyst v0.5: [CLI and boundary](analyst/README.md), [delivery](../docs/research-evidence-analyst-v0.5.md).

Research Evidence Analyst Real Model Validation v0.6: [opt-in CLI and offline tests](analyst-real/README.md), [actual experiment and A–P delivery](../docs/research-evidence-analyst-real-validation-v0.6.md). The configured real model did not meet the conversion gate; recommendation is STAY on Evidence Analyst.

Evidence Analyst Contract Stabilization v0.7 introduces [two-pass quote discovery and raw-text interpretation](analyst-staged/README.md), conservative deterministic parsing and the unchanged final validator. Actual capability and phase-gate findings are recorded in the [v0.7 delivery](../docs/evidence-analyst-contract-stabilization-v0.7.md).

Source Grounding Layer v0.8 replaces quote generation with deterministic [SourceSpan grounding and LLM span selection](grounding/README.md): TextSpan/TableSpan registry, stable ids and hashes, explicit `unsupported_table_layout` abstention and the unchanged final validator. The real benchmark, Gold reclassification and phase decision are recorded in the [v0.8 delivery](../docs/source-grounding-layer-v0.8.md).
Evidence Support Contract v0.9 adds the versioned [SourceSupport union](evidence-support/README.md): deterministic sentence TextSpans, TableSupport (cell plus verified row/column/unit context) and Grounded Validator V2, with the v0.5 validator frozen and human admission unchanged. The v0.8-versus-v0.9 benchmark and the phase decision are recorded in the [v0.9 delivery](../docs/evidence-support-contract-v0.9.md).
