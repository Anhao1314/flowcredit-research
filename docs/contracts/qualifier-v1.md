# Qualifier Contract v1

Status: Accepted / Frozen for v0.12.1A

Parents:
- ADR-0.12.1 Relation Semantics
- Core Proposition Contract v1

Target: v0.12.1A — Session 2.2 Freeze Consolidation
Date: 2026-09-14

Normative scope: the Qualifier semantic contract, its slot model, frame
validity rules and legality constraints. This document is the normative truth
for Qualifier semantics from v0.12.1A onward. Where it and any earlier spike,
audit or working document disagree, this contract wins for v0.12.1A.

Lineage (design provenance, not normative):
`docs/design/session-2.2a-qualifier-audit.md` (empirical audit) ->
`docs/design/session-2.2b-qualifier-contract.md` (working contract) ->
`docs/design/session-2.2c-qualifier-adversarial-review.md` (adversarial
review, amendment set AMEND-Q01..Q10) -> Human amendments H-Q11 / H-Q12 ->
this document.

Out of scope and not designed here: Field Provenance schema, evaluation
resolution artifact schema, registry implementations, Grounding contract,
CompatibilityAssessment, routing, RelationReceipt, parser and runtime.

---

## 1. Purpose

Define the canonical single-sided semantic contract for the nine qualifier
contexts that surround a Core Proposition, so that:

```text
one proposition has one canonical QualifierFrame representation,
missing semantics never masquerade as null, default or unknown,
conflicts are never silently resolved,
and valid-but-incomplete propositions stay distinguishable from invalid ones.
```

The Qualifier layer answers, for one asserted proposition: what context does
this proposition carry that changes its interpretation, comparison validity,
scope, epistemic status, or the conditions under which it holds.

## 2. Position in the architecture

```text
Original Statement
+
Semantic Frame
  ├── Core Proposition        <- Core v1 (frozen)
  └── QualifierFrame          <- this contract
+
Grounding
+
Field Provenance (deferred)
```

Rules:

```text
QF-2.1  The QualifierFrame is a structured projection. It is NEVER the
        authoritative replacement for the original Claim/Evidence statement.
QF-2.2  Any language information that cannot be safely structured remains in
        the original statement. Filling qualifier slots by guessing is
        forbidden.
QF-2.3  Qualifier semantics MUST NOT re-absorb Core semantics. Subject,
        predicate, object, assertionType, direction and comparator remain
        owned by the frozen Core contract.
QF-2.4  Qualifier values are single-sided: one frame describes one
        proposition (one Claim Revision or one Evidence record). Pairwise
        comparison belongs to the Relation layer.
```

## 3. Frozen qualifier set

Exactly nine qualifier slots are frozen in v1:

```text
temporal
unit
denominator
basis
actuality
scope
comparisonReference
persistence
valueQuality
```

No tenth qualifier is added in v1.

## 4. QualifierSlot model

All nine canonical qualifier fields use one conceptual envelope:

```text
QualifierSlot<T> {
  state: PRESENT | NOT_APPLICABLE | REQUIRED_MISSING | CONFLICTED
  value: T            // exists if and only if state == PRESENT
}
```

```text
QualifierFrame {
  temporal            : QualifierSlot<TemporalQualifier>
  unit                : QualifierSlot<UnitQualifier>
  denominator         : QualifierSlot<DenominatorQualifier>
  basis               : QualifierSlot<BasisQualifier>
  actuality           : QualifierSlot<ActualityQualifier>
  scope               : QualifierSlot<ScopeQualifier>
  comparisonReference : QualifierSlot<ComparisonReferenceQualifier>
  persistence         : QualifierSlot<PersistenceQualifier>
  valueQuality        : QualifierSlot<ValueQualityQualifier>
}

SemanticFrame {
  coreProposition : CoreProposition | null     // frozen Core v1
  qualifiers      : QualifierFrame
  frameState      : VALID_COMPLETE | VALID_INCOMPLETE | INVALID
  missingSemanticRequirements : [ { slot, reason } ]
  conflicts                   : [ { slot, sources, detail } ]
}
```

Slot-state semantics (frozen):

```text
PRESENT
  The qualifier is applicable to this proposition, known, trusted and
  canonically represented. A value MUST exist.

NOT_APPLICABLE
  The qualifier has no semantic role for this proposition.
  It MUST NEVER be interpreted as: unknown, default, full-company, actual,
  exact, or any other value.

REQUIRED_MISSING
  The qualifier has semantic force for this proposition, but no trusted value
  could be safely obtained. The reason is recorded at frame level:
  NOT_STATED_IN_SOURCE | EXTRACTION_NOT_TRUSTWORTHY | NOT_DERIVABLE.
  REQUIRED_MISSING is a representation state, not a qualifier semantic value.

CONFLICTED
  Two or more semantic representations cannot be safely reconciled
  (for example: statement denominator = revenue, registry denominator =
  bookings). The slot is not trusted.
```

Canonical presence: all nine slots always exist. A missing slot property is
MALFORMED, never a semantic state.

Null rule: `null` is NOT the semantic state model of Qualifier v1. A
`value` is absent exactly when `state != PRESENT`; no reader may interpret
absence or null as UNKNOWN, defaults or failure.

## 5. Frame validity and completeness

Frozen three-state model (no scores anywhere):

```text
VALID_COMPLETE
  Core is valid; every proposition-required qualifier semantic is PRESENT or
  NOT_APPLICABLE; no unresolved conflicts.

VALID_INCOMPLETE
  Core is valid; no structural or authority conflict exists; at least one
  load-bearing qualifier is REQUIRED_MISSING.
  Meaning: the proposition is understandable enough to exist, but context is
  insufficient for safe full evaluation.
  Conceptually compatible with Session 1 ABSTAINED + AMBIGUOUS.

INVALID
  Includes: malformed Core; malformed QualifierSlot; illegal enum value;
  CONFLICTED load-bearing qualifier; silent semantic overwrite; invalid
  trusted derivation.
  Conceptually compatible with Session 1 NOT_EVALUATED + relation = null.
```

```text
QF-5.1  REQUIRED_MISSING != CONFLICTED. The former is information
        insufficiency; the latter is authority/representation disagreement.
        They MUST NOT be merged into one incomplete bucket.
QF-5.2  Frame validity and completeness are distinct concepts.
QF-5.3  No completeness score, confidence score, or partial-trust
        percentage exists.
QF-5.4  This contract defines frame states only. Mapping them onto
        processing status / relation labels is done by the Relation and
        Compatibility layers; no routing is implemented here.
QF-5.5  An INCOMPLETE frame MUST NOT be treated as invalid input, and an
        INVALID frame MUST NOT surface as semantic abstention.
```

## 6. Provenance and derivation

```text
QF-6.1  Every PRESENT trusted qualifier value must be provenance-compatible:
        its future Field Provenance origin is one of
        EXPLICIT_IN_STATEMENT | GROUNDED | REGISTRY_DERIVED.
QF-6.2  Any REGISTRY_DERIVED qualifier value MUST be materialized at
        SemanticFrame creation time. Read-time re-derivation is forbidden and
        MUST NOT change historical frames. (A registry v2 may not rewrite a
        historical frame created under registry v1.)
QF-6.3  Full registry/version provenance is designed in a later session
        (Session 2.4); this contract freezes only the expectation.
QF-6.4  MODEL_INFERRED semantics are never silently trusted. A model may
        propose; the Field Provenance / admission authority decides whether a
        value becomes trusted.
QF-6.5  No silent overwrite: a registry-derived value must never overwrite an
        explicit statement value; an explicit value must never be discarded
        in favor of a derived one.
```

## 7. Conflict policy

If the sources (statement, grounding, registry-derived value, stored
qualifier) disagree, the following are forbidden: silent pick, nearest
match, last-writer-wins, registry-wins, model-wins. Reconciliation MUST
return to Grounding + future Field Provenance. An unresolved conflict leaves
the slot CONFLICTED and the frame INVALID until resolved. Nothing in a
conflict list may be normalized away as "close enough".

## 8. Temporal

Answers: which time / period does the proposition describe.

```text
TemporalQualifier =
    { kind: PERIOD, start: date, end: date }      // explicit reported period
  | { kind: AS_OF,  at: date }                    // point-in-time state
  | { kind: LATEST, selector: LATEST }            // dynamic selector
```

```text
QF-8.1  PERIOD requires start < end. A single-day value is AS_OF, never a
        degenerate PERIOD.
QF-8.2  Q2 / FY / TTM are NOT Core DATE objects (Core v1 CP-6.11). Fiscal
        period labels resolve to calendar dates; calendar definitions belong
        to registry/grounding (deferred).
QF-8.3  LATEST is dynamic selector semantics (latest / latest observed /
        latest disclosed). It MUST NOT be statically rewritten into a period
        inside the frame.
QF-8.4  Selector vs resolution: the frame stores only the selector. The
        evaluation-specific resolution { asOf, resolvedPeriod } belongs to
        the evaluation artifact / receipt, never to proposition semantics.
QF-8.5  Replay invariant: a LATEST proposition resolved at
        executionContext.asOf = T1 MUST NOT later be re-resolved using future
        data. Historical evaluations are stable.
QF-8.6  qualifier.temporal is strictly distinct from executionContext.asOf:
        the qualifier answers what time the proposition describes; asOf
        answers at what information boundary the relation is evaluated.
QF-8.7  TTM / rolling periods are DEFERRED; when they arrive they must be a
        temporal kind, never a DATE object.
QF-8.8  Applicability: required for COMPARATIVE; proposition-shape-driven
        elsewhere; NOT_APPLICABLE only when the proposition carries no time
        semantics (for example a DATE-object proposition whose object IS the
        date).
```

## 9. Unit

Answers: in what quantity system the object is expressed.

```text
UnitQualifier =
    { dimension: MONEY, currency: <ISO-4217>, scale: UNITS | THOUSANDS |
      MILLIONS | BILLIONS }                       // as reported
  | { dimension: RATIO, form: PERCENT | RATIO }
  | { dimension: COUNT }
```

```text
QF-9.1  Active v1 quantity kinds are exactly MONEY, RATIO, COUNT
        (corpus-backed).
QF-9.2  RATIO.form = PERCENT | RATIO. RATIO itself does not imply a
        denominator or a comparisonReference.
QF-9.3  DATE_LIKE, OTHER, DURATION and BASIS_POINTS are NOT active kinds.
        No generic fallback kind exists: unsupported quantity semantics MUST
        NOT be hidden inside OTHER. A future corpus instance of 30 days /
        100 basis points / energy units / shares / tokens triggers a contract
        or registry extension, not an OTHER mapping.
QF-9.4  Core DATE / BOOLEAN / TEXT_CONCEPT objects need no Unit dimension.
QF-9.5  MONEY keeps the reported scale: "500 million USD" and "0.5 billion
        USD" are different reporting scales of the same quantity; the
        qualifier stores the value as reported and MUST NOT pre-normalize.
QF-9.6  Normalization / conversion mechanics belong to Provenance /
        normalization, not to the Unit semantic value.
QF-9.7  Unit guessing is forbidden; a unit that cannot be trustedly
        established makes the slot REQUIRED_MISSING, never a guessed value.
QF-9.8  Unit = PERCENT does not imply any denominator or comparison base.
```

Deferred: BASIS_POINTS, DURATION, generic OTHER (Section 16).

## 10. Denominator

Answers: the percentage / ratio is taken over which base quantity.
Applies to ratio / share-of-X / percentage-of-X propositions.

```text
DenominatorQualifier =
    { base: <registry-bound metric/concept ref>,
      period: TemporalQualifier | null,
      origin: EXPLICIT_IN_STATEMENT | REGISTRY_DERIVED }
```

```text
QF-10.1 For ratio/share propositions the denominator is part of proposition
        meaning and MUST be obtainable: "48% of revenue" and "48% of
        bookings" MUST NOT collapse.
QF-10.2 Registry derivation is allowed: top1_revenue_share -> revenue via a
        trusted deterministic registry binding.
QF-10.3 Conflict rules:
        explicit + registry consistent -> PRESENT (origin EXPLICIT_IN_STATEMENT)
        registry only                  -> PRESENT (origin REGISTRY_DERIVED)
        explicit != registry           -> CONFLICTED (no registry overwrite,
                                          no silent pick)
QF-10.4 All derived denominators materialize at frame creation; read-time
        derivation is forbidden (QF-6.2).
QF-10.5 Denominator != predicate identity; denominator != unit; denominator
        != scope. Growth-rate bases are comparisonReference semantics, not
        denominators.
QF-10.6 Applicability: required for ratio/share propositions; a ratio
        proposition whose base cannot be obtained is REQUIRED_MISSING.
```

## 11. Basis

Answers: the accounting / measurement basis that changes the meaning of the
reported quantity.

```text
BasisQualifier = { value: GAAP | NON_GAAP }
```

```text
QF-11.1 ADJUSTED is DEFERRED.
QF-11.2 Basis is ONLY accounting/measurement basis. It is never:
        preliminary / audited / final / consolidated / guidance / estimate.
QF-11.3 Canonical policy: if the registry already contains a basis-encoded
        canonical predicate (e.g. gaap_operating_margin), that predicate is
        the canonical predicate identity; the basis qualifier may be
        deterministically derived and materialized for explicit
        compatibility/audit.
QF-11.4 If predicate identity and basis qualifier conflict ->
        CONFLICTED; no silent reconciliation.
QF-11.5 Technical debt TD-Q1 records the open predicate/basis registry
        governance question (dual-encoded identities). Frozen Core v1 is not
        modified by this contract.
```

## 12. Actuality

Answers: does this proposition distinguish realized/observed state, management
guidance, or estimated/modelled state/value?

```text
ActualityQualifier = { value: ACTUAL | GUIDANCE | ESTIMATE }
```

```text
ACTUAL    the proposition purports to describe a realized / observed state
          or result. Including preliminary actual results.
GUIDANCE  forward-looking company / management guidance.
ESTIMATE  estimated / modelled non-realized quantity or state.
```

```text
QF-12.1 Actuality applicability is PROPOSITION-MODALITY-DRIVEN, not
        assertionType-driven. No assertionType automatically requires or
        forbids actuality.
QF-12.2 If the realized / guidance / estimate distinction is part of the
        proposition's meaning, the slot MUST be PRESENT or REQUIRED_MISSING.
        Otherwise it is NOT_APPLICABLE.
        Examples: "Revenue increased." -> ACTUAL; "Revenue guidance
        increased." -> GUIDANCE; "Estimated revenue increased." -> ESTIMATE;
        "Revenue was $5B." -> ACTUAL; "Guidance is $5B." -> GUIDANCE.
        Counterexamples: "Customer concentration remains a material risk.",
        "Management execution remains concerning.", "Customer concentration
        risk increased.", "Competitive pressure increased." -> the modality
        distinction is not part of these propositions' meaning; ACTUAL MUST
        NOT be forced.
QF-12.3 NOT_APPLICABLE must never be read as ACTUAL (no default reasoning).
QF-12.4 PRELIMINARY ACTUAL = ACTUAL. Report maturity
        (preliminary / final / audited / unaudited) does NOT belong to
        actuality; it lives in evidence status / provenance.
QF-12.5 Forbidden as actuality values: UNKNOWN, ANALYST_OPINION, ASSESSMENT,
        CURRENT, TARGET, PROJECTION.
QF-12.6 If modality is semantically required but cannot be safely
        determined: REQUIRED_MISSING, never an UNKNOWN enum.
QF-12.7 GUIDANCE requires a management/company forward-looking source;
        hedged or modelled non-realized quantities without such a source are
        ESTIMATE.
QF-12.8 A "guidance" word appearing as a proposition TOPIC (e.g. "Guidance
        remains conservative.") is not a modality marker by itself.
```

## 13. Scope

Answers: across what population / entity extent does the proposition apply.

```text
ScopeQualifier = {
  extent:     COMPANY_WIDE | SEGMENT | DIVISION | SUBSET
  population: { labels: [...] , count: n | null } | null
  coverage:   ALL | BROADLY | UNQUANTIFIED
}
```

```text
QF-13.1 No implicit default. "Missing scope -> COMPANY_WIDE" is FORBIDDEN.
        COMPANY_WIDE may only be explicit or trustedly derived from grounding
        / record context, with recorded provenance.
QF-13.2 Scope is population/entity extent, never a different subject.
        A different entity is a Core subject change (DEV-023 negative
        control).
QF-13.3 "broadly" is expressed as coverage = BROADLY; no numerical coverage
        may be invented for it (Core v1 CP-14).
QF-13.4 The model must express at least: company-wide; all divisions; all
        three segments (population count); broadly across company; a specific
        division/subset (population labels).
QF-13.5 NOT_APPLICABLE means the proposition asserts no extent semantics and
        MUST NOT be consumed as company-wide.
QF-13.6 When breadth is load-bearing and the extent is not stated or
        derivable: REQUIRED_MISSING. When sources disagree: CONFLICTED.
QF-13.7 Temporal quantification ("every month of the year") is temporal, not
        scope.
QF-13.8 Population fill rule (single canonical form): labels are stored when
        the statement names them, a count is stored when the statement
        numbers them, otherwise population is empty.
```

## 14. ComparisonReference

Answers: against what base is the comparison made.

```text
ComparisonReferenceQualifier =
    { kind: EXPLICIT_PERIOD, start: date, end: date }
  | { kind: PREVIOUS_PERIOD, granularity: YEAR | QUARTER | MONTH }
  | { kind: PREVIOUS_COMPARABLE_PERIOD, granularity: YEAR | QUARTER | MONTH }
  | { kind: PRIOR_RATE }
```

```text
QF-14.1 EXPLICIT_PERIOD is a period explicitly written in the proposition;
        it exists directly in the frame.
QF-14.2 PREVIOUS_PERIOD / PREVIOUS_COMPARABLE_PERIOD / PRIOR_RATE are
        SELECTORS. The frame stores selector semantics only; the resolved
        instance (e.g. Q1 2026, FY2025, the previous rate value) belongs to
        evaluation-side resolution.
QF-14.3 LATEST is NOT a comparisonReference. LATEST belongs to temporal
        selection.
QF-14.4 COMPARATIVE: when the proposition's meaning requires a comparison
        reference, the slot MUST be PRESENT or REQUIRED_MISSING; it MUST NOT
        be NOT_APPLICABLE disguised as absence.
QF-14.5 Definitionally comparative metric identities (e.g.
        revenue_yoy_growth -> PREVIOUS_COMPARABLE_PERIOD(YEAR)) may derive
        the selector via trusted registry binding, materialized per QF-6.2.
QF-14.6 Temporal describes the observation period; comparisonReference
        describes the baseline. They are independent axes and MUST NOT be
        merged.
QF-14.7 Ambiguity tie-break (single canonical selector): when the language
        admits more than one selector reading (for example "versus prior
        quarter" on a definitionally comparable metric), the definitional
        comparable kind wins for definitionally comparative metrics;
        otherwise the statement's own granularity wording decides exactly one
        selector.
```

## 15. Persistence

Answers: does an existing state / change pattern continue to hold.

```text
PersistenceQualifier = { kind: CONTINUATION }
```

```text
QF-15.1 Persistence is not split into statePersistence / changePersistence:
        the Core Proposition itself distinguishes the semantic shape being
        continued (direction / change vs state).
QF-15.2 CONTINUATION != STABLE. "Revenue continued to grow" is
        DIRECTION/INCREASE + persistence CONTINUATION; "Revenue stayed flat"
        may be DIRECTION/STABLE.
QF-15.3 Whether persistence is simultaneously PRESENT depends on whether the
        statement explicitly expresses continuation; it MUST NOT be forced.
QF-15.4 No fabricated persistenceStart or other invented temporal anchor.
QF-15.5 Persistence applies beyond direction and qualitative states — for
        example "Revenue remains above $5B" is THRESHOLD + CONTINUATION.
```

## 16. ValueQuality

Answers: whether the source / author reports the numeric value without
approximation language at its stated reporting precision.

```text
ValueQualityQualifier = { value: EXACT_AS_REPORTED | APPROXIMATE }
```

```text
EXACT_AS_REPORTED  the source explicitly provides a numeric value without
                   approximation language at its reporting precision.
                   NOT world absolute precision.
APPROXIMATE        source/author language explicitly indicates approximately,
                   about, roughly, rounded, or another safely canonicalizable
                   approximation.
```

```text
QF-16.1 Claim/Evidence asymmetry (frozen):
        Evidence numeric object: valueQuality REQUIRED.
        Claim numeric object:    valueQuality CONDITIONAL.
QF-16.2 A Claim expressing "approximately $5B" -> APPROXIMATE.
QF-16.3 An authored bound without reporting-exactness semantics
        ("exceeds $5B") -> NOT_APPLICABLE. EXACT_AS_REPORTED MUST NOT be
        forced onto claims.
QF-16.4 NOT_APPLICABLE never means exact.
QF-16.5 Evidence keeps the no-default rule: an absent valueQuality marker on
        a numeric evidence object is a contract violation, not an exact
        value.
QF-16.6 nearly / almost remain DEFERRED; silent normalization to APPROXIMATE
        (or to LT) is forbidden.
QF-16.7 APPROXIMATE and comparator semantics are independent and may
        co-occur ("approximately more than 50"). GT/GTE/LT/LTE remain
        comparators (Core v1 CP-9.2); APPROXIMATE never replaces a
        comparator.
QF-16.8 No precision bands or error ranges in v1.
```

## 17. Applicability guidance

All applicability is proposition-semantic; the triggers below are semantic,
not mechanical:

```text
temporal             required for COMPARATIVE; shape-driven elsewhere;
                     no time semantics -> NOT_APPLICABLE
unit                 required for numeric objects (MONEY/RATIO/COUNT);
                     Core DATE/BOOLEAN/TEXT_CONCEPT -> NOT_APPLICABLE
denominator          required for ratio/share propositions
basis                required for basis-sensitive measurement meaning
actuality            governed by QF-12.1 (modality-driven); never by
                     assertionType
scope                required when breadth is load-bearing or a non-default
                     extent is asserted; otherwise NOT_APPLICABLE (never a
                     fabricated company-wide default)
comparisonReference  required for COMPARATIVE semantics
persistence          present only if the statement expresses continuation
valueQuality         Evidence numeric required; Claim numeric conditional
```

Claim / Evidence asymmetry is frozen as follows: qualifier applicability does
not need to be symmetric between Claim and Evidence, but asymmetry itself is
never a Relation signal. The valueQuality asymmetry is the explicit designed
case; all other qualifiers follow proposition semantics on each side rather
than forced mirroring.

## 18. Superseded rules (historical context only — NOT active)

The following rules appeared in the design lineage and are explicitly
superseded by this contract. They must never be implemented as active rules
and are retained here only as history:

```text
- actuality REQUIRED on all five assertion types (2.2B), and
  assertionType-driven actuality conditioning (2.2C) -> superseded by H-Q11 /
  QF-12.1 (modality-driven).
- QUALITATIVE conditional actuality as an assertionType rule -> superseded
  by the modality test.
- scope null = full/default company extent -> superseded (QF-13.1).
- field absent / null as the missing-state representation for applicable
  qualifiers -> superseded by the slot envelope (REQUIRED_MISSING).
- UNKNOWN as an actuality (or any) qualifier value -> forbidden (QF-12.5).
- DATE_LIKE and OTHER unit dimensions -> removed from the active kinds
  (H-Q12 / QF-9.3).
- read-time derivation of registry-derived qualifiers -> forbidden (QF-6.2).
- stored LATEST resolution inside proposition semantics -> superseded
  (QF-8.4).
- EXACT_AS_REPORTED required on all numeric Claims -> superseded (QF-16.1).
- unresolved conflicts as an INCOMPLETE-frame reason -> superseded;
  CONFLICTED frames are INVALID (Section 5).
```

## 19. Deferred items

```text
generic condition / conditions[] semantics (load-bearing conditionality must
  never be silently discarded; e.g. "$30M per 100bp" must not simplify to
  "$30M" — such frames must expose required-but-unsupported semantics)
roleBinding (entity role resolution + temporal binding)
severity degree scales (severity stays with QUALITATIVE TEXT_CONCEPT states)
TARGET / PROJECTION actuality values
ADJUSTED basis value
BASIS_POINTS unit form
DURATION unit kind
TTM / rolling period kind
nearly / almost classification
valueQuality precision bands
scope quantifier expansion beyond ALL / BROADLY / UNQUANTIFIED
fiscal calendar registry
LATEST vocabulary split (observed vs disclosed)
TD-Q1 basis-encoded predicate registry governance
evaluation resolution schema (owner of LATEST / selector resolutions)
Field Provenance schema
CompatibilityAssessment
Routing
RelationReceipt
```

## 20. Normative invariants

```text
INV-Q-01   Nine canonical qualifier slots always exist.
INV-Q-02   QualifierSlot has an explicit state.
INV-Q-03   Missing applicable semantics never abuse null.
INV-Q-04   NOT_APPLICABLE never implies a default semantic value.
INV-Q-05   REQUIRED_MISSING is not a conflict.
INV-Q-06   CONFLICTED makes the trusted frame invalid until resolved.
INV-Q-07   Frame validity and completeness are distinct.
INV-Q-08   No completeness / confidence score.
INV-Q-09   Actuality applicability is modality-driven (never
           assertionType-driven).
INV-Q-10   Preliminary actual = ACTUAL.
INV-Q-11   No implicit company-wide scope.
INV-Q-12   LATEST selector != evaluation resolution.
INV-Q-13   Comparison selector != evaluation resolution.
INV-Q-14   Historical selector resolution is asOf-safe.
INV-Q-15   Unit v1 supports only corpus-backed quantity kinds (MONEY, RATIO,
           COUNT; no DATE_LIKE / OTHER / DURATION / BASIS_POINTS actives).
INV-Q-16   Unit does not imply denominator.
INV-Q-17   Denominator may be trustedly registry-derived but must be
           materialized.
INV-Q-18   Derived qualifier values never re-derive at read time.
INV-Q-19   Basis remains accounting/measurement basis only.
INV-Q-20   Persistence != STABLE.
INV-Q-21   ValueQuality is asymmetric Claim vs Evidence.
INV-Q-22   EXACT_AS_REPORTED != world absolute exactness.
INV-Q-23   Generic condition semantics are deferred, never discarded.
INV-Q-24   Severity is not a separate v1 qualifier.
INV-Q-25   RoleBinding is not a v1 qualifier.
INV-Q-26   No hidden model inference authority.
INV-Q-27   One proposition should have one canonical QualifierFrame
           representation.
INV-Q-28   Scope never encodes a different subject.
INV-Q-29   null is not the semantic state model for Qualifier v1.
```

---

## Cross-references

- ADR-0.12.1: relation taxonomy, abstention, as-of / replay, no confidence
  score, no hidden inference, truth hierarchy (unchanged; this contract
  implements its Session 2 qualifier deferral).
- Core Proposition Contract v1: subject / predicate / object / assertionType /
  direction / comparator ownership, CP-6.x object rules, CP-8.x, CP-9.x,
  CP-10 null rules, CP-11 legality, CP-12 canonical uniqueness, CP-13
  separation, CP-14 meaning-preserving normalization, CP-15 conflicts
  (unchanged).
- Session 2.2 processor artifacts: design provenance only, not normative.
