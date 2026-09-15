Status: Accepted / Frozen for v0.12.1A
Session: 2.5 RelationInput
Human Freeze Decision: APPROVED
Frozen: 2026-09-15

Based on:

```text
2.5A    RelationInput Empirical Audit                 (accepted)
2.5B-1  RelationInput Working Contract                (accepted)
2.5B-2  RelationInput Adversarial Simplification Review (accepted)
2.5B-3  RelationInput Freeze Candidate Review         (accepted)
```

# RelationInput Contract v1

Repository: `Anhao1314/flowcredit-research` (development/test repository; not
deployed).
HEAD at freeze time: `e3282358d6e5fde7c88141584ca17115a8dd8ff1` (`main`).
Date: 2026-09-15.

This document is FROZEN (Accepted / Frozen for v0.12.1A) by the explicit
human freeze decision recorded in the header. It carries no runtime force
and authorizes no implementation.

Lineage:

```text
design history   docs/design/relation-input-v1-working-contract.md
                 (revision 2.5B-2; retained unfrozen)
review artifact  docs/audit/session-2.5b3-relation-input-freeze-review.md
parents          ADR-0.12.1 (Claim Relation Semantics), Core Proposition v1,
                 Qualifier v1, Grounding v1, Field Provenance v1
```

Where this contract and a frozen parent appear to disagree, the frozen
parent wins and this contract is defective.

---

## 1. Status and force

```text
RI-1.1  Status is ACCEPTED / FROZEN (human freeze decision recorded in the
        header). Every rule below is normative for v0.12.1A onward.
RI-1.2  No implementation, migration, backfill, provider change or pipeline
        change is authorized by this contract.
RI-1.3  Complexity MUST NOT increase beyond revision 2.5B-2 of the working
        contract (section 27 of the freeze review): one working concept, two
        state values, four reference kinds, six required members, zero
        optional members, zero copied semantic structures.
```

---

## 2. Purpose

A RelationInput v1 is the minimum pair-bound input required to evaluate ONE
Accepted Evidence against ONE specific Claim Revision, without collapsing
identity, authority, the evaluation boundary, semantic availability, or
Compatibility concerns.

The relation layer itself is defined by ADR-0.12.1 and is not redefined here.
This contract defines only the input object: what is pinned, what is
excluded, and what a consumer may rely on.

---

## 3. Scope and non-goals

In scope: the RelationInput v1 object - pair invariant, identity, side
semantic state, the opaque frame binding, construction eligibility, the
evaluation boundary, resolution and immutability assumptions, boundaries,
exclusions, and re-open triggers.

Out of scope (MUST NOT be designed or pre-empted here):

```text
CompatibilityAssessment and any comparability verdict (Session 2.6)
relation labels, rules, thresholds, routing (ADR-0.12.1; later engine)
RelationReceipt schema and processing-status schemas
Impact, materiality, revision proposals
provider payload formats (Qwen / MiniCheck / MNLI)
Field Provenance schema, Grounding schema, Memory schema
migration, runtime, Surface, Public Demo
```

---

## 4. Definitions

```text
Pair                 ONE Accepted Evidence x ONE specific Claim Revision.
Side                 the Evidence side or the Claim Revision side of a pair.
Accepted Evidence    an Evidence record admitted through an accepted
                     Admission review (ADR-0.12.1; Admission contract).
Claim Revision       a specific, authoritative revision record of a Claim.
asOf                 the evaluation boundary: the information boundary at
                     which the pair is presented for evaluation
                     (ADR-0.12.1 section 5.2).
Semantic projection  the authoritative structured semantics of one side, as
                     materialized by the semantic layer. Its composition is
                     owned by the frozen parents (Core Proposition v1 and
                     Qualifier v1 section 4, which composes the Core
                     Proposition and the QualifierFrame as the SemanticFrame
                     artifact). This contract references that composition and
                     neither redefines nor extends it.
frameRef             an opaque binding to the semantic projection presented
                     for one pair side (section 8).
ProjectionState      the per-side member `semantics` (section 7), with
                     exactly two values: PRESENT { frameRef } and
                     NOT_MATERIALIZED.
eligibility          the construction preconditions of section 11.
semantic legality    validity of a materialized semantic projection under
                     the frozen parents (CP-15, QF-5).
Compatibility        the later layer that decides comparability (Session 2.6).
Relation evaluation  the ADR-0.12.1 relation judgment over one pair.
provider payload     any model-facing rendering (never defined here).
receipt              the future RelationReceipt (never defined here).
```

Terminology rule: "semantic projection" and "SemanticFrame" refer to the
frozen semantic artifact; "snapshot" is not used by this contract except
where a frozen parent names it.

---

## 5. Pair invariant

```text
RI-5.1  A RelationInput v1 represents exactly one Evidence and exactly one
        specific Claim Revision. Not zero, not two, not N.
RI-5.2  A RelationInput v1 MUST NOT contain an Evidence array, bundle,
        selected subset, aggregate, portfolio state, history bundle, or any
        field whose value is a collection of relation targets.
RI-5.3  Every relation outcome produced from a RelationInput MUST be
        attributable to the one pair and the one asOf it pins.
RI-5.4  For N Evidence, N independent RelationInputs MUST be constructed.
        Aggregation exists only downstream of complete pairwise outcomes.
RI-5.5  Construction consequence: a pipeline holding a multi-item bundle
        MUST conceptually iterate pairs (R1 x E1, R1 x E2, ...). This is an
        input-shape statement; it designs no migration and no runtime.
```

---

## 6. Pair identity

A RelationInput v1 pins exactly this tuple:

```text
evidenceId        binds one immutable Accepted Evidence record
claimId           binds the Claim (required by ADR-0.12.1 section 5.1)
revisionId        binds one specific authoritative Claim Revision
asOf              binds the evaluation boundary (section 12)
```

```text
RI-6.1  The four members above are REQUIRED. No pair id, input id, subject
        field, content-hash field or revision-hash field is part of v1.
RI-6.2  evidenceId binds the exact Evidence-side semantic state. Accepted
        Evidence is immutable; a correction creates a NEW Evidence record
        plus an explicit supersession relation, never a mutation. No
        EvidenceRevision concept exists or is invented.
RI-6.3  claimId + revisionId bind one specific authoritative Claim Revision.
        A bare current Claim, free-text Claim, or implicit latest-revision
        resolution after construction is forbidden.
RI-6.4  Identity MUST NOT be replaced by lossy aliases as the only record of
        the pair. Provider rendering (section 17) is downstream of identity
        and MUST NOT destroy it.
RI-6.5  Identity is binding, not semantics, and is not history: pinning a
        revision imports no earlier states or successor revisions.
```

---

## 7. Side semantic state (ProjectionState)

```text
RelationInput v1

  evidence     : { evidenceId }
  claim        : { claimId, revisionId }
  asOf         : timestamp
  evidenceSide : { semantics }
  claimSide    : { semantics }

semantics : PRESENT { frameRef }   (section 9)
          | NOT_MATERIALIZED       (section 10)
```

```text
RI-7.1  RelationInput is a binding envelope, not a content container: it
        pins WHO, WHEN, and WHAT semantics were available. It copies no
        semantic content.
RI-7.2  Exactly two state values exist. No reason vocabulary, no validity
        vocabulary, no confidence, no status is part of the state.
RI-7.3  Sides are independent; asymmetry is legal and MUST NOT be read as a
        relation signal.
RI-7.4  A missing `semantics` member is a malformed input, not an
        incomplete one.
RI-7.5  The state describes materialization at construction time. It is not
        a quality, trust, truth or compatibility judgment.
```

---

## 8. frameRef

```text
RI-8.1  frameRef is an opaque binding to the immutable semantic projection
        presented for this specific pair side. RelationInput v1 fixes only
        three things:
          (a) the binding requirement - PRESENT MUST pin the presented
              projection;
          (b) the immutability expectation - the bound projection is
              immutable and is never re-derived at read time (QF-6.2);
          (c) side association - a frameRef binds exactly one side.
RI-8.2  frameRef's encoding is owned OUTSIDE RelationInput v1. This contract
        does not freeze and MUST NOT be read as freezing: UUID or hash
        format, object serialization, table name, storage location, or
        whether the projection is stored, derived or addressed.
RI-8.3  frameRef MUST NOT imply a new persisted entity, a new database
        table, a copied Core Proposition structure, a copied Qualifier
        structure, a provider-rendered payload, or a mutable semantic cache.
RI-8.4  The pair MUST pin the projection presented for THIS evaluation: not
        a later re-materialization, and not semantics produced after asOf.
RI-8.5  Where no authoritative semantic projection can be bound, PRESENT is
        not available (section 9) and the side is NOT_MATERIALIZED.
```

---

## 9. PRESENT construction rule

```text
RI-9.1  PRESENT MAY be used only when an authoritative semantic projection
        for that pair side actually exists and is bindable by reference.
RI-9.2  FORBIDDEN: synthesizing a projection (or a PRESENT state) from
        legacy metric/unit/value/statement fields, from model output, from
        provider text, or from any non-authoritative source. No silent
        reconstruction; no semantic promotion.
RI-9.3  Where the runtime cannot yet produce a bindable projection, the side
        is NOT_MATERIALIZED. This is a runtime maturity state; it is not a
        reason to change this contract.
```

---

## 10. NOT_MATERIALIZED

```text
RI-10.1 NOT_MATERIALIZED means exactly one thing: at RelationInput
        construction time, no bindable formal semantic projection existed
        for this pair side.
RI-10.2 It MUST NOT mean, and MUST NOT be read as: invalid, incompatible,
        untrusted, false, legacy, low confidence, or model-generated.
RI-10.3 It requires no reason enum or cause vocabulary.
RI-10.4 Semantics for such a side resolve from the authoritative bound
        object (section 13). A consumer MUST NOT reconstruct a projection
        from that content.
```

---

## 11. Authority and construction eligibility

A RelationInput v1 MAY be constructed only when ALL of the following hold.
Eligibility is a property of construction; it never appears inside the pair.

```text
E1  Accepted Evidence: the Evidence has an accepted Admission review whose
    binding still validates.
E2  Evidence availability: every availability timestamp (knowledge,
    observed, source publication) is <= asOf.
E3  Claim Revision authority: the specific Claim Revision exists and is
    visible at asOf.
E4  Semantic legality: a materialized projection that is INVALID makes the
    pair non-evaluable; construction/evaluation refuses (CP-15.4, QF-5.5).
E5  Pair shape: exactly one Evidence and one Claim Revision (section 5).
```

```text
RI-11.1 Refusal is NOT_EVALUATED with relation = null (ADR-0.12.1 section
        4). Refusal happens outside RelationInput: no input exists for a
        refused pair, and a relation label MUST NOT be produced.
RI-11.2 Authority MUST NOT be copied into the pair: no accepted / approved /
        reviewed flags, no review metadata, no verificationLevel, no claim
        confidence or status.
RI-11.3 Authority is resolvable by identity (evidenceId -> review;
        revisionId -> revision record; asOf vs timestamps). Construction is
        the enforcement point.
RI-11.4 Selection-side orchestration gates are not part of this contract.
```

---

## 12. Evaluation boundary (asOf)

```text
RI-12.1 asOf is REQUIRED. A RelationInput without asOf is malformed and MUST
        NOT be constructed (ADR-0.12.1 section 5.2).
RI-12.2 asOf is the evaluation boundary only. It is NOT a qualifier temporal
        value, NOT a Compatibility result, NOT Evidence observedAt, NOT a
        Claim effectiveAt.
RI-12.3 Eligibility resolves availability, visibility and effective-time
        facts against asOf before evaluation (E2, E3). Those facts are not
        carried as pair content.
RI-12.4 No look-ahead: evaluation-time resolution MUST resolve at asOf and
        remain stable for that evaluation.
RI-12.5 Resolved temporal instances (for example selector resolutions)
        belong to the evaluation artifact / receipt, not to this input.
RI-12.6 This contract designs no temporal Compatibility.
```

---

## 13. Resolution and immutability assumptions

```text
RI-13.1 RelationInput v1 is resolution-bound: consumers read semantic
        content from the authoritative objects pinned by identity (the
        immutable Evidence record, the specific Claim Revision, and the
        bound semantic projection when PRESENT).
RI-13.2 Immutability: the pinned Evidence record, the pinned Claim Revision
        and any bound projection are immutable. Read-time re-derivation is
        forbidden (QF-6.2 analogy).
RI-13.3 Record integrity is enforced by the read path (content-hash
        verification), which is why the pair requires no hash fields.
RI-13.4 Resolution is not re-derivation: reading stored fields and
        materialized projections is legal; recomputing derived values at
        read time is forbidden.
RI-13.5 A consumer without read access to the pinned objects must be given
        material by its caller; such material is a transport/receipt
        artifact, not pair semantics.
```

---

## 14. Compatibility boundary

```text
RI-14.1 A RelationInput answers: WHAT exact pair is presented (which
        Evidence, which Claim Revision, which boundary, which
        materialization state per side).
RI-14.2 A RelationInput MUST NOT answer: CAN these propositions be compared?
RI-14.3 FORBIDDEN fields (representative, non-exhaustive): sameSubject,
        sameMetric, samePredicate, compatible, compatibilityScore,
        unitMatches, periodOverlaps, scopeCompatible, basisCompatible,
        comparisonReferenceCompatible, persistenceCompatible,
        valueQualityCompatible, metricFamily. Also forbidden: any field
        derived from comparing the two sides.
RI-14.4 Subject comparability, metric comparability, unit-family
        comparability, period comparability, comparison-reference
        commensurability, persistence reading, basis semantics and
        valueQuality interaction are owned by Session 2.6.
RI-14.5 Comparability is not eligibility: a pair that a future Compatibility
        layer would judge incomparable is still constructible (only E1-E5
        refuse).
```

---

## 15. Relation output status boundary

```text
RI-15.1 RelationInput v1 contains no RESOLVED, ABSTAINED, NOT_EVALUATED or
        ERROR status (ADR-0.12.1 section 4).
RI-15.2 Processing status is a fact about evaluation, which happens after
        construction; NOT_EVALUATED specifically means no input exists.
RI-15.3 A construction failure leads to NOT_EVALUATED outside the input, by
        the evaluating layer. This contract designs no status schema and no
        RelationReceipt schema.
```

---

## 16. RelationReceipt boundary

```text
RI-16.1 A future RelationReceipt MUST be able to bind: evidenceId, claimId,
        revisionId, asOf, and per side the ProjectionState (with frameRef
        when PRESENT).
RI-16.2 This contract freezes nothing else about the receipt: no receiptId,
        engine id, model name, rule path, reason codes, status schema, hash
        format or layout.
```

---

## 17. Provider boundary

```text
RI-17.1 This contract freezes RelationInput semantics only. Provider
        payloads (Qwen prompt, MiniCheck string, MNLI premise/hypothesis,
        statement rendering, token formats, aliases) are NOT frozen and MUST
        NOT be derived from this document.
RI-17.2 The provider adapter resolves the bound pair and renders its payload.
        Rendering is implementation; it MUST preserve pair identity and MUST
        NOT upgrade rendered text into semantics.
```

---

## 18. Multi-evidence prohibition and P0 statement

```text
RI-18.1 Evidence arrays, bundles, selected subsets, aggregates, portfolio
        state and history bundles are strictly forbidden in a RelationInput.
RI-18.2 Precise guarantee: ONE relation evaluation input cannot represent
        multiple Evidence. The LOCK-10 bundle semantic defect is closed at
        the pair-representation layer.
RI-18.3 Precise non-guarantee: RelationInput v1 does NOT guarantee that an
        orchestrator enumerated all eligible Evidence. Evidence-coverage
        completeness remains an orchestration/Impact-layer concern.
RI-18.4 It MUST NOT be stated or implied that this contract solves missing
        Evidence enumeration.
RI-18.5 For N Evidence, construct N independent RelationInputs; aggregation
        operates only on complete pairwise outcomes.
```

---

## 19. Impact exclusion

```text
RI-19.1 A RelationInput MUST NOT contain impact, impactHint, strengthen,
        weaken, materiality, revision recommendation or
        ClaimRevisionProposal.
RI-19.2 Relation is not Impact (ADR-0.12.1 section 6.1). A pair MUST NOT be
        constructed as a side effect of an impact computation, and an impact
        call MUST NOT be the only place a pair identity is bound.
```

---

## 20. Claim history exclusion

```text
RI-20.1 Full Claim history stays OUT: no prior revision list, diffs, status
        timeline or prior-evidence balance.
RI-20.2 Revision-specific binding (section 6) is sufficient for a
        RelationInput. History MAY be used by later Impact/Revision logic;
        it MUST NOT be used as pair semantics.
```

---

## 21. Grounding boundary

```text
RI-21.1 No Grounding field, GroundingRef or Grounding material is part of a
        RelationInput.
RI-21.2 Grounding answers WHERE (GC-1.1) and is silent by design here.
        Future consumers resolve support material through authoritative
        Evidence linkage, not through the pair.
RI-21.3 Re-open trigger RT-2 (section 26) covers the case in which exact
        relation auditability cannot resolve required Grounding from
        Evidence identity.
```

---

## 22. Field Provenance boundary

```text
RI-22.1 No Field Provenance element (origin, transform, provenance
        reference, legacy normalization block) is part of a RelationInput.
RI-22.2 This is aligned with FP-10.5: RelationInput gains no relation
        semantics, confidence or strength from provenance.
RI-22.3 Consumers MAY resolve provenance through semantic field identity on
        the bound revision; the pair does not copy it. Legacy record fields
        keep their own origins and gain no trust by appearing in resolution.
```

---

## 23. Subject boundary

```text
RI-23.1 A RelationInput does not declare same-subject compatibility and
        contains no subject field and no subject-equality precondition.
RI-23.2 Consumers resolve subject semantics from the bound authoritative
        objects and, when present, the bound semantic projection (the
        record-level subject and the proposition-level subject are distinct
        frozen concepts; CP-4.4 / CP-4.6).
RI-23.3 A RelationInput MUST NOT require or license free-text referent
        guessing: a consumer MUST NOT substitute a string-matched referent
        for identity or for a materialized subject.
RI-23.4 Where cross-subject pairs are prevented (selection) or judged
        (Compatibility) is outside this contract. This contract neither
        requires nor forbids up-stream subject gates.
```

---

## 24. Invalid vs incomplete

```text
RI-24.1 Frozen parent semantics remain authoritative for validity and
        completeness (CP-15, QF-5). This contract creates no validity enum.
RI-24.2 An INVALID materialized projection yields no evaluable pair; E4
        applies and refusal happens outside the input.
RI-24.3 A VALID but incomplete projection MAY still form a RelationInput;
        incompleteness is not incompatibility.
RI-24.4 NOT_MATERIALIZED is a third, distinct state (section 10). The
        mappings INCOMPLETE -> incompatible, INVALID -> AMBIGUOUS,
        NOT_MATERIALIZED -> ABSTAINED are forbidden; those are different
        layers.
```

---

## 25. Legacy evidence behavior

```text
RI-25.1 Legacy (not-yet-materialized) sides are legal: the side is
        NOT_MATERIALIZED and semantics resolve from the authoritative
        record. Refusing all legacy sides would silently invalidate the
        accepted corpus.
RI-25.2 The exact set of legacy record fields a consumer reads is NOT
        normative in v1. The contract does not freeze a legacy field list,
        and it MUST NOT depend on Session 2.6's comparability field choices.
RI-25.3 Legacy fields MUST NOT be renamed, merged or promoted into frozen
        slot names; a projection MUST NOT be synthesized from them (RI-9.2).
RI-25.4 Trust-shaped, audit-shaped and identity-duplicating fields
        (confidence, status, verificationLevel, method, source metadata,
        locators, corrections detail, hashes) MUST NOT be read as pair
        semantics even where resolution can reach them.
```

---

## 26. Re-open triggers

```text
RT-1  Evidence mutability: if Accepted Evidence records ever become mutable,
      or evidence revisions become first-class objects distinct from
      records, the identity/hardening position (RI-6.1, RI-6.2, RI-13.3)
      MUST be revisited before further use.   (Review risk R-5)
RT-2  Grounding linkage: if exact relation auditability cannot resolve the
      required Grounding from Evidence identity, the receipt/admission layer
      must provide the linkage; if that is impossible without changing this
      input, this contract re-opens.        (Review risk R-4)
RT-3  Cross-subject ownership: if subject comparability must be decided, or
      a cross-subject pair becomes constructible, Session 2.6 (or the
      selection layer) must own the semantics. This contract re-opens only
      if that ownership requires pair-level information.  (Review risk R-1)
RT-4  Projection bindability: when the semantic layer materializes
      projections, PRESENT becomes reachable without any change to this
      contract. If materialization cannot produce a bindable identity for a
      presented projection, section 8 MUST be revisited.  (Review risk R-3)
RT-5  Content transport: if a consumer must evaluate without read access to
      the bound objects, the caller must supply material as a transport or
      receipt artifact. This contract re-opens only if any consumer requires
      that material to be pair semantics.  (Review risk R-2)
```

---

## 27. Examples (illustrative)

```text
Legal:
  A pair of an accepted Evidence record and a specific Claim Revision at
  asOf, both sides NOT_MATERIALIZED, is a legal RelationInput. Consumers
  resolve record semantics; the relation layer may evaluate or abstain.

Legal:
  The same pair with a materialized projection on the Evidence side is
  PRESENT { frameRef } on that side and NOT_MATERIALIZED on the other.

Refused (NOT_EVALUATED, outside the input):
  future Evidence (E2); unaccepted Evidence (E1); missing/stale revision
  (E3); INVALID materialized projection (E4); a bundle instead of one
  Evidence (E5).

Forbidden by shape, not by refusal:
  an Evidence array; an impactHint; a compatibility field; a subjectRef; a
  processing status; a legacy field list.
```

---

## 28. Change control

```text
RI-28.1 Any future revision of this contract MUST be triggered by a named
        re-open trigger (section 26), a new empirical blocker, or an
        explicit human decision, and MUST NOT increase complexity without
        new empirical evidence.
RI-28.2 Frozen parents MUST NOT be modified to accommodate this contract;
        conflicts are resolved in favor of the parents and reported.
RI-28.3 Freeze converted the status header only. The scope, exclusions and
        re-open triggers remain in force until a successor revision
        explicitly supersedes them.
```
