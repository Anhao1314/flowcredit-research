# Grounding Contract v1

Status: Accepted / Frozen for v0.12.1A

Parents:
- ADR-0.12.1 Relation Semantics
- Core Proposition Contract v1
- Qualifier Contract v1

Target: v0.12.1A — Session 2.3 Freeze Consolidation
Date: 2026-09-15

Normative scope: the Grounding contract — source-support identity, support
snapshots, text and table support structure, replay guarantees, support
cardinality, failure boundaries and legality. This document is the normative
truth for Grounding from v0.12.1A onward. Where it and any earlier spike,
audit, working contract, adversarial review or amendment text disagree, this
contract wins for v0.12.1A.

Lineage (design provenance, not normative):
`docs/design/session-2.3a-grounding-audit.md` (empirical audit) ->
`docs/design/session-2.3b-grounding-contract.md` (working contract) ->
`docs/design/session-2.3c-grounding-adversarial-review.md` (adversarial
review, amendment set AMEND-G01..G08) -> Human clarifications H-G11 / H-G12
-> human freeze decision OPTION B (MODIFY THEN FREEZE) -> this document.

Out of scope and not designed here: Field Provenance schema (Session 2.4),
CompatibilityAssessment, routing, RelationReceipt, admission runtime changes,
migration tooling, parser / runtime / retrieval / DB / UI / benchmark code.

---

## 1. Purpose and scope

```text
GC-1.1  Grounding identifies the exact source material that supports a
        proposition or a semantic field. It answers: where in the source?
GC-1.2  Grounding is not semantic meaning, not qualifier value, not Field
        Provenance, not confidence, not model rationale, not relation
        reasoning, not source credibility, not admission status.
GC-1.3  Grounding validity is structural and mechanical; semantic correctness
        is owned by later layers (interpretation, admission).
GC-1.4  The contract governs support identity, snapshot content, replay,
        cardinality, legality and failure classes only.
GC-1.5  No grounding confidence score exists at any layer of this contract.
```

---

## 2. Model and boundary

Conceptual structure (the complete v1 model; nothing else is active):

```text
SourceSnapshotIdentity
        |
SupportSnapshot  (TextSupport | TableSupport)
        |
GroundingRef
        |
GroundingSupportSet
```

```text
GC-2.1  Active support kinds are exactly TEXT and TABLE. No MIXED type and
        no CONTEXT role/kind are part of v1.
GC-2.2  The following are NOT part of the v1 active contract: FieldSupportLink,
        MixedSupport, ProofGraph, ContextRole.
GC-2.3  Grounding remains subordinate to ADR-0.12.1 (as-of safety, no hidden
        inference authority, invalid != ambiguous) and to the Core
        Proposition and Qualifier contracts (QF-6.1 origins, QF-6.2
        materialization, QF-7 conflict policy).
GC-2.4  Where a semantic field has no direct source support (registry-derived
        value, implicit trusted subject), grounding stays silent without
        failing the frame; its origin is Field Provenance's responsibility
        (Session 2.4).
```

---

## 3. Identity hierarchy

One canonical persistent identity chain:

```text
SRC -> GDOC -> SPAN/GTBL(+cell coordinate) -> supportRef -> EVID
```

```text
GC-3.1  sourceRef (SRC) is the authoritative source-record identity.
GC-3.2  documentRef (GDOC) is the authoritative identity of one source
        representation under one pinned parser and grounding version.
GC-3.3  SPAN/GTBL(+cell coordinate) are canonical material-location
        identities inside one document representation.
GC-3.4  supportRef is the authoritative identity of one stored
        SupportSnapshot artifact.
GC-3.5  EVID is the Research Memory evidence-record identity.
GC-3.6  Ephemeral handles (S1..S999) are never part of this chain.
GC-3.7  Parser-version-bound identifiers: documentRef, spanRef, GTBL and cell
        coordinates, sentence ids.
GC-3.8  Navigation-only identifiers: page, section, line numbers, bbox,
        free-text location strings and the retrieval chunk id. They must
        never be the sole persistent identity of a support.
GC-3.9  The retrieval-layer DOC identity and the grounding-layer GDOC identity
        are parallel representations of the same source version. Their
        unification or explicit crosswalk is deferred (GC-28); they must
        never be silently conflated.
```

---

## 4. SourceSnapshotIdentity

Purpose: identify the immutable source acquisition snapshot and its
availability boundary needed for grounding replay.

```text
GC-4.1  SourceSnapshotIdentity consists of:
          sourceRef
          format
          contentHashStatus (see GC-6)
          contentHash (present exactly when BOUND)
          availability { availableAt, basis, scope, firstPage }
          representation identity (documentRef; composed of sourceRef,
          contentHash, parserVersion, groundingVersion, scope, firstPage,
          and availability per GC-5)
GC-4.2  Availability participates in the representation identity. Changing
        availableAt or basis must produce an identity/hash mismatch or a new
        SourceSnapshotIdentity; it is never a silent metadata edit.
GC-4.3  SourceSnapshotIdentity must not contain qualifier.temporal or
        executionContext.asOf (GC-5.4).
GC-4.4  The SupportSnapshot carries the same availability as the
        SourceSnapshotIdentity it belongs to; disagreement is INVALID
        (GC-5.3).
```

---

## 5. Availability integrity and time concepts

```text
GC-5.1  availableAt is integrity-bearing.
GC-5.2  availabilityBasis is explicit and auditable. It records why the
        availability instant is what it is (publication/receipt/ingestion/
        document-stated kind, externally checkable where one exists). A local
        ingestion timestamp may be recorded only with that labeling and may
        never be presented as publication availability.
GC-5.3  Support availability must equal the availability bound to its
        SourceSnapshotIdentity. source.availableAt = T2 with
        support.availableAt = T1 is never valid.
GC-5.4  Three time concepts remain strictly separate:
          SourceSnapshotIdentity.availableAt  = when the source became
                                                 available
          Qualifier.temporal                  = what period the proposition
                                                 describes
          executionContext.asOf               = the historical evaluation
                                                 boundary
        Grounding never stores or evaluates asOf and never resolves
        qualifier selectors.
GC-5.5  Availability residual (normative honesty): the Grounding Contract can
        integrity-bind recorded availability, but cannot cryptographically
        prove that the original ingestion-time availability claim was
        truthful. A forged availability basis at first ingestion belongs to
        the acquisition/admission trust boundary; future Provenance /
        Admission policy may strengthen it. No absolute proof may be claimed.
```

---

## 6. Source content hash policy

```text
GC-6.1  Principle: if a stable canonical source representation is available
        at ingestion, contentHash MUST be bound. "Available bytes with
        contentHashStatus = unavailable" is prohibited.
GC-6.2  contentHashStatus has four conceptually distinct states:
          BOUND                        stable canonical representation was
                                       available and its content hash is
                                       computed and bound
          UNAVAILABLE_ACQUISITION_MODE the acquisition mode itself has no
                                       stable canonical byte/content
                                       representation to bind; the reason
                                       must be recorded explicitly
          ERROR                        hash computation/ingestion failure
          NOT_COMPUTED                 computation omitted
GC-6.3  Only BOUND and UNAVAILABLE_ACQUISITION_MODE may appear in a persisted
        valid Grounding v1 record.
GC-6.4  ERROR and NOT_COMPUTED are ingestion/acquisition failures. They must
        block Grounding v1 admission; they may never degrade into
        "unavailable". "Unavailable" never means: hash failed, forgot to
        compute, or bytes lost after ingestion.
GC-6.5  Replay guarantees are distinct and must be reported separately:
          Support replay      = recovering the exact source-support snapshot
                                used by FlowCredit (holds for every valid
                                v1 support)
          Origin verification = verifying snapshot content against the
                                original canonical source representation
        BOUND: both hold. UNAVAILABLE_ACQUISITION_MODE: support replay may
        hold while origin byte verification is weaker/unavailable; the two
        must never be written as the same grade.
GC-6.6  Real precedent: the reviewed HTML earnings release (no byte download,
        HTTP 403, no summary hash substituted) is the canonical
        UNAVAILABLE_ACQUISITION_MODE example.
GC-6.7  A remote resource that changes at the same URL is BOUND at
        acquisition; the later change affects only future acquisitions (new
        contentHash, new representation identity). Historical grounding is
        never retargeted (GC-15.4).
```

---

## 7. SupportSnapshot

```text
GC-7.1  The SupportSnapshot is an immutable historical source-support
        artifact.
GC-7.2  It stores the exact supported content (text slice or cell text), not
        a pointer to be re-rendered at read time.
GC-7.3  It stores content hashes, version pins and the lineage fields of
        GC-4/GC-8.
GC-7.4  Replay must read retained snapshots (plus retained registry records
        for the referenced document/span). Recreating a historical support on
        read from the current parser and the current source is forbidden.
GC-7.5  Canonical serialization is total: every field of the applicable union
        member is present in the canonical form; conditional absence is an
        explicit null, never omission.
GC-7.6  If the original source disappears after admission, support replay
        still works from the retained snapshot; the live cross-check degrades
        to "source unavailable" (an operational fact), and nothing may be
        re-rendered, substituted or nearest-relocated.
GC-7.7  Corrections create new supports (new artifacts); existing snapshots
        are never rewritten in place (GC-15.4).
```

---

## 8. supportRef and supportHash

```text
GC-8.1  supportRef = supportHash.
GC-8.2  supportRef is the identity of one immutable SupportSnapshot artifact.
        It is NOT a semantic proposition identity, fact identity, Evidence
        identity or Claim identity (H-G11).
GC-8.3  Same proposition at a different source location = different
        supportRef: legal and expected. One support may never carry two
        locations.
GC-8.4  The same supportRef must never resolve to different snapshot content.
GC-8.5  supportHash requires stable canonical serialization semantics; the
        contract pins:
          hashAlgorithm           = SHA-256
          canonicalizationVersion = sorted-key JSON v1
        Future runtime must pin these explicitly (see Implementation debt).
GC-8.6  Authority/integrity-bearing snapshot fields are integrity-protected
        by default; non-semantic fields are not exempt from protection merely
        because they are not proposition semantics. Protected examples:
          exact text / cell content
          sourceRef / documentRef assertions
          rowLabel, headerPath (order included), load-bearing unitContext,
          load-bearing tableTitle
          version pins
          availableAt and availabilityBasis
GC-8.7  Display/navigation fields (page, section, line, bbox, display
        location) are covered by supportHash when stored in the immutable
        snapshot, but they are never semantic/source authority on their own
        and never decide support equality.
GC-8.8  Hash integrity failures are INVALID; they are never repaired in
        place.
```

---

## 9. GroundingRef authority hierarchy

```text
GC-9.1  A GroundingRef identifies one snapshot:
          supportKind : TEXT | TABLE
          supportRef  : primary support resolver
          documentRef : assertion pin
          sourceRef   : assertion pin
GC-9.2  supportRef is the only primary resolver. documentRef, sourceRef and
        supportKind are assertion/integrity pins that must be checked against
        the resolved snapshot; they are never alternative resolvers.
GC-9.3  If supportRef resolves to support A while the pins claim B: INVALID.
GC-9.4  A ref that resolves to nothing, or whose pins disagree with the
        snapshot, fails closed: no approximation, no relocation, no partial
        acceptance.
```

---

## 10. TextSupport

```text
GC-10.1 TextSupport is the direct support kind for narrative source material.
GC-10.2 The canonical v1 direct granularity is the sentence support span.
        Block / paragraph material may be used as registry or context
        material, but it is never a peer canonical v1 direct TextSupport
        (AMEND-G06).
GC-10.3 The snapshot stores the exact supported text, not a pointer to be
        re-rendered at read time.
GC-10.4 Required TextSupport snapshot content:
          supportKind = TEXT
          sourceRef / documentRef pins
          parentSpanRef (containing parser span; version-bound)
          sentenceRef / spanRef (version-bound canonical identity)
          exactText
          textHash
          charStart / charEnd (character offsets in the document text)
          spanHash (over the canonical span representation)
          supportHash (= supportRef; GC-8)
          version pins (parserVersion, groundingVersion)
          availableAt / availabilityBasis (GC-5)
GC-10.5 exactText, textHash, charStart/charEnd and spanHash must be mutually
        consistent; an internal disagreement is INVALID (GC-18.4).
GC-10.6 page / section / line / bbox are display/navigation fields with the
        role of GC-8.7; they never substitute for exactText or spanRef.
GC-10.7 Multi-sentence direct TextSupport is not a v1 shape. If a future
        corpus forces it, that requires a contract revision, not a silent
        widening of the granularity.
GC-10.8 A TextSupport snapshot is self-contained in the sense of GC-12.4: if
        interpreting the sentence requires adjacent text, that necessary
        context is recorded in the snapshot or the support is reported
        CONTEXT_INSUFFICIENT (GC-12.2), never re-read freely at replay time.
GC-10.9 Sentence equality is not support equality: the same sentence text in
        a different document or location is a different support
        (different supportHash; GC-8.3).
```

---

## 11. TableSupport and structural roles

```text
GC-11.1 TableSupport is the direct support kind for tabular source material:
        one supported cell plus the structural context needed to interpret
        it (AMEND-G05).
GC-11.2 Required TableSupport snapshot content:
          supportKind = TABLE
          sourceRef / documentRef pins
          tableRef (GTBL identity) and cell coordinate
          cellText (exact supported cell content)
          cellHash (over the canonical cell representation)
          supportHash (= supportRef; GC-8)
          version pins (parserVersion, groundingVersion)
          availableAt / availabilityBasis (GC-5)
GC-11.3 Structural roles:
          CELL_VALUE     the supported cell content itself (always required)
          ROW_LABEL      the row's identifying label
          COLUMN_PATH    ordered sequence of column-header segments
          COLUMN_LABEL   canonical derived representation of the column; it
                         is defined as the final headerPath element (GC-11.5)
          UNIT_CONTEXT   the unit/scale applying to the cell (for example
                         percent, thousands, currency)
          TABLE_TITLE    the table caption/title
GC-11.4 Every role other than CELL_VALUE must be present when it is
        load-bearing for interpreting the cell (GC-12.1). A role that is not
        load-bearing is still stated explicitly in the canonical form, either
        with its recorded value (GC-11.9) or as an explicit null; a role is
        never left ambiguous by omission (GC-7.5).
GC-11.5 COLUMN_LABEL is a canonical derived representation, defined as the
        final headerPath element. It is never an independent authority, and
        it may never be simultaneously present and absent in two equally
        canonical forms.
GC-11.6 headerPath is an ordered sequence; order is semantic:
          2026 -> Q2 -> Actual   is not   Actual -> Q2 -> 2026.
GC-11.7 headerPath depth >= 3 is structurally allowed but NOT YET VALIDATED
        (the reviewed corpus did not exercise it). Such an artifact is legal;
        no claim of validated behaviour may be made for it.
GC-11.8 null unitContext and null tableTitle are legal when the artifact
        records that the role is not load-bearing. Real precedent: the
        percent table (Customer A / 36%) whose unit and title are carried
        elsewhere in the document while the cell remains interpretable.
GC-11.9 Non-load-bearing structural material may still be recorded when
        available; it is then hash-protected like every other stored field
        (GC-8.6). Recording it is optional; its absence must not be
        manufactured into validity (GC-12.2).
GC-11.10 Cell text equality is not support equality: identical text in a
        different table, row or source is a different support (different
        coordinate, different supportHash).
```

---

## 12. Load-bearing rule and self-containment

```text
GC-12.1 Recovery success does not determine semantic requiredness.
        "rowLabel was not recovered, therefore rowLabel is not required" is
        never a valid inference (AMEND-G05).
GC-12.2 If a structural role is load-bearing for interpreting the supported
        cell or text, and its value is not present in the snapshot, the
        support is not valid-and-complete. It fails structural integrity
        with reason CONTEXT_INSUFFICIENT.
GC-12.3 CONTEXT_INSUFFICIENT is a grounding-level insufficiency report. It is
        not a fabricated support and not an unresolved reference; it must
        never be reported as complete support.
GC-12.4 Self-containment principle: a direct Grounding v1 support used for
        newly Accepted Evidence must be self-contained enough to interpret
        its asserted proposition without unconstrained re-reading of the
        current source.
GC-12.5 When necessary context (pronoun referent, unit, table structure) is
        absent from the snapshot, the producer must either record it or
        report CONTEXT_INSUFFICIENT. The consumer must never fall back to
        freely reading the whole page.
GC-12.6 CONTEXT_INSUFFICIENT blocks use of that support for newly Accepted
        Evidence under Grounding v1; it is never converted into a valid
        complete support by re-reading or by re-querying the current source.
```

---

## 13. GroundingSupportSet cardinality

```text
GC-13.1 GroundingSupportSet retains its collection shape for forward
        compatibility.
GC-13.2 v1 active semantics: the set contains exactly one member. Every newly
        Accepted Evidence proposition has exactly one direct support
        (AMEND-G01).
GC-13.3 The superseded "1..n" reading (a set that is valid with any number of
        members) is NOT an active v1 rule. It may appear only as forbidden
        legacy wording; it must never be implemented or relied on.
GC-13.4 A set with n > 1 is UNSUPPORTED / DEFERRED in v1. No combination
        semantics are frozen: ANY_OF, ALL_OF, corroboration, complementary
        proof and similar readings do not exist.
GC-13.5 A producer MUST NOT persist n > 1.
GC-13.6 A consumer encountering n > 1 MUST fail closed.
GC-13.7 Forbidden behaviours: silently taking the first member, flattening
        members into one, inferring AND/OR semantics, or ignoring members
        beyond the first.
GC-13.8 Empirical basis: 158/158 proposals in the reviewed corpus carried
        exactly one support; no corpus case requires n > 1.
```

---

## 14. Persisted-member validity and no silent repair

```text
GC-14.1 Candidate stage: rejecting an invalid or fabricated candidate before
        persistence is the normal, expected flow (AMEND-G07). Rejections are
        permitted to be observable (for example as counts or reason codes);
        they must never be hidden by substituting a different member.
GC-14.2 Every persisted member of a Grounding v1 artifact must resolve and
        validate (GC-18). A persisted artifact never contains an invalid
        member.
GC-14.3 With v1 cardinality (GC-13.2), if the single support is invalid the
        whole grounding is INVALID.
GC-14.4 Forbidden read-time behaviour: filtering, dropping, repairing,
        averaging or falling back to another member. Whatever remains after
        such an operation is not the persisted artifact.
GC-14.5 No silent repair: mutating a persisted member set in place
        (for example [valid, invalid] -> [valid]) is illegal.
GC-14.6 A future migration or repair must produce a new artifact with
        explicit provenance. This contract designs no migration mechanism
        (GC-28).
```

---

## 15. Replay invariants

```text
GC-15.1 Replay reads the retained snapshot. Recreating historical support on
        read, from the current parser plus the current source, is forbidden
        (GC-7.4).
GC-15.2 Version closure: a support is replayable only under the exact version
        set it was created with (parserVersion, groundingVersion, canonical
        serialization version, hash algorithm).
GC-15.3 Replay must reconstruct the exact original support content and its
        hashes. A partial, approximate or "closest" reconstruction is not
        replay.
GC-15.4 Historical grounding is never retargeted: no relocation to a best
        matching current span, no substitution of edited content, no in-place
        rewrite.
GC-15.5 Corrections create new support artifacts (new supportHash). Existing
        snapshots remain exactly as recorded.
GC-15.6 A support whose required retained data is missing is reported as not
        replayable. It is never silently replaced; the failure is explicit.
```

---

## 16. Parser and version drift

```text
GC-16.1 Same source representation plus same pinned versions yields a
        deterministic identity: the same supportHash is expected.
GC-16.2 A different parser, grounding or segmentation version yields no
        identity-stability guarantee: the same material may hash differently
        and may be segmented differently.
GC-16.3 A version mismatch between a ref's pins and the replay environment is
        FAIL LOUDLY. Nearest-match relocation is forbidden.
GC-16.4 Drift is reported as an explicit, observable state (version mismatch
        / not replayable in this environment). It must never degrade into a
        silent fallback to current-parser interpretation.
GC-16.5 Backfilling identifiers across parser versions, and any cross-parser
        stable identifiers, are deferred (GC-28).
```

---

## 17. As-of boundary

```text
GC-17.1 Grounding exposes exactly one time value: the source availability
        instant, with its basis (GC-5.2). Grounding records when the source
        became available; it does not evaluate timeliness.
GC-17.2 Grounding does not store, compute or select executionContext.asOf.
        The historical evaluation boundary is owned by the evaluation layer
        (ADR-0.12.1 section 5.2).
GC-17.3 As-of safety: historical grounding is never resolved against the
        current source state. A support created for an earlier evaluation
        boundary remains bound to its own snapshot.
GC-17.4 Grounding never resolves qualifier selectors such as LATEST. Selector
        resolution and its replay invariant belong to Qualifier
        (QF-8.4 / QF-8.5).
GC-17.5 Whether a source was available as of a given evaluation boundary is
        expressed by comparing availableAt against that boundary. Grounding
        does not itself perform or encode that comparison; it supplies the
        integrity-bound instant the comparison needs.
```

---

## 18. Validity rules

```text
GC-18.1 Validity is evaluated per support against six rule groups. All six
        groups must pass; there is no group-skipping and no waiving.
GC-18.2 Group 1 — Ref resolution:
          supportRef resolves to exactly one stored snapshot;
          supportKind matches the resolved kind;
          documentRef / sourceRef pins agree with the resolved snapshot
          (GC-9.3, GC-9.4).
GC-18.3 Group 2 — Identity match:
          the resolved snapshot's identity fields match the ref's assertions
          (source identity, document identity, span / table / cell
          coordinate, sentence identity for TEXT).
GC-18.4 Group 3 — Hash integrity:
          supportHash recomputes over the canonical form;
          textHash, spanHash, cellHash and the stored exact content agree
          with each other (GC-10.5, GC-11.2).
GC-18.5 Group 4 — Version consistency:
          version pins are internally consistent and complete, and the ref's
          pins equal the snapshot's pins (GC-15.2).
GC-18.6 Group 5 — Structural integrity:
          required structure is present (GC-10.4, GC-11.2), and every
          load-bearing role is either present or explicitly reported missing
          with reason CONTEXT_INSUFFICIENT (GC-12.2).
GC-18.7 Group 6 — Availability integrity:
          availability fields are present and integrity-bearing (GC-5.1,
          GC-5.2), and support availability equals the availability bound to
          the source snapshot identity (GC-5.3).
GC-18.8 Validity is binary per support: VALID, or INVALID with the failing
        group and reason. There is no partial validity, no validity score and
        no confidence value (ADR-0.12.1 section 6.3).
GC-18.9 Grounding validity deliberately does not evaluate financial meaning,
        Claim relation or Evidence admission (GC-1.3, GC-19).
```

---

## 19. Grounding validity is not semantic correctness

```text
GC-19.1 Grounding VALID means the identity, hash, version, structural and
        availability machinery checked out. It says nothing about whether the
        interpretation placed on the material is correct.
GC-19.2 correct cell + wrong interpretation:
          Grounding VALID; the interpretation is rejected by the
          interpretation layer.
GC-19.3 hash mismatch:
          Grounding INVALID, even when the interpretation "looks right". The
          support basis is gone; nothing may pass on plausibility.
GC-19.4 Acceptance chain (frozen ordering):
          Grounding VALID
                  -> semantic interpretation valid
                  -> admission review accepted
                  -> Accepted Evidence
GC-19.5 Grounding valid is necessary but not sufficient for acceptance.
GC-19.6 This contract introduces no new admission states. Whatever states
        admission already uses remain unchanged.
GC-19.7 Grounding INVALID removes the support basis for the item; no later
        layer may accept it by ignoring the invalid grounding.
```

---

## 20. Claim / Evidence asymmetry

```text
GC-20.1 Newly Accepted Evidence under Grounding v1 requires exactly one
        direct, validated, replayable v1 SupportSnapshot (GC-13.2, GC-18).
GC-20.2 Legacy page-level Evidence remains readable but never satisfies that
        requirement by itself (GC-23).
GC-20.3 Claim is asymmetric to Evidence: a Claim does not require direct
        source grounding and does not require an exact source quote.
GC-20.4 Claim support flows through Research Memory lineage
        (supportingEvidenceIds, counterEvidenceIds and related structures).
GC-20.5 A verbatim Claim remains a Claim. A sentence that also appears in the
        source does not become Evidence merely by being identical to source
        text.
GC-20.6 "Every semantic field must be source-grounded" is not a rule of this
        contract (GC-2.4, GC-21).
GC-20.7 Direct source grounding for Claims is deferred (GC-28); nothing here
        may be read as promising it.
GC-20.8 Grounding never mutates a Claim: attaching, changing or removing
        support never rewrites Claim text, Claim identity or Claim relation
        state. Structural change is expressed by new records or new support
        artifacts, never by rewriting a Claim (ADR-0.12.1 section 7).
```

---

## 21. Grounding versus Field Provenance

```text
GC-21.1 Boundary: Grounding answers "where in the source?"; Field Provenance
        answers "how did this structured semantic value arise?". Grounding
        never carries provenance explanations, and Provenance never doubles
        as a support locator.
GC-21.2 Explicit value: a direct TextSupport or TableSupport is recorded; the
        value is grounded normally.
GC-21.3 Registry-derived value (for example a denominator taken from a
        trusted registry): no fabricated span, cell, quote, header or
        locator. The value carries no GroundingRef; its origin is future
        REGISTRY_DERIVED Field Provenance (QF-6.1, QF-6.2).
GC-21.4 Implicit subject filled from trusted record metadata (CP-4.7): the
        fill's provenance is recorded by Field Provenance (CP-4.8).
        Grounding is not fabricated for the fill.
GC-21.5 Normalization and unit transformation: the transform's provenance is
        a Provenance concern. Grounding points to the source material that was
        transformed, never to the transform itself.
GC-21.6 A grounding artefact invented to satisfy a completeness check
        (invented quote, invented header, invented cell, invented locator) is
        a contract violation, not a lesser form of grounding.
GC-21.7 Absence of grounding for a derived or implicit value is not a
        grounding failure: for fields with no direct source support, Grounding
        stays silent without failing the frame (GC-2.4).
```

---

## 22. Ephemeral handles

```text
GC-22.1 S1..S999 style handles are invocation-local model-selection handles
        only.
GC-22.2 They may be used in model input and for model output selection,
        provided resolution back to real support identities is deterministic
        within that invocation.
GC-22.3 They are forbidden in persistent Grounding records, Evidence storage,
        Research Memory, RelationReceipt, replay identity and any stored
        artifact used beyond the invocation.
GC-22.4 A persisted handle is INVALID data: it cannot be resolved later and
        must never be treated as a supportRef or as any other persistent
        identity.
GC-22.5 Handle audit history (tracking which handle mapped to which support)
        is deferred (GC-28).
```

---

## 23. Legacy grounding

```text
GC-23.1 Legacy status belongs on the Evidence record, as an explicit basis
        value (AMEND-G08):
          groundingBasis = V1_SUPPORT | LEGACY_PAGE_LEVEL
GC-23.2 groundingBasis is NOT a GroundingRef kind. It never appears inside a
        GroundingRef or a SupportSnapshot, and it is never a substitute
        support type.
GC-23.3 Legacy page-level Evidence is readable, retained and historically
        honest: it records what was actually true when it was admitted.
GC-23.4 Legacy page-level Evidence does NOT satisfy Grounding v1 and cannot
        serve as the required direct support of GC-20.1.
GC-23.5 No silent upgrade: legacy Evidence is never upgraded in place to v1
        status, and no v1 support is back-filled behind it.
GC-23.6 A future reconstruction must create a new explicit
        reconstruction / migration record. Historical admission grounding is
        never rewritten. No migration schema is designed in this contract
        (GC-28).
```

---

## 24. Illegal combinations and handle legality

```text
GC-24.1 The following forms are ILLEGAL and must be rejected. They may appear
        in this document only as forbidden or superseded forms, never as
        active rules:
          supportKind = MIXED
          supportKind or role = CONTEXT as an active kind
          FieldSupportLink as an active link type
          one ref asserting two active kinds (table plus text)
          a persisted GroundingSupportSet with n > 1 (GC-13.5)
          a persisted member failing any GC-18 group
          "at least one valid member makes the set valid" while other
          members are invalid
          read-time filter / drop / repair / average / fallback to another
          member (GC-14.4)
          contentHashStatus = ERROR or NOT_COMPUTED in a persisted valid
          record (GC-6.4)
          contentHashStatus = unavailable while a canonical representation
          existed at ingestion (GC-6.1)
          availableAt or availabilityBasis edited in place (GC-4.2)
          support availability disagreeing with source availability (GC-5.3)
          a ref whose supportRef resolves to A while its pins claim B
          (GC-9.3)
          a supportRef resolving to different snapshot content at different
          times (GC-8.4)
          an ephemeral handle used as a persistent identity (GC-22.3)
          a legacy page-level record presented as v1 support (GC-23.4)
          replay from the current parser and current source (GC-15.1)
          nearest-match relocation on version drift (GC-16.3)
          a fabricated grounding artifact used to satisfy completeness
          (GC-21.6)
GC-24.2 Handle legality matrix - what each identifier may be used for:
          supportRef              persistent support identity; the only
                                  primary support resolver
          documentRef             assertion / integrity pin
          sourceRef               assertion / integrity pin
          page / section / line / display and navigation assistance only
          bbox
          retrieval chunk id      retrieval-layer identity only
          S1..S999                invocation-local model I/O only
GC-24.3 Using a display-only or invocation-local identifier as the sole
        persistent identity is ILLEGAL (GC-3.8, GC-8.7).
GC-24.4 The identifier chain SRC -> GDOC -> SPAN/GTBL(+cell) -> supportRef ->
        EVID is the only canonical persistent identity chain. Anything not in
        that chain is assertion, navigation or invocation-local data
        (GC-3.1 - GC-3.6).
```

---

## 25. Implementation debt

```text
GC-25.1 The current runtime has only implicit canonicalization / hashing
        behaviour. The contract requires a future runtime to pin
        hashAlgorithm and canonicalizationVersion explicitly (GC-8.5). This
        is recorded implementation debt.
GC-25.2 The machine-payload canonical serialization used for hashing is not
        yet specified; it must be defined before any runtime implements the
        hash (GC-28).
GC-25.3 headerPath depth >= 3 is structurally allowed but not validated
        (GC-11.7). Deep table-header validation remains open work.
GC-25.4 Wherever v1 admission is claimed while supportHash is not actually
        produced from a canonical support snapshot, that is a blocking debt,
        not a satisfied guarantee.
GC-25.5 These debts do not weaken the normative rules above. They are
        recorded so that no implementation may claim conformance it does not
        have.
```

---

## 26. Normative invariants

```text
GC-26.1  Grounding has one canonical persistent identity chain.
GC-26.2  supportRef identifies a SupportSnapshot artifact, not a fact.
GC-26.3  Model handles never become authority.
GC-26.4  Historical replay never depends on current parser.
GC-26.5  Active v1 support cardinality is exactly one.
GC-26.6  Multi-support combination semantics are deferred.
GC-26.7  Persisted v1 support cannot contain invalid members.
GC-26.8  No silent grounding repair.
GC-26.9  availableAt is integrity-bearing.
GC-26.10 availabilityBasis is explicit/auditable.
GC-26.11 Source availability != proposition temporal != evaluation asOf.
GC-26.12 Available canonical source content must be hash-bound.
GC-26.13 Hash errors cannot silently degrade to unavailable.
GC-26.14 Snapshot replay and origin verification are distinct guarantees.
GC-26.15 supportHash uses pinned canonical serialization.
GC-26.16 GroundingRef has one authority hierarchy.
GC-26.17 TextSupport is exact-snapshot based.
GC-26.18 Sentence is v1 canonical narrative granularity.
GC-26.19 TableSupport preserves load-bearing structural roles.
GC-26.20 Recovery failure never waives load-bearing context.
GC-26.21 headerPath order is semantic.
GC-26.22 Grounding validity != semantic correctness.
GC-26.23 Grounding valid is necessary but insufficient for Evidence
         acceptance.
GC-26.24 New v1 Accepted Evidence requires direct replayable Grounding.
GC-26.25 Claim direct source grounding is not generally required.
GC-26.26 Grounding != Field Provenance.
GC-26.27 Derived semantics never receive fabricated Grounding.
GC-26.28 Legacy page-level evidence never masquerades as v1.
GC-26.29 Corrections create new support; history is never retargeted.
GC-26.30 No grounding confidence score.
```

---

## 27. Cross-references

```text
GC-27.1 ADR-0.12.1:
          section 4.6  invalid input is not ambiguity  -> GC-24.1
          section 5.2  as-of invariant                -> GC-17.2, GC-17.3
          section 6.1  relation is not impact         -> GC-19.6 (this
          contract adds no impact semantics or states)
          section 6.3  no generic confidence score     -> GC-1.5, GC-18.8
          section 6.4  no hidden inference authority   -> GC-21.3 - GC-21.5
          section 7.1  truth hierarchy                 -> GC-19.4, GC-19.5
          section 7     no Claim mutation              -> GC-20.8
GC-27.2 Core Proposition v1:
          CP-2.1 - CP-2.3 structured projection / null frame -> GC-19, GC-20
          CP-4.7 - CP-4.12 implicit subject, role/label separation ->
          GC-21.4
GC-27.3 Qualifier v1:
          QF-6.1 provenance-compatible origins        -> GC-21.3
          QF-6.2 registry materialization, no read-time derivation ->
          GC-21.3
          QF-6.5 no silent overwrite                   -> GC-21
          QF-7   conflict policy                       -> unchanged by
          Grounding
          QF-8.4 / QF-8.5 selector vs resolution and replay -> GC-17.4
GC-27.4 Grounding validity never redefines a Qualifier state. REQUIRED_MISSING
        and CONFLICTED keep their Qualifier meanings; Grounding neither
        computes, supersedes nor explains them.
```

---

## 28. Deferred

```text
GC-28.1  FieldSupportLink as an active link type: deferred.
GC-28.2  CONTEXT role as an active support kind/role: deferred.
GC-28.3  Multi-support ANY_OF / ALL_OF combination semantics: deferred.
GC-28.4  Cross-structure complementary support (table plus text acting as one
         combined support): deferred.
GC-28.5  Multi-source proof graph: deferred.
GC-28.6  Deep table-header validation (headerPath depth >= 3): deferred.
GC-28.7  Pre-registry migration of existing evidence: deferred.
GC-28.8  Raw-byte retention policy for sources: deferred.
GC-28.9  Cross-parser stable identifiers: deferred.
GC-28.10 Claim direct Grounding: deferred.
GC-28.11 Fiscal-calendar grounding: deferred.
GC-28.12 DOC / GDOC unification and explicit crosswalk (GC-3.9): deferred.
GC-28.13 Handle audit history (GC-22.5): deferred.
GC-28.14 Availability trust model beyond integrity-binding (GC-5.5):
         deferred.
GC-28.15 Assertion-window robustness: deferred.
GC-28.16 Machine-payload canonical serialization (GC-25.2): deferred.
```

---
