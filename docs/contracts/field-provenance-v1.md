# Field Provenance Contract v1

Status: Accepted / Frozen for v0.12.1A

Parents:
- ADR-0.12.1 — Claim Relation Semantics
- Core Proposition Contract v1
- Qualifier Contract v1
- Grounding Contract v1

Target: v0.12.1A — Session 2.4 Field Provenance
Date: 2026-09-15
Human Freeze Decision: APPROVED
Session: 2.4 Field Provenance
Frozen: 2026-09-15
Repository: `Anhao1314/flowcredit-research` (development/test repository; not deployed).
HEAD at contract time: `0e89ac6038430ef99a280b150d4746e3a35f1803` (`main`).

Based on:
- Session 2.4A — Field Provenance empirical audits
  (`docs/audit/session-2.4a-field-provenance-empirical-audit.md`,
  `docs/audit/session-2.4a-field-provenance-surface-audit.md`)
- Session 2.4B-1 — Working Contract
  (`docs/design/field-provenance-v1-working-contract.md`)
- Session 2.4B-2 — Adversarial Review
  (`docs/audit/session-2.4b2-field-provenance-adversarial-review.md`)
- Session 2.4B-3 — Freeze Candidate Review
  (`docs/audit/session-2.4b3-field-provenance-freeze-review.md`)
- Human freeze decision — Session 2.4 Field Provenance
  (`docs/audit/session-2.4-field-provenance-freeze-decision.md`)

Normative scope: the durable field-level lineage contract for the semantic
fields of an Accepted Evidence record revision. This document is the
normative truth for field provenance from v0.12.1A onward. Where it and any
earlier spike, audit, working contract, adversarial review or amendment text
disagree, this contract wins for v0.12.1A. The working contract and the
review artifacts listed above remain design provenance, not normative.

Out of scope and not designed here: runtime implementation, schema, SQLite
storage, migration, Admission implementation, Proposal implementation,
Grounding runtime, Surface / UI, Public Demo repair, Claim provenance,
CompatibilityAssessment, RelationReceipt, tests, and the freeze itself.

---

## 1. Purpose

Grounding answers WHERE a record came from; it deliberately does not answer
HOW a structured semantic field arose (GC-21.1). After Admission, an accepted
record keeps the value and the human decision but not the field's derivation,
so no consumer can answer "what changed in what we believe, and why?" for a
single field. Field Provenance v1 is the minimum durable lineage that closes
that gap.

```text
FP-1.1  The unit of provenance is the semantic field of an Accepted Evidence
        record revision — not the record, not the Claim, not the Source.
FP-1.2  Field Provenance describes lineage only. It never asserts validity,
        correctness, materiality, trust, or quality.
FP-1.3  The contract applies unchanged to production, legacy, imported, and
        synthetic (demo) records. No branch, flag, or special case may be
        introduced for any record class.
```

---

## 2. Definitions

```text
FP-2.1  SEMANTIC FIELD — a field of an Accepted Evidence record revision
        whose value carries research meaning or enters downstream comparison
        (the covered set is FP-3.11).
FP-2.2  ORIGIN CLASS — exactly one per field occurrence. It identifies the
        decisive basis or derivation mode on which the accepted value's
        existence depends: what the value would not exist without.
FP-2.3  MATERIAL BASIS — recorded material that carries the value: verified
        source text, table structure (cell plus structural roles), or the
        record/document envelope.
FP-2.4  TRANSFORM — a deterministic operation applied to material that
        produced or reshaped the accepted value without introducing a new
        dependence.
FP-2.5  TRANSFORM IDENTITY (transformId) — the stable semantic identity of a
        transform: what operation happened (for example usd_millions_to_usd).
        It is not a code, package, function, or commit identity (FP-5.11).
FP-2.6  SUPPORT / SUPPORT MATERIAL — verified, hash-protected source material
        persisted by Grounding (TextSupport / TableSupport), referenced by
        identity.
FP-2.7  GROUNDING REFERENCE — an identity reference to support material owned
        by Grounding. Field Provenance references it and never copies it.
FP-2.8  VALIDATION — deterministic pre-Admission checks. Validation is
        authority-side evidence; it is never an origin.
FP-2.9  ADMISSION — the human accept/reject event. It is the only authority
        path from a Proposal/Candidate into Accepted Evidence.
FP-2.10 RECORD REVISION — an immutable Accepted Evidence revision. Provenance
        binds to the revision.
FP-2.11 UNRECORDED is a statement about the system, not about the world: the
        value exists and no source of dependence was recorded for it. It is
        never a statement about the value's truth, quality, or admissibility.
FP-2.12 PRODUCER (authorship) is not part of Field Provenance v1. The agent
        class is either implied by the origin class (MODEL_PROPOSED,
        ASSUMED_DEFAULT) or is pre-Admission Proposal metadata. Authorship is
        neither origin nor authority.
```

---

## 3. Model

### 3.1 Record shape

Illustrative shape — this is NOT a schema, and no key name here is frozen:

```text
FieldProvenanceRecord
  field             REQUIRED  stable semantic field identity in the record revision
  origin            REQUIRED  exactly one origin class (section 4)
  occurrence        OPTIONAL  only when a field can repeat within one record
  transforms        OPTIONAL  ordered list, left to right (section 5)
  groundingRef      CONDITIONAL  identity reference; present when the value has
                                 direct source support (section 6)
```

```text
FP-3.1  Required members: field, origin. Optional/conditional members:
        occurrence, transforms, groundingRef. No other member is part of v1.
FP-3.2  One origin per field occurrence. No field carries two origins, a
        merged origin label, nor a chain of origins.
FP-3.3  No confidence, score, status enum, validity enum, severity, badge, or
        color token is part of the model.
FP-3.4  No producer, no model identity, no prompt reference, no version bag,
        no per-field review field, no provenance self-hash.
FP-3.5  No new persisted top-level entity is required by the contract; records
        attach to the Accepted Evidence record revision as a per-field
        collection (attachment mechanics: FP-11.5).
FP-3.6  No DAG and no computation graph. Transforms are a linear chain.
```

### 3.2 Identity and cardinality

```text
FP-3.7  Provenance binds to (record revision identity, field path,
        occurrence).
FP-3.8  The same value appearing in two objects does not share one provenance.
        A copied value is a new occurrence with its own provenance; if the
        copying is not recorded, the copy is UNRECORDED and never inherits the
        source field's origin.
FP-3.9  A multi-input field remains one field occurrence with one origin and
        one transform step; it does not become several provenance records.
FP-3.10 A field value change creates a new record revision (section 9). An
        absent field has no provenance record: there is no "provenance
        present, field absent" state.
```

### 3.3 Field scope

```text
FP-3.11 Covered fields (the observed Accepted Evidence semantics):
          category, metric, scope, rawValue, rawUnit, normalizedValue, unit,
          periodStart, periodEnd, observedAt
FP-3.12 Excluded technical / operational fields (never provenance subjects):
          id, subjectId, sourceId, contentHash, createdAt, statement, section,
          page, location, record-level provenance, verificationLevel,
          confidence, researchField, and normalization (normalization is the
          transform identity, not a field to be provenanced).
FP-3.13 statement / section / page / location are the admitted material
        itself; they belong to Grounding, not to field provenance.
FP-3.14 A record-binding subject (subjectId) is not a per-field provenance
        subject. Future materialized Core / Qualifier fields enter scope when
        they exist (FP-7.1, FP-7.2).
FP-3.15 Attribution — exactly one of three readable states per covered field:
          (a) a Field Provenance Record exists: origin recorded;
          (b) the field is present and no record exists (legacy, imported, or
              otherwise unrecorded field provenance): consumers MUST read this
              as UNRECORDED;
          (c) the field itself is absent: nothing to explain.
        A present field MUST NOT be read as SOURCE_EXPLICIT, or as any other
        recorded origin, merely because no record exists.
```

---

## 4. Origin classes

### 4.1 The six classes

```text
FP-4.1  SOURCE_EXPLICIT — the accepted value, or the representation it was
        deterministically parsed from, is literally present in the referenced
        verified material (text/quote, or a self-sufficient cell). Who
        selected the material is not part of the origin.
FP-4.2  SOURCE_STRUCTURAL — the accepted value is entailed by table structure:
        the cell plus load-bearing structural roles (row label, column
        path/label, unit context, table title), rather than by one literal. A
        tabular value whose interpretation depends on any load-bearing role
        beyond the cell itself is SOURCE_STRUCTURAL.
FP-4.3  RECORD_CONTEXT — the value is bound from the record/document envelope
        (subject identity, source identity, document date, applicability
        metadata) and not from statement text or table structure.
FP-4.4  MODEL_PROPOSED — the value is a semantic choice or inference that a
        model produced and no recorded material carries: canonical
        category/metric selectors, actuality, explicitness, and comparable
        semantic fields. A model that selects a literal or an entailed
        structural value does not make the origin MODEL_PROPOSED (FP-4.10).
FP-4.5  ASSUMED_DEFAULT — the value was supplied by system construction with
        no recorded material basis: an implicit applicability default that the
        pipeline hardcodes (for example scope = consolidated_company) or a
        fallback constant that the pipeline substitutes when no value was
        supplied (for example the quotation-fallback constants). The supply is
        known and system-caused; no source text, table structure, record
        envelope, or model inference carries the value.
FP-4.6  UNRECORDED — the value exists and no recorded source of dependence
        exists. Legacy records, imported records, builder-constructed values,
        and unrecorded derivations land here.
FP-4.7  The class set is closed at six for v1. Adding a class requires a new
        observed case plus a review decision (section 11).
```

### 4.2 Decision procedure (exclusivity and exhaustiveness)

```text
FP-4.8  Classify a field's occurrence by the first matching test, in order:
          1) the value (or its deterministically parsed representation) is
             literally present in referenced material -> SOURCE_EXPLICIT
          2) the value is entailed by table structure  -> SOURCE_STRUCTURAL
          3) the value is bound from the record/document envelope
                                                       -> RECORD_CONTEXT
          4) the value is a model semantic inference and no recorded material
             carries it                                -> MODEL_PROPOSED
          5) the value was supplied by system construction as a default or
             fallback with no material basis           -> ASSUMED_DEFAULT
          6) otherwise                                 -> UNRECORDED
        The tests are ordered and mutually exclusive: exactly one class
        applies to every covered field.
FP-4.9  Classification is a write-time act performed from recorded upstream
        facts at acceptance; downstream consumers read the recorded origin and
        never re-classify.
```

### 4.3 Near-miss boundaries

```text
FP-4.10 SOURCE_EXPLICIT vs MODEL_PROPOSED: literal or parsed-material
        presence wins. An inference is MODEL_PROPOSED only when no recorded
        material carries the value. A related word appearing in the material
        does not convert an inferred semantic selection into a literal;
        conversely, a deterministic representation change of a present value
        does not make it inferred (it is SOURCE_* plus a transform).
FP-4.11 SOURCE_STRUCTURAL vs MODEL_PROPOSED: if the structural roles entail
        the value, it is SOURCE_STRUCTURAL, even when a model chose which
        cell/row applies. A semantic field read out of material but not
        entailed by its structure (for example a scope inferred from a table
        title) is an inference, not a structural value.
FP-4.12 RECORD_CONTEXT vs ASSUMED_DEFAULT: if the record/document envelope
        contains the value, the origin is RECORD_CONTEXT regardless of who
        wired the binding (including a model). If no recorded material
        contains the value and system construction supplied it as a constant,
        the origin is ASSUMED_DEFAULT.
FP-4.13 ASSUMED_DEFAULT vs UNRECORDED: a known, system-caused supply of a
        default or fallback is ASSUMED_DEFAULT; a value with no recorded
        dependence at all is UNRECORDED. A known default is not unknown
        provenance, and unknown provenance is not a default.
```

### 4.4 What an origin never means

```text
FP-4.14 SOURCE_EXPLICIT does not mean valid, correct, or the right literal.
FP-4.15 MODEL_PROPOSED does not mean invalid, untrusted, or rejected.
FP-4.16 ASSUMED_DEFAULT does not mean rejected or illegal.
FP-4.17 UNRECORDED does not mean invalid, untrusted, false, or not admitted.
FP-4.18 No origin class carries confidence, and no consumer may derive a
        trust score from origin plus transforms (FP-10.4).
```

---

## 5. Transforms

### 5.1 The three kinds

```text
FP-5.1  NORMALIZED — representation change: scale, unit family, currency
        form, percent form.
FP-5.2  PERIOD_DERIVED — a temporal window was derived from an explicit
        phrase or duration.
FP-5.3  CONVERTED_TO_TARGET — a target-bound conversion produced or
        constrained the accepted form (canonical concept binding).
```

### 5.2 Rules

```text
FP-5.4  A transform MUST be recorded whenever its omission would make the
        accepted value read as plain source material. Any field whose accepted
        form differs from the material it came from MUST carry the transform
        that changed it.
FP-5.5  Identity (no-op) transforms MUST NOT be recorded. A recorded
        transform MUST be one that actually ran; recording one that did not
        run, or omitting one that did, is a contract violation.
FP-5.6  The chain is ordered and MUST be interpretable left-to-right. A chain
        MUST NOT hide a change of dependence: if a step introduced record
        context or a default, the origin changes accordingly.
FP-5.7  Transforms carry no input references, no raw copies, and no
        re-execution inputs. Raw and normalized representations live on the
        record; the exact material lives in Grounding.
FP-5.8  A transform is never an origin and never a quality. In particular
        PERIOD_DERIVED (or any transform) MUST NOT be consumed as valueQuality,
        exactness, or approximation (FP-7.4).
FP-5.9  Fail-closed abstentions produce no field and therefore no provenance.
FP-5.10 The kind set is closed at three for v1: EXTRACTED and COMPUTED are
        not v1 kinds. If a computed value, or any value the three kinds cannot
        express, must be accepted, the transform set MUST be extended before
        that acceptance is legal; until then such a value is UNRECORDED.
```

### 5.3 Transform identity

```text
FP-5.11 transformId is the stable semantic operation identity — what
        operation occurred (usd_millions_to_usd, period_from_explicit_dates,
        target_conversion:consolidated_revenue). Every transform entry MUST
        carry transformId and kind.
FP-5.12 transformId MUST NOT be a code version, package version, function
        name, or commit hash, and MUST NOT be upgraded, refreshed, or silently
        reinterpreted when the implementation changes. Different
        implementations of the same semantic operation produce the same
        transformId and do not rewrite historical lineage.
FP-5.13 Implementation version identifiers (normalizer, parser, converter,
        registry) are never required, referenced, or reconstructed at read
        time. They may exist as audit metadata at most.
FP-5.14 Origin/transform boundary: if removing the operation would leave the
        value still present, even if in another representation, the operation
        is a transform; if removing the material would leave the value with no
        basis at all, the material is the origin.
FP-5.15 Where a lossy or generic label would replace a specific recorded
        derivation, the specific derivation is what v1 requires; a generic
        label is not an acceptable substitute.
```

---

## 6. Grounding relationship

```text
FP-6.1  SOURCE_EXPLICIT and SOURCE_STRUCTURAL fields MUST reference the
        support that contains the material (TextSupport / TableSupport
        identity, including its Source/Document identity).
FP-6.2  A SOURCE_STRUCTURAL field MUST reference the TableSupport (or support
        snapshot) that carries the structural roles. Role detail is read from
        the referenced snapshot; Field Provenance MUST NOT copy cell / row /
        header / unit / title values.
FP-6.3  A MODEL_PROPOSED field MAY reference material in which the accepted
        value is itself literally present; that reference is a checkability
        aid and never converts the field into a source literal. Material that
        merely justifies an inference (a cue) is validation material, not
        grounding, and MUST NOT be recorded as the field's GroundingRef:
        support for an inference is not the field being a source literal.
FP-6.4  RECORD_CONTEXT, ASSUMED_DEFAULT, and UNRECORDED fields MUST NOT carry
        a GroundingRef and MUST NOT claim direct source support. A parent
        statement may be grounded; the field is not. No span, quote, cell,
        header, or locator may be invented for them.
FP-6.5  A GroundingRef is an identity reference only. Copying support
        snapshots, offsets, hashes, or role tables into Field Provenance is
        forbidden duplication.
FP-6.6  Absence of grounding for a derived or implicit value is not a
        grounding failure and MUST NOT be reported as one.
FP-6.7  Per-field structural role attribution (which role produced which
        field) is deferred (FP-11.2).
```

---

## 7. Relationship to Core Proposition v1 and Qualifier v1

```text
FP-7.1  Where a Core field is materialized in a future runtime, its
        derivation is recorded by Field Provenance; where it is not
        materialized, no record exists for it. An implicit subject filled from
        trusted record metadata is RECORD_CONTEXT, never SOURCE_EXPLICIT; an
        explicitly named subject wins and is SOURCE_EXPLICIT.
FP-7.2  Qualifier slot values, when materialized, follow the same model. A
        registry-derived qualifier value materialized at frame creation is a
        Qualifier-axis value; the Evidence-side registry class is deferred
        (FP-11.1). Read-time re-derivation stays forbidden either way.
FP-7.3  Field Provenance MUST NOT redefine, rename, or substitute Core fields
        (subject, predicate, object, assertionType, direction, comparator) or
        Qualifier slots (temporal, unit, denominator, basis, actuality, scope,
        comparisonReference, persistence, valueQuality).
FP-7.4  valueQuality (EXACT_AS_REPORTED | APPROXIMATE) and approximation
        language belong to Qualifier v1. Field Provenance MUST NOT introduce a
        competing exactness, precision, or hedging attribute, and MUST NOT
        absorb QualifierSlot state.
FP-7.5  Field Provenance MUST NOT express null semantics (the single meaning
        of null stays with Core). An absent field has no record and needs
        none. Provenance records the derivation of the value that exists; it
        does not hold competing origins for an unresolved conflict.
```

---

## 8. Admission and authority boundary

```text
FP-8.1  Human Admission is an authority event, not a field origin.
FP-8.2  Field Provenance MUST NOT carry accepted=true, approved=true,
        human_verified=true, any authority flag, or any confidence value.
FP-8.3  Record-level Admission MUST NOT be presented, by any consumer, as
        per-field verification. The repository mechanically checks that the
        reviewed raw value occurs in the admitted quote; it does not verify
        the other semantic fields. Per-field review coverage is owned by a
        future Admission Review contract; v1 carries no per-field review
        claim and no reviewedSupportRef.
FP-8.4  Admission retains the right to accept a record whose field origins
        include MODEL_PROPOSED, ASSUMED_DEFAULT, or UNRECORDED. Legality of a
        value is judged by Admission; visibility of its derivation is supplied
        by this contract.
FP-8.5  When a human changes a proposed field at Admission, the surviving
        value's origin is the origin of that surviving value. Rejected
        proposal text is not required to survive.
FP-8.6  A human-supplied value whose dependence is not recorded follows the
        decision procedure (FP-4.8): with no recorded dependence the field is
        UNRECORDED. Human-authored ungrounded semantics is deferred (FP-11.3).
FP-8.7  The record-level method label (for example reviewed_primary_disclosure)
        is not field provenance and MUST NOT be used as per-field proof.
FP-8.8  Field Provenance introduces no VALID / INCOMPLETE / INVALID status
        enum: incomplete lineage is a completeness property of the lineage,
        not a state of the value.
```

---

## 9. Legacy, immutability, corrections

```text
FP-9.1  Missing historical provenance is never silently reconstructed.
        Legacy Evidence can be historically valid with incomplete provenance.
FP-9.2  A legacy field whose value exists reads as UNRECORDED (FP-3.15 b). It
        is readable, retained, and historically honest; it MUST NOT be
        upgraded in place, back-filled, or read as SOURCE_EXPLICIT, as a
        validated origin, or as "no provenance needed".
FP-9.3  A future reconstruction of legacy lineage is a new explicit
        reconstruction record. It never modifies the legacy record.
FP-9.4  An accepted field value and its provenance are immutable together. A
        new parser, normalizer, converter, registry, or model MUST NOT change,
        re-derive, or re-label the provenance or the value of an
        already-accepted field.
FP-9.5  A correction creates a new record revision with its own provenance,
        recorded per the corrected value's dependence. The old revision keeps
        the old provenance; no provenance is inherited across revisions.
FP-9.6  Legacy status belongs to the Evidence record (groundingBasis
        precedent). Field Provenance does not invent a second legacy marker.
```

---

## 10. Consumer constraints

```text
FP-10.1 Consumers MUST be able to answer, per covered field, from the
        Accepted Evidence revision plus referenced Grounding identity alone
        (no Proposal / support-store lookup):
          source-supported? · structurally-supported? · context-derived? ·
          model-inferred? · defaulted? · origin unknown? · normalized? ·
          period-derived? · target-converted?
FP-10.2 Consumers MUST NOT require model identity, prompt hash, parser /
        normalizer / registry versions, or any replay trace.
FP-10.3 Compatibility MUST NOT treat a normalized, structural, context-bound,
        or target-bound value as a raw literal, and MUST NOT treat valueQuality
        or approximation as a provenance property.
FP-10.4 Consumers MUST NOT derive validity, truth, or trust level from an
        origin class. Origin labels are statements about dependence only.
FP-10.5 RelationInput gains no relation semantics, confidence, or strength
        from provenance. The Claim side is deferred (FP-11.6) and MUST NOT be
        inferred from the Evidence side by analogy.
```

---

## 11. Deferrals and re-open conditions

```text
FP-11.1 REGISTRY_DERIVED origin class — deferred. Re-inspection shows the
        registry is validation-side only in the observed runtime; no accepted
        Evidence field is registry-produced. Re-open when a registry actually
        produces an Accepted Evidence semantic value; until then such a value
        is UNRECORDED, which is honest rather than falsely literal.
FP-11.2 Per-field structural role attribution — deferred. Re-open when
        Compatibility / Relation demonstrates it needs role identity, or a
        field can no longer be re-verified from the referenced TableSupport
        without it.
FP-11.3 Human-authored ungrounded semantics — deferred. No v1 origin class
        names a value that a human supplies or corrects based on material the
        system does not record; such values follow FP-4.8, and with no
        recorded dependence the origin is UNRECORDED. Re-open when the first
        accepted record must distinguish a
        human-asserted-without-recorded-basis field from UNRECORDED (for
        example a future Admission Review contract with per-field
        attestation). Until re-opened, such semantics MUST NOT be fabricated
        into ASSUMED_DEFAULT, RECORD_CONTEXT, or SOURCE_*.
FP-11.4 Computed and extracted transform kinds — deferred (FP-5.10). Re-open
        when a computed field must be accepted; the transform set is extended
        before that acceptance.
FP-11.5 Attachment and encoding mechanics — implementation decisions (inline
        vs beside the revision; explicit per-field UNRECORDED records vs
        implicit absence). Invariants that MUST hold either way: revision
        binding (FP-9.4), consumer answers without Proposal stores (FP-10.1),
        and the three-state reading rule (FP-3.15). Re-open if a
        representation cannot satisfy these, or if a cross-implementation
        serialization of this contract is required.
FP-11.6 Claim-side field provenance — completely deferred. It MUST NOT be
        inferred from the Evidence side by analogy.
FP-11.7 Quotation-fallback marker — not a Field Provenance element. The
        fallback's component fields carry their own origins (document date:
        RECORD_CONTEXT; scope and fallback constants: ASSUMED_DEFAULT;
        confidence: excluded). Whether an admission review records that the
        fallback path supplied its quoted-text fact is an Admission Review
        concern; re-open there if a verification-level requirement cannot
        otherwise be satisfied.
```

---

## 12. Non-goals

```text
FP-12.1 Not an execution trace, workflow engine, agent trace, prompt trace,
        observability platform, data-lineage warehouse, or general-purpose
        provenance ontology.
FP-12.2 Not a confidence model, an authority mechanism, or a valueQuality
        mechanism.
FP-12.3 Not a UI or disclosure design. This contract defines what a consumer
        is entitled to know, not how anything is shown.
FP-12.4 Not a migration or backfill plan.
FP-12.5 Not a duplication of Grounding, and not a Claim provenance redesign.
```

---

## 13. Examples (illustrative, not schemas)

**A. Direct source literal with normalization.**

```text
field: normalizedValue   origin: SOURCE_EXPLICIT
transforms: [ { kind: NORMALIZED, transformId: usd_millions_to_usd } ]
groundingRef: <TextSupport for "$32 million ...">
```

The raw representation survives on the record; the value never reads as if
the source said 32,000,000.

**B. Table structural context.**

```text
field: rawValue          origin: SOURCE_STRUCTURAL
transforms: [ { kind: NORMALIZED, transformId: usd_millions_to_usd } ]
groundingRef: <TableSupport: cell + row label + column path + unit context>
```

**C. Model proposal surviving validation and admission.**

```text
field: qualifiers.actuality   origin: MODEL_PROPOSED
```

Validation and the human decision remain authority-side; the origin does not
change.

**D. Defaults and fallback decomposition.**

```text
field: scope             origin: ASSUMED_DEFAULT   # pipeline hardcode / fallback constant
field: observedAt        origin: RECORD_CONTEXT    # document date from the envelope
```

**E. Value present, origin unrecorded.**

```text
field: rawValue          origin: UNRECORDED
```

Readable, retained, visibly unexplained; never upgraded.

---

## Artifact note and decision

This document was produced as the Session 2.4B-3 freeze candidate and was
accepted by the human freeze decision recorded in this header (Human Freeze
Decision: APPROVED — Session 2.4 Field Provenance). The durable freeze
record is `docs/audit/session-2.4-field-provenance-freeze-decision.md`. The
working contract and the review artifacts listed under "Based on" remain
design provenance, not normative. No runtime, schema, SQLite, Admission,
Proposal, Surface, UI, Public Demo, test, fixture, parent contract, or audit
document was modified by the freeze transition. No file was staged,
committed, or pushed.

```text
ACCEPTED / FROZEN — SESSION 2.4 FIELD PROVENANCE. NORMATIVE FROM v0.12.1A ONWARD.
```
