# FlowCredit Research Evidence Bridge v0.1

## 1. Executive Summary

Implemented an independent, deterministic Source → Evidence → Claim → Mapping → Coverage bridge. The first CoreWeave corpus contains **3 primary publications, 32 evidence items and 4 supported predicate claims**. This is a compatibility assessment, not an investment or credit recommendation. No LLM is used.

The actual current schema supports none of these public-company dimensions fully: **0 full, 4 partial, 16 unsupported, 1 ambiguous** across **21 public dimensions**. Strict coverage is **0%**; explicitly weighted compatibility is **9.52%**. Quarter/year statements lack the exact month/operator inputs and independent metering provenance required by FlowCredit. These numbers assess model compatibility, not CoreWeave's creditworthiness.

As of: 2026-09-13T08:41:06Z. Formal input contract checksum: `sha256:a57665f65e80b2bd71d37e6fd9541dbe12263e1a2edee2344f55f5564dc36917`.

## 2. Current FlowCredit Baseline

The [pre-implementation audit](../research/REPOSITORY_AUDIT.md) records actual inspected modules, not README assumptions. Baseline is **109/109 existing tests**, not 100. Root has no package.json; the locked Node/Ajv toolchain is under agent/. Formal schemas live in agent/contracts/, not an assumed agent/schema/.

Current intake is flowcredit.intake/v0.3.1 for AI-native inference operators, with USD, million Tokens, GPU-hours and a 27–31-day primary date-difference window. The correct field is **overdue30Pct**, not overdue30d. Readiness tracks 24 decision fields, grouped missing data/evidence and five server-derived fields.

The authoritative v0.2.1 engine computes TAI from five metering/coherence components (10/35/25/20/10%) and CCI from five risk dimensions (40/25/15/10/10%). Missing dimensions propagate null; grade A/A-/B/C/D thresholds are 800/750/650/500, with confirmed veto forcing D. Grade is not approval. Current normalization/peer profiles are simulations; real data remains provisional with these references. PD, expected loss and recommended limits are intentionally uncalibrated/null.

Evidence quality combines completeness, provenance, recency, coverage and consistency; document-only and insufficient-domain caps remain. SEC primary publication cannot become system_api/cryptographic/cross_verified or an independent operator source domain. Only independently confirmed Sybil, evidence tampering or related-party manipulation can trigger hard-event veto. Litigation or reporting control weaknesses do not meet those semantics.

Server facts F1–F12 and 30-minute in-memory sessions are explanation support, not a durable Claim Store. Public API and Finch share the formal intake, deterministic assessment and canonical fingerprints; Research does not participate in them.

## 3. Research Evidence Model

- **Source:** stable subject/publisher/document-key identity; seven publication types; dates/fiscal period; primary classification; exact original-byte hash or explicit unavailability. URL alone never defines identity.
- **Evidence:** smallest reviewed observation, original and normalized value/unit, explicit conversion, metric/scope/period, source ID, section/page/location, observation date, provenance, confidence, hash and creation time. Graph validation rejects orphans, cross-subject references and altered normalization/hash.
- **Claim:** separate research predicate with supporting/counter evidence, confidence and supported/partially_supported/disputed/unverified/stale status. Supported status requires real primary evidence; deterministic builder evaluates declared threshold predicates, latest observations and staleness.
- **Mapping:** actual current contract field/component, full/partial/unsupported/ambiguous status, distinct corpus availability, cited evidence IDs, transformation/restriction and full-only candidate value. No candidate is emitted for partial or ambiguous context.

Extraction is from reviewed observations, **not automated PDF parsing or independent truth verification**. Confidence is reviewed extraction confidence, not a calibrated financial probability. Schemas validate shape; graph validation establishes internal traceability, not authenticity.

Corpus: [2025 official annual PDF with embedded 10-K](https://s205.q4cdn.com/133937190/files/doc_financials/2025/ar/2025-Annual-Report.pdf), [Q2 2026 official IR-linked 10-Q](https://d18rn0p25nwr6d.cloudfront.net/CIK-0001769628/9f708637-612f-4da7-bef2-4a4b667f9d64.pdf), [Q2 2026 release filed as SEC Exhibit 99.1](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000362/coreweave2q26earningspress.htm). Two PDF checksums were measured from downloaded bytes; release direct retrieval returned 403, so its original hash remains null. The annual checksum covers the IR wrapper PDF, not SEC HTML. Full corporate documents/runtime are outside the repository. See [corpus provenance/locator notes](../research/fixtures/coreweave/README.md).

## 4. CoreWeave Compatibility Matrix

Generated from current formal input schema + reviewed Evidence + explicit research/rules/mappings.json; illustrative FULL examples in the prompt were not adopted as conclusions. Public rows define the denominator; operator rows are additional checks.

<!-- BEGIN GENERATED MATRIX -->
| Research field | Current FC target | Status | Corpus availability | Evidence | Restriction |
|---|---|---|---|---:|---|
| Revenue | revenueUsd | PARTIAL | available | 5 | Consolidated quarterly/annual revenue is context only; no monthly allocation or inference scope inferred. |
| Growth | — | UNSUPPORTED | available | 1 | No current input/dimension implements this public-company concept. |
| Gross margin | — | UNSUPPORTED | unavailable | 0 | GAAP cost of revenue excludes expenses classified in technology/infrastructure; do not label the residual as the engine compute contribution margin. |
| Operating margin | — | UNSUPPORTED | available | 1 | No current input/dimension implements this public-company concept. |
| Cash | — | UNSUPPORTED | available | 1 | No current input/dimension implements this public-company concept. |
| Cash flow | — | UNSUPPORTED | available | 1 | No current input/dimension implements this public-company concept. |
| Debt | — | UNSUPPORTED | available | 4 | Issuer debt is not currentExposure, which is counterparty exposure. |
| Leverage | — | UNSUPPORTED | unavailable | 0 | No current input/dimension implements this public-company concept. |
| CapEx | — | UNSUPPORTED | available | 1 | No current input/dimension implements this public-company concept. |
| Compute spend | computeSpendUsd | PARTIAL | available | 2 | Cost of revenue and technology/infrastructure are distinct accounting expense lines, not measured inference compute spend. |
| Customer concentration | top5ConcentrationPct | PARTIAL | available | 3 | Top-three percentages give related context, not an exact Top-five share; payingCustomers remains missing. |
| Top customer concentration | top5ConcentrationPct | PARTIAL | available | 2 | Top-one revenue share cannot be inserted as Top-five share. |
| Backlog / RPO | — | UNSUPPORTED | available | 2 | No current input/dimension implements this public-company concept. |
| Guidance | — | UNSUPPORTED | available | 1 | No current input/dimension implements this public-company concept. |
| Operating history | operatingHistoryDays | AMBIGUOUS | available | 1 | Founding month/platform launch year do not establish days covered by operating records; no incorporation-age conversion. |
| Revenue concentration | — | UNSUPPORTED | available | 2 | Geographic/product revenue mix is not customer Top-five concentration. |
| Liquidity | — | UNSUPPORTED | available | 2 | No current input/dimension implements this public-company concept. |
| Risk factors | — | UNSUPPORTED | available | 1 | No current input/dimension implements this public-company concept. |
| Integrity / legal / reporting events | integrityEvents | UNSUPPORTED | available | 2 | Reporting weaknesses/litigation do not establish any of the three independently confirmed hard-event codes. |
| Valuation | — | UNSUPPORTED | unavailable | 0 | No current input/dimension implements this public-company concept. |
| Industry context | — | UNSUPPORTED | unavailable | 0 | No current input/dimension implements this public-company concept. |
| gpuHours | gpuHours | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| inputTokensM | inputTokensM | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| outputTokensM | outputTokensM | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| validRatePct | validRatePct | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| repaymentRatePct | repaymentRatePct | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| overdue30Pct | overdue30Pct | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| payingCustomers | payingCustomers | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| monthlySeries | monthlySeries | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| evidence | evidence | UNSUPPORTED | unavailable | 0 | Not disclosed at required operator/window granularity in this reviewed corpus. |
| provenance | evidence | PARTIAL | available | 32 | Research traceability is reusable; primary_source is not an accepted verification enum and SEC is not an operator source domain. |
<!-- END GENERATED MATRIX -->

All per-row transformations and source/evidence/claim records are available through:

`node research/src/coverage.js coreweave --json`

## 5. Coverage Result

| Measurement | Actual result |
|---|---:|
| Sources | 3 |
| Evidence items | 32 |
| Claims | 4 |
| Public dimensions | 21 |
| Full | 0 |
| Partial | 4 |
| Unsupported | 16 |
| Ambiguous | 1 |
| Strict coverage | 0% |
| Weighted compatibility | 9.52% |

Strict = full/N ×100. Weighted = (full + 0.5×partial)/N ×100; ambiguous/unsupported=0; empty denominator=0; output rounded to two decimals. N is the 19 requested public dimensions plus valuation and industry context, not operator rows or evidence count. The partial weight is an explicit convention, not measured readiness. Shared customer facts may support correlated categories; no statistical independence is claimed.

Revenue, compute-spend accounting context and two concentration categories are partial. Covered operating history is ambiguous. Quarterly consolidated revenue cannot be prorated into monthly inference revenue. Top-one/Top-three percentages cannot become exact Top-five; incorporation month cannot become covered-record days. These restrictions explain the low compatibility without modifying the existing model.

Corpus availability is distinct from capability. Gross margin, leverage, valuation and industry context have no extracted fact in this small corpus; guidance has a publication-location statement but no numeric forecast. “Unavailable” does not mean that the issuer never discloses it elsewhere. Unsupported concepts can still have valid research Evidence.

## 6. Existing Capabilities Reusable for Research

| Actual capability | Reuse and boundary |
|---|---|
| Canonical hashing / shared JSON schemas | Reusable validation pattern and reproducible fingerprints; checksums do not authenticate a source |
| Evidence coverage/readiness | Reusable missing-data/evidence distinction; existing 24-field denominator is operator-specific and not used for Research coverage |
| Provenance/quality | Existing recency, verification and source-domain concepts inform explicit provenance; existing quality score is not applied to SEC sources |
| Integrity findings / confirmed events | Useful separation of indicators from confirmed facts; legal/reporting disclosures remain research facts, never hard-event veto |
| Deterministic risk engine | Reusable discipline of fixed rules and authoritative validation; no TAI/CCI/grade computation on issuer disclosures |
| F1–F12 / SessionStore | Existing bounded explanation context; not persistent research storage, cross-document version history or Claim Store |

## 7. Major Gaps

Actual current contract/risk dimensions lack issuer **debt, leverage, liquidity, cash flow, CapEx, backlog/RPO, guidance, valuation and industry context** capabilities. Current exposure is counterparty exposure and cannot stand in for debt. The compute contribution margin is not GAAP gross/operating margin. Customer inputs require Top-five and paying-customer counts; physical/metering inputs require actual GPU-hours, input/output Tokens and validity classifications. Monthly continuity additionally needs six contiguous Token/revenue/compute rows, not quarters.

Some raw inputs for future research calculations already exist in this corpus (cash, debt classifications, current assets/liabilities, cash flows), but ratios, calibration, research risk semantics and valuation are not implemented. Numeric guidance, leverage/gross-margin definitions and external industry context require separately reviewed source coverage. No invented value fills these gaps.

## 8. Architecture Recommendation

**Prioritize a Claim Store next**, before Hybrid RAG, Research Risk Model or LLM-Wiki. The immediate bottleneck is durable, versioned Source/Evidence/Claim provenance, supersession, corrections and reproducible as-of retrieval; the current session store cannot provide it. A small append-only store with explicit revision relationships and reviewed predicates would make subsequent retrieval grounded and evaluable.

Hybrid RAG can follow once curated documents and versioned evidence have reliable locators and retrieval tests. A Research Risk Model requires a separate issuer schema, metric definitions, calibration and human evaluation; it must not repurpose operator TAI/CCI. LLM-Wiki is a presentation/synthesis layer after provenance and revision control exist. No second-stage implementation, storage backend, vector/graph database, trading or investment recommendations were added.

## Delivery record and acceptance

| File | Change |
|---|---|
| research/REPOSITORY_AUDIT.md | Pre-code authority and isolation audit |
| research/README.md | Architecture, commands, methodology, compatibility boundaries |
| research/package.json | Private ES-module/Node package, no new dependencies |
| research/schemas/source.schema.json | Publication identity, type, dates and hash-status contract |
| research/schemas/evidence.schema.json | Fact/provenance/locator/normalization contract |
| research/schemas/claim.schema.json | Separate judgment/reference/status contract |
| research/schemas/mapping.schema.json | Compatibility/availability/transformation contract |
| research/rules/mappings.json | Explicit public/operator taxonomy and semantic mapping rules |
| research/fixtures/coreweave/sources.json | Three reviewed primary source manifests and retrieval evidence |
| research/fixtures/coreweave/observations.json | 32 dated/located factual observations, original units |
| research/fixtures/coreweave/claims.json | Four explicit research predicates |
| research/fixtures/coreweave/README.md | Corpus caveats, page conventions and source links |
| research/src/schema.js | Locked Ajv validation and read-only actual contract field validation |
| research/src/identity.js | Canonical hashes, stable identities, duplicate detection |
| research/src/normalize-source.js | Publication normalization/identity validation |
| research/src/extract-evidence.js | Explicit fact normalization and graph/provenance validation |
| research/src/build-claims.js | Deterministic predicates, reference/status/staleness checks |
| research/src/map-flowcredit.js | Actual intake window and explicit semantic compatibility evaluation |
| research/src/coverage.js | Deterministic counts, matrix and offline text/JSON CLI |
| research/test/bridge.test.js | Schema/mapping/coverage/provenance/claim/CLI regressions |
| agent/scripts/check-syntax.js | Include Research JavaScript in existing syntax checks |
| agent/scripts/verify-release.js | Include Research tests in full development verification |
| .github/workflows/ci.yml | Explicit Research tests with existing locked toolchain/read-only permissions |
| docs/research-evidence-bridge-v0.1.md | This report; runtime-generated complete matrix and delivery record |

Final acceptance: **109/109 existing tests + 25/25 new Research tests**, zero failures/skips. JavaScript syntax (73 files), frontend discipline (17 files), development isolation (146 files/one read-only workflow), repository-external TypeScript 5.9.2 and full verification passed. Full verification includes both test suites, Public API/Finch contract tests and validators, secret/artifact checks and local External Alpha smoke/graceful shutdown. CLI was also checked from outside the repository, with text/JSON output and explicit invalid-subject/option errors. The committed matrix is checked against runtime generation.

Git diff confirms zero changes to assets/, index.html, AGENTS.md, agent/src/, agent/contracts/, existing agent/test/, agent package/lock and all frozen formulas/state/UI. CSS is unchanged; no CSS balance change was introduced. Origin remains the development repository, upstream push remains disabled and the production-blocking pre-push hook remains executable. No deployment, release tag or platform submission. Remote CI execution and external-user/source-connector validation are not claimed by these local checks.
