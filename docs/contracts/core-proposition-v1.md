# Core Proposition Contract v1

Status: Accepted / Frozen for v0.12.1A

Parent:
ADR-0.12.1 — Claim Relation Semantics

- Version: v1 · Frozen 2026-09-14 · Session 2.1 Freeze Consolidation
- Human decision: Option B — MODIFY THEN FREEZE (Session 2.1C amendments approved and incorporated).
- Normative scope: the Core Proposition field contract and its legality rules. This document is the normative truth for Core Proposition semantics from v0.12.1A onward.
- Lineage (design provenance, not normative): `docs/design/session-2.1a-core-proposition-audit.md` (empirical audit) → `docs/design/session-2.1b-core-proposition-contract.md` (working contract) → `docs/design/session-2.1c-core-proposition-adversarial-review.md` (adversarial review, amendment set).
- Out of scope and not designed here: Qualifiers (Session 2.2), Compatibility, routing, RelationReceipt, Field Provenance schema, registry implementations.

---

## 1. Purpose

Define the canonical structured projection of an asserted proposition so that:

```text
the same proposition has one canonical structured meaning,
different propositions cannot accidentally collapse into the same structure,
and missing semantics cannot silently become invented semantics.
```

The Core Proposition is minimal, typed, registry-bound, provenance-compatible and context-preserving. It structures only what can be justified from verified content; everything else remains in the original statement or in future Qualifiers.

---

## 2. Position in the architecture

Frozen architecture (this contract designs only the Core Proposition):

```text
Original Statement
+
Semantic Frame
  ├── Core Proposition        <- this contract
  └── Qualifiers              <- Session 2.2 (deferred)
+
Grounding
+
Field Provenance
```

Rules:

```text
CP-2.1  The Core Proposition is a structured projection. It is NEVER the
        authoritative replacement for the original Claim/Evidence statement.
        The original statement is preserved verbatim and remains authoritative text.
CP-2.2  Any language information that cannot be safely structured remains in the
        original statement or in future Qualifiers. Filling fields by guessing is
        forbidden.
CP-2.3  A Semantic Frame MAY exist with semanticFrame.coreProposition = null.
        This means: the original proposition exists, but no trusted canonical Core
        could safely be produced. This whole-frame state is fundamentally different
        from a Core field whose value is null (section 10).
```

---

## 3. Canonical structure

```text
CoreProposition {
  subject
  predicate
  object
  assertionType
  direction
  comparator
}
```

```text
CP-3.1  All six fields MUST be present in every canonical representation, even when
        a field's legal value is null. Canonical serialization MUST NOT depend on
        missing-field differences.
CP-3.2  A field that is absent is MALFORMED. Absence is not UNKNOWN, not null, and
        not a semantic state; a malformed Core is a contract violation and cannot be
        a trusted input.
CP-3.3  When an assertionType does not use a field, that field's legal value is null.
```

---

## 4. Subject

### 4.1 Subject v1

```text
Subject {
  kind: ENTITY | ENTITY_ROLE
  ref:  <registry-bound identifier>
}
```

```text
CP-4.1  Subject kinds are exactly ENTITY and ENTITY_ROLE.
CP-4.2  Subject.kind = CONCEPT is REMOVED. It created subject/predicate ownership
        overlap and multiple canonical representations (adversarial finding
        DEFECT-1), and no real, locked or dev corpus case requires it. Conceptual
        meaning is carried by predicate + object.
CP-4.3  A future need for a non-entity, non-role subject MUST be handled by a new
        contract revision with a corpus case. No hidden CONCEPT fallback may exist.
```

### 4.2 Entity binding vs proposition subject

```text
CP-4.4  snapshot.subjectId answers: "This Research Memory record belongs to which
        entity?" It is the record-level binding.
CP-4.5  coreProposition.subject answers: "What is this proposition specifically
        about?" It is the proposition-level subject.
CP-4.6  The two MUST NOT be conflated or interchanged.
        Example: snapshot.subjectId = CoreWeave; coreProposition.subject may be
        {ENTITY_ROLE, largest_customer} (or {ENTITY, CoreWeave} when the
        proposition is about the entity itself).
```

### 4.3 Implicit subject

```text
CP-4.7  An implicit subject MAY be filled only when trusted record/context metadata
        resolves it unambiguously (for example: a statement without a named entity
        in a record whose subjectId is known).
CP-4.8  The provenance of any implicit fill MUST be recorded by Field Provenance
        (schema deferred). A model-proposed subject MUST NOT be silently promoted
        to TRUSTED.
CP-4.9  An explicitly named different subject always wins over the record metadata
        and is a semantic signal, never a fill error to be overwritten.
```

### 4.4 Role labels

```text
CP-4.10 ENTITY_ROLE denotes the role itself (e.g. largest_customer). It does not
        denote the period-local concrete label bound to that role.
CP-4.11 The concrete label for a period (e.g. Microsoft as a given period's largest
        customer) belongs to future Qualifier / Grounding / Role Binding design.
CP-4.12 Core MUST NOT carry both the role and its concrete label as a double
        subject representation (e.g. largest_customer + Microsoft must not appear as
        duplicated subject semantics).
```

---

## 5. Predicate

### 5.1 Predicate v1

```text
Predicate {
  kind:  METRIC | CONCEPT
  value: <registry-bound identifier>
}
```

```text
CP-5.1  Predicates are registry-bound identifiers. Arbitrary free text MUST NOT be
        used as a deterministic predicate.
CP-5.2  kind selects the namespace; a value valid in one namespace is not thereby
        valid in the other.
```

### 5.2 METRIC namespace

METRIC denotes a measurable quantity / measured financial or operational dimension, e.g.:

```text
revenue
revenue_yoy_growth
gaap_operating_margin
top1_revenue_share
operating_cash_flow
```

```text
CP-5.3  Metric identity MUST preserve base quantity, scope and measurement meaning.
CP-5.4  Metric identities MUST NOT be merged for registry convenience. Level metric,
        change metric and rate metric are distinct identities. Examples that must
        stay distinct:
        revenue | revenue growth | revenue YoY growth |
        subscription revenue | subscription revenue growth
CP-5.5  A bound applied to a change metric is a COMPARATIVE proposition; a bound
        applied to a level metric is a THRESHOLD proposition. Predicate identity is
        the discriminator; delta readings additionally require a resolvable
        comparison reference (Qualifier).
```

### 5.3 CONCEPT predicate namespace

CONCEPT denotes a non-numeric research topic / semantic dimension. Candidate future values include:

```text
liquidity
customer_concentration
risk_materiality
management_execution
```

```text
CP-5.6  Composite topic+state predicate ids are FORBIDDEN. For example, ids such as
        customer_concentration_material_risk, liquidity_constrained or demand_weak
        MUST NOT be created when they combine a topic with a qualitative state.
CP-5.7  The concept registry implementation and governance are DEFERRED. The
        namespace contract in this document is frozen now.
CP-5.8  Qualitative state values live in the object TEXT_CONCEPT namespace, not in
        the predicate namespace (AMEND-03).
```

### 5.4 Unknown predicate behavior

```text
CP-5.9  For an unknown label, all of the following are FORBIDDEN:
        nearest-match mapping to an existing predicate;
        silent registry creation;
        free-text deterministic predicate;
        promoting an LLM guess to a trusted registry id.
CP-5.10 When a predicate cannot be safely canonicalized, the original statement is
        kept and NO trusted Core Proposition is produced.
```

---

## 6. ObjectValue

### 6.1 Union

```text
ObjectValue =
  NUMBER
  BOOLEAN
  TEXT_CONCEPT
  DATE
  null
```

```text
CP-6.1  The union is closed. RANGE, ENTITY_REF, generic JSON and free-text objects
        MUST NOT be added in v1.
```

### 6.2 NUMBER

```text
NUMBER {
  number
}
```

```text
CP-6.2  NUMBER MUST support negative, zero, decimal and positive values.
CP-6.3  NUMBER MUST NOT contain currency, scale, percent, unit, period,
        denominator or basis. Those belong to Qualifiers.
CP-6.4  For THRESHOLD, the object represents the threshold bound, not an observed
        value (e.g. object 30 + comparator GTE).
```

### 6.3 BOOLEAN

```text
BOOLEAN {
  value: true | false
}
```

```text
CP-6.5  Boolean normalization is allowed only when it is meaning-preserving:
        a single lexical negation, scope-equivalent to the predicate, with no
        degree semantics.
        Allowed examples (predicate disclosure_controls_effective):
        "ineffective" -> false; "not effective" -> false.
CP-6.6  Statements such as "materially ineffective", "partially effective" and
        "not fully effective" MUST NOT be collapsed to boolean false. Degree and
        severity are load-bearing semantics.
CP-6.7  While a severity/degree qualifier does not exist (deferred), no trusted
        canonical Core is preferred over an incorrect boolean normalization.
```

### 6.4 TEXT_CONCEPT

TEXT_CONCEPT is a registry-bound qualitative state value, e.g. future values:

```text
material_risk
constrained
weak
favorable
elevated
tight
```

```text
CP-6.8  TEXT_CONCEPT MUST store a canonical concept id only. Natural-language
        phrases (e.g. "customer concentration remains a very material risk") MUST
        NOT be stored.
CP-6.9  TEXT_CONCEPT is the object namespace for qualitative states under the Q3
        ownership rule (predicate owns the topic, object owns the state).
```

### 6.5 DATE

```text
DATE {
  value
  precision: YEAR | YEAR_MONTH | FULL_DATE
}
```

Examples:

```text
2017        -> YEAR
2017-09     -> YEAR_MONTH
2017-09-12  -> FULL_DATE
```

```text
CP-6.10 DATE holds calendar point values with internal precision.
CP-6.11 Q2 2026, FY2026 and TTM are NOT DATE objects. Fiscal/reporting periods
        belong to the temporal qualifier family (deferred).
```

### 6.6 RANGE deferred

```text
CP-6.12 RANGE and BETWEEN are NOT supported in v1. Statements such as
        "margin between 10% and 20%" MUST NOT be force-canonicalized; they remain
        statement / future-qualifier representations until a future contract
        revision.
```

### 6.7 Approximation

```text
CP-6.13 approximately / about / roughly are NOT comparators, and MUST NOT be
        silently dropped.
CP-6.14 Approximation semantics belong to the future Qualifier / value-quality
        contract. Whether and how a Core value may be structured in the presence of
        approximation is decided by that contract together with Field Provenance.
        v1 MUST NOT invent an APPROX comparator.
```

---

## 7. assertionType

```text
assertionType :=
  FACT
  THRESHOLD
  DIRECTION
  COMPARATIVE
  QUALITATIVE
```

```text
CP-7.1  TREND is NOT an assertion type. TREND-style language MUST be canonicalized
        according to its semantics (section 8.4) rather than added as a type.
```

### 7.1 FACT

Definition: a point assertion about a value, boolean state, or date that does not itself express a threshold, directional change, or comparison relation.

```text
subject     REQUIRED
predicate   REQUIRED
object      REQUIRED (NUMBER | BOOLEAN | DATE)
direction   null
comparator  null
```

Examples:

```text
Revenue was $1.2B.
Disclosure controls were ineffective.
The company was founded in September 2017.
```

### 7.2 THRESHOLD

Definition: a proposition asserting that a scalar metric lies relative to a bound.

```text
subject     REQUIRED
predicate   REQUIRED
object      REQUIRED (the bound; NUMBER)
direction   null
comparator  REQUIRED
```

Example:

```text
Largest customer represents at least 30% of revenue.
-> object = 30, comparator = GTE
```

### 7.3 DIRECTION

Definition: a first-order directional change in the predicate itself.

```text
subject     REQUIRED
predicate   REQUIRED
object      null
direction   REQUIRED
comparator  null
```

Examples:

```text
Revenue increased.
Operating cash flow declined.
```

(A magnitude or an explicit reference makes the proposition COMPARATIVE instead; see CP-8.5 and section 8.4.)

### 7.4 COMPARATIVE

Definition: a proposition whose meaning requires comparison against an explicit or qualified reference.

```text
subject     REQUIRED
predicate   REQUIRED
object      OPTIONAL (delta magnitude; NUMBER) or null
direction   CONDITIONAL
comparator  CONDITIONAL
```

```text
CP-7.2  At least one relation carrier MUST be present: direction != null OR
        comparator != null. If both are null, the structure is INVALID.
CP-7.3  comparisonReference belongs to the future Qualifier contract. When the
        semantics require a comparison reference and it cannot be resolved, the Core
        may be structurally complete but the full proposition is NOT safely
        evaluable; abstention/compatibility behavior is designed later.
CP-7.4  Delta semantics: for "Revenue increased more than 10% versus 2025", the
        Core may carry object = 10 with comparator = GT and direction = INCREASE;
        the "versus 2025" part is a comparisonReference qualifier. Registry identity
        MUST distinguish level metric / change metric / rate metric so a delta bound
        cannot be misread as a level bound.
```

### 7.5 QUALITATIVE

Definition: a proposition that ascribes a qualitative state to a topic/dimension.

Canonical ownership (adopted from the adversarial review, Q3):

```text
predicate owns the topic/dimension  (METRIC or CONCEPT)
object owns the qualitative state   (TEXT_CONCEPT)
```

```text
subject     REQUIRED
predicate   REQUIRED
object      REQUIRED (TEXT_CONCEPT)
direction   null
comparator  null
```

```text
CP-7.5  QUALITATIVE.object MUST exist. The optional/null object variant from the
        pre-freeze working draft is SUPERSEDED by the adversarial review; without a
        state object there is no canonical state ownership.
```

Examples:

```text
Customer concentration remains a material risk.
-> predicate = customer_concentration, object = material_risk
   (NOT predicate = risk_materiality with null object,
    NOT predicate = customer_concentration_material_risk)

Liquidity remains constrained.
-> predicate = liquidity, object = constrained
```

### 7.6 QUALITATIVE is not a fallback

```text
CP-7.6  Failed parses, unknown semantics and unstructured language MUST NOT
        automatically become assertionType = QUALITATIVE. QUALITATIVE is used only
        when it is known that the proposition is topic + qualitative state.
        Otherwise: no trusted Core Proposition.
```

### 7.7 FACT vs QUALITATIVE boundary (operational test)

Priority order (usable by a future normalizer):

```text
1. Boolean-disposition predicate with clean binary semantics -> FACT + BOOLEAN
2. Scalar value / bound -> FACT or THRESHOLD
3. Degree-bearing / interpretive state without clean binary negation -> QUALITATIVE
```

```text
Example:   "Disclosure controls were ineffective" with registry predicate
           disclosure_controls_effective -> FACT + BOOLEAN(false).
Example:   "Liquidity remains constrained" -> QUALITATIVE (predicate liquidity,
           object constrained), because "not constrained" has no unique opposite
           state and the quality is degree-bearing.
```

---

## 8. Direction

### 8.1 Enum

```text
direction := INCREASE | DECREASE | STABLE | null
```

```text
CP-8.1  HIGH, LOW, POSITIVE, NEGATIVE, GOOD, BAD, STRONG, WEAK are NOT directions
        and MUST NOT be added to the enum.
CP-8.2  direction describes first-order change of the predicate only. Magnitudes,
        references and intensity wording are never encoded in direction.
```

### 8.2 STABLE

```text
CP-8.3  STABLE is retained in the enum (human decision).
CP-8.4  STABLE is structurally supported but EMPIRICALLY UNVALIDATED in the current
        corpus (zero coverage). Future benchmarks MUST add explicit STABLE coverage
        (design stress examples: "Revenue was unchanged.", "Revenue stayed flat.",
        "Customer share held steady.").
```

### 8.3 Maintained / sustained

```text
CP-8.5  maintained / sustained MUST NOT automatically become STABLE.
CP-8.6  When a change phenomenon is maintained ("receipts expansion was
        maintained"), the Core direction remains INCREASE; the persistence is a
        Qualifier concern.
CP-8.7  When a static state persists ("concentration remains high"), STABLE MUST
        NOT be forced; the proposition is QUALITATIVE with a future persistence
        qualifier.
```

### 8.4 Second-order direction

```text
CP-8.8  First-order and second-order change MUST remain distinguishable.
        "Revenue increased."            -> DIRECTION, predicate revenue, INCREASE.
        "Revenue growth accelerated."   -> COMPARATIVE, predicate
                                           revenue_yoy_growth, direction INCREASE,
                                           comparisonReference required downstream.
        A second-order statement MUST NOT be encoded as an ordinary DIRECTION.
CP-8.9  "Revenue growth increased." and "Revenue growth accelerated." MAY
        canonicalize to the same second-order COMPARATIVE semantics when the
        sentence explicitly describes the growth rate itself rising. Neither may
        EVER collapse with "Revenue increased."
CP-8.10 Second-order signed-rate statements ("declined less rapidly",
        "stopped declining", "growth decelerated", "growth accelerated") concern a
        change of a signed rate / rate-of-change and MUST be canonicalized as
        COMPARATIVE against the correct rate/change predicate. Their complete
        comparison semantics are defined by the Qualifier contract.
```

---

## 9. Comparator

### 9.1 Enum and aliases

```text
comparator := GT | GTE | LT | LTE | EQ | NEQ | null
```

Canonical aliases (meaning-preserving normalization only):

```text
exceeds       -> GT
greater than  -> GT

at least      -> GTE
not less than -> GTE

below         -> LT
less than     -> LT

at most       -> LTE
no more than  -> LTE

exactly       -> EQ

not equal     -> NEQ
```

```text
CP-9.1  AT_LEAST / AT_MOST style aliases are surface forms, never separate enum
        members.
CP-9.2  approximately / around / roughly are NOT comparator aliases.
CP-9.3  BETWEEN is not a comparator and is not supported in v1 (RANGE deferred).
```

### 9.2 EQ clarification

```text
CP-9.4  Plain exact point values are FACT, not THRESHOLD.
        "Revenue was exactly $1B" -> FACT, object = 1.
        EQ is used only where a genuine bound/comparative relation semantically
        requires a comparator. This prevents FACT/THRESHOLD overlap.
```

### 9.3 Negative normalization

```text
CP-9.5  For signed scalar metrics, these are meaning-preserving domain rules:
        negative     -> LT with bound 0
        non-negative -> GTE with bound 0
        Example: "GAAP operating margin was negative" -> THRESHOLD, object = 0,
        comparator = LT.
```

---

## 10. Null and malformed semantics

### 10.1 Null

```text
CP-10.1 null has exactly ONE meaning: structurally not used by this assertionType.
CP-10.2 null MUST NOT mean: unknown, missing extraction, parse failure, model
        uncertainty, or not available.
CP-10.3 Example (legal): DIRECTION.object = null (type-driven).
        Example (invalid): THRESHOLD.object = null (contract violation).
CP-10.4 null MUST be produced only by type-driven construction. A parser,
        normalizer or model MUST NOT write null as a failure/absence sentinel.
```

### 10.2 No partial trusted Core

```text
CP-10.5 P1 + P3 adopted: either a fully valid trusted Core Proposition exists, or
        there is no trusted Core Proposition. No PARTIALLY_STRUCTURED state exists.
CP-10.6 If required semantics are unknown, the original statement, grounding and
        provenance are preserved, but no half-legal Core is produced.
```

### 10.3 Semantic frame without trusted Core

```text
CP-10.7 semanticFrame.coreProposition = null is a legal whole-frame state: the
        original proposition exists but no trusted canonical Core could safely be
        produced. This MUST NOT be confused with a Core field whose value is null.
```

---

## 11. Normative legality matrix

| assertionType | subject | predicate | object | direction | comparator |
| ------------- | ------- | --------- | ------ | --------- | ---------- |
| FACT | REQUIRED | REQUIRED | REQUIRED | null | null |
| THRESHOLD | REQUIRED | REQUIRED | REQUIRED NUMBER | null | REQUIRED |
| DIRECTION | REQUIRED | REQUIRED | null | REQUIRED | null |
| COMPARATIVE | REQUIRED | REQUIRED | OPTIONAL NUMBER/null | CONDITIONAL | CONDITIONAL |
| QUALITATIVE | REQUIRED | REQUIRED | REQUIRED TEXT_CONCEPT | null | null |

```text
CP-11.1 COMPARATIVE relation-carrier rule: at least one of direction / comparator
        MUST be non-null. If both are null: INVALID.
CP-11.2 Object-kind rules follow sections 6-7: FACT carries NUMBER | BOOLEAN | DATE;
        THRESHOLD carries the NUMBER bound; DIRECTION carries null; COMPARATIVE
        carries an optional NUMBER delta; QUALITATIVE carries the TEXT_CONCEPT
        state.
CP-11.3 A structurally invalid combination is a contract violation. It MUST NOT be
        silently repaired; every structurally invalid Core is untrusted input.
```

---

## 12. Canonical uniqueness invariant

```text
CP-12.1 One semantic proposition SHOULD have one preferred trusted Core
        representation. Multiple same-authority canonical forms MUST NOT coexist.
CP-12.2 Example that is FORBIDDEN: representing "customer concentration material
        risk" both as (predicate = risk_materiality, object = null) and as
        (predicate = customer_concentration, object = material_risk).
        v1 allows only the topic/state ownership pattern:
        predicate = customer_concentration, object = material_risk.
CP-12.3 Semantic typing rules protect this invariant for cases that are
        structurally legal but semantically wrong (e.g. a magnitude-bearing
        statement written as DIRECTION, a second-order statement written as
        DIRECTION, a reference-bearing statement written with the reference
        dropped, an exact value written as THRESHOLD + EQ).
```

---

## 13. Semantic separation invariant

```text
CP-13.1 Semantically different propositions MUST NOT collapse under normalization.
        Separation MUST hold at least for:
        revenue                      != revenue growth
        revenue growth               != revenue growth acceleration semantics
        level metric                 != delta metric != rate metric
        actual result                != guidance
        period A                     != period B
        topic                        != qualitative state
CP-13.2 Where a required separation lives in Qualifiers rather than in Core, that
        is intentional architectural separation and not a Core defect. It MUST be
        recorded, not "fixed" by pulling qualifier semantics into Core.
```

---

## 14. Meaning-preserving normalization only

Allowed (with auditable provenance):

```text
at least      -> GTE
at most       -> LTE
exceeds       -> GT
below         -> LT
negative      -> LT with bound 0 (signed metrics)
non-negative  -> GTE with bound 0 (signed metrics)
clean lexical boolean negation -> BOOLEAN
canonical ISO date normalization
```

Forbidden:

```text
"material"            -> arbitrary numeric threshold
"strong growth"       -> INCREASE
"broadly"             -> invented quantifier
"partially effective" -> false
unknown metric        -> nearest known metric
LLM guess             -> trusted Core field
```

```text
CP-14.1 Every normalization MUST be meaning-preserving and auditable through
        provenance. No normalization may invent, round, convert or drop load-bearing
        semantics.
```

---

## 15. Statement vs structure conflicts

```text
CP-15.1 No silent pick. When statement semantics and an existing structured
        representation conflict, neither side wins by default: the structured field
        existing is not a tie-breaker, and natural language is not automatically
        preferred. Resolution MUST return to source grounding + field provenance.
CP-15.2 Core-level conflict examples: "exceeds" vs GTE; "revenue growth" vs
        "revenue". Qualifier-level conflict examples: FY2025 vs Q4 2025; guidance
        vs actual; million vs billion.
CP-15.3 Nothing in the conflict list may be normalized away because it is
        "close enough".
CP-15.4 Frozen principle: an unresolved semantic conflict means the structured
        representation cannot be trusted. Session 1 already states: input contract
        invalid -> NOT_EVALUATED + relation null. An unresolved contract-critical
        conflict therefore MUST NOT surface as AMBIGUOUS (it is an
        input/authority problem, not research-semantic uncertainty).
```

---

## 16. Multi-clause policy

```text
CP-16.1 Exactly one assertion-bearing Claim Revision enters the Relation layer.
CP-16.2 Genuine dual/multi-assertion statements MUST be split at the
        authoring/intake boundary. The Relation runtime NEVER decomposes Claims.
CP-16.3 Disclaimers and concessions MUST NOT be split mechanically by conjunction
        or punctuation. "Revenue growth exceeded 100%; this does not imply future
        growth." is one assertion plus disclaimer/context. "Revenue increased, but
        margin declined." contains two assertions that can be independently
        verified.
CP-16.4 Operational heuristic (authoring/intake guidance only, never a Relation
        runtime algorithm): if each clause can stand as an independent research
        proposition with its own evidence, it is likely a genuine multi-assertion
        statement.
```

---

## 17. Deferred capabilities

The following are explicitly DEFERRED and MUST NOT be designed in this contract:

```text
RANGE / BETWEEN
Concept registry implementation and governance
ComparisonReference structure
Persistence qualifier
Approximation qualifier
Severity / degree qualifier
Temporal qualifier structure
Unit / scale / currency qualifier
Denominator
Actuality
Role-label binding
Ordered-scale declarations
CompatibilityAssessment
Routing
Field Provenance final schema
Grounding final schema
```

---

## 18. Normative invariants

```text
INV-CP-01  Core is a projection, never the replacement of the original statement.
INV-CP-02  All six canonical fields are always present.
INV-CP-03  Subject kinds are ENTITY / ENTITY_ROLE only.
INV-CP-04  Predicate is registry-bound METRIC / CONCEPT.
INV-CP-05  Object union is NUMBER / BOOLEAN / TEXT_CONCEPT / DATE / null.
INV-CP-06  TREND is not an assertion type.
INV-CP-07  Acceleration/deceleration are comparative semantics.
INV-CP-08  STABLE is retained but empirically unvalidated.
INV-CP-09  Maintained/sustained are not automatically STABLE.
INV-CP-10  QUALITATIVE uses topic predicate + state object.
INV-CP-11  QUALITATIVE is never parse fallback.
INV-CP-12  null means structurally unused only.
INV-CP-13  Unknown required semantics produce no trusted Core.
INV-CP-14  No partial trusted Core state.
INV-CP-15  LLM guesses never silently gain trusted authority.
INV-CP-16  Only meaning-preserving normalization is allowed.
INV-CP-17  Statement/structure conflicts cannot be silently resolved.
INV-CP-18  Relation runtime never decomposes multi-assertion Claims.
INV-CP-19  One semantic proposition should have one preferred canonical Core
           representation.
INV-CP-20  Semantically different propositions must not collapse under
           normalization.
```

---

## 19. Relationship to Session 1 (non-interference)

This contract refines the Claim/Evidence semantic structure only. It does not change any Session 1 frozen semantics: SUPPORTS / COUNTERS / NEUTRAL / AMBIGUOUS remain the only relation labels; invalid is not AMBIGUOUS; processing status is separate from relation; NOT_EVALUATED and ERROR carry relation = null; there is no confidence score; relation does not mutate Claims; Relation is not Impact; evaluation is pairwise, revision-specific and as-of-aware; RelationReceipt remains an analytical artifact. This contract is compatible with, and subordinate to, `ADR-0.12.1 — Claim Relation Semantics`.
