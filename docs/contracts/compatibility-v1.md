Status: Accepted / Frozen for v0.12.1A
Session: 2.6 Compatibility
Human Freeze Decision: APPROVED
Candidate date: 2026-09-15
Frozen date: 2026-09-16

Based on:

```text
2.6A    Compatibility Empirical Audit                    (accepted)
2.6B-1  Compatibility v1 Working Contract                (accepted)
2.6B-2  Compatibility Adversarial Simplification Review  (accepted)
2.6B-3  Compatibility Freeze Candidate Review            (accepted; Human Review PASS)
```

# Compatibility Contract v1 (Session 2.6B-4 freeze candidate)

Repository: `Anhao1314/flowcredit-research` (development/test repository; not
deployed).
HEAD at candidate time: `5c043ad557e6e7cc355342ac8cbcdd61a4b124c4` (`main`).
Date: 2026-09-15.

This document is Accepted / Frozen for v0.12.1A. It implements nothing
and authorizes no implementation; it becomes normative for v0.12.1A only
when the explicit human freeze decision is recorded in the header. The
cross-session clarification dependency recorded by the 2.6B-2 revision (F8:
the frozen ADR's NEUTRAL grounds; CM-46.1, CM-47.2) is RESOLVED by the
published ADR clarification (commit `5c043ad`, ADR §3.3): ADR relation
labels describe permitted evaluations, and a pair whose evaluation was not
permitted receives no Relation label.

Revision note (2.6B-2 -> freeze candidate v1): no normative semantics
changed. Seven non-semantic freeze-preparation edit groups (RC1-RC7 of the
Session 2.6B-3 freeze-candidate review) update status/decision wording only;
the published ADR clarification (commit `5c043ad`) is incorporated as
resolved status. The working revision and its review trail remain in the
design history listed below.

Parents (frozen; unchanged and not re-designed by this document):

```text
Core Proposition Contract v1      (2.1)
Qualifier Contract v1             (2.2, nine slots)
Grounding Contract v1             (2.3)
Field Provenance Contract v1      (2.4)
RelationInput Contract v1         (2.5)
ADR-0.12.1 Claim Relation Semantics (frozen relation taxonomy + status model)
```

This document originated as the freeze candidate of the 2.6B-2 working
model (see the design history above); the explicit human freeze decision is
now recorded in the header; it is Accepted / Frozen for v0.12.1A, and it
creates no runtime artifact. Its only cross-session
dependency in the working revision (F8: the frozen ADR's NEUTRAL grounds) is
RESOLVED by the published ADR clarification (commit `5c043ad`; CM-46.1,
CM-47.2).

---

## 1. Status

CM-1.1  Status is Accepted / Frozen for v0.12.1A (human freeze decision APPROVED; see the
        header). The names approved for freeze by the Session 2.6B-3 freeze
        review are the contract's names: CompatibilityAssessment, the three
        disposition values COMMENSURABLE / NOT_COMMENSURABLE / INDETERMINATE,
        and findings. No other vocabulary may be treated as a Compatibility
        enum.
CM-1.2  No runtime, schema, migration, test, fixture, prompt, verifier,
        gold-label or relation-engine change is made or proposed as work.
CM-1.4  Parents are consumed as frozen. Where this contract would need a
        parent change to work, that is recorded as a freeze blocker, never as
        an edit. The one dependency of this kind (F8: the frozen ADR's
        NEUTRAL grounds) was a clarification, not an edit, and is resolved by
        the published ADR clarification (commit `5c043ad`; ADR §3.3). No live
        dependency remains.

## 2. Motivation

2.6A established empirically (locked findings A–L, §5) that no current
component answers Compatibility alone, that comparability decisions are
dispersed across relation rules, provider gates and model reasoning, and that
the answer to "can these two propositions be compared?" is currently encoded
as Relation NEUTRAL, Relation AMBIGUOUS, or an Impact decision.

Consequences observed in the archive:

```text
- 10 NEUTRAL-expected pairs: 2.6B-2 re-read them and finds four kind-rule
  refusals, five comparable-but-non-bearing pairs whose NEUTRAL is a legal
  Relation outcome, and one unreadable predicate (§38, CM-38.2).
- 5 model answers asserted a direction on pairs whose deciding qualifier was
  absent (DEV-031/033/034/035/036).
- 5 compatibility-shaped failures (DEV-020/023, LOCK-05/11/17) and 4 silently
  validated wrong impacts (LOCK-01/07/10/13) are attributable to a missing
  comparability decision, not to arithmetic.
- P0-1 (2.6A): comparability absorbed into directional labels with no
  visibility anywhere.
```

The purpose of Compatibility v1 is therefore narrow and structural: decide
whether a presented pair's two proposition sides are sufficiently semantically
commensurable to enter Relation evaluation, and make that decision auditable
for humans without reading model reasoning.

## 3. Scope

CM-3.1  Compatibility v1 decides exactly one question:

```text
PRIMARY QUESTION
Given ONE valid RelationInput (one Accepted Evidence x one specific Claim
Revision x one asOf), can the two proposition sides be meaningfully compared
for a directional Relation judgment?
```

CM-3.2  The scope is one pair, one evaluation boundary, one analytical
        artifact. Nothing else.
CM-3.3  In scope: the commensurability semantics of the pair as readable on
        existing frozen paths (the kind rule of CM-19.x, the referent and
        timeline readability questions of CM-18.3/CM-22.2, and the
        consultation clause of CM-25.2 for present frozen qualifier values),
        the disposition derivable from those semantics, the auditability of
        the decision, and the Relation execution gate.
CM-3.4  Out of scope (§4): eligibility, selection, relation, impact,
        grounding validation, provenance trust, persistence and schema.

## 4. Non-goals

```text
NOT a Relation Engine rewrite
NOT a RelationReceipt design
NOT a benchmark relabeling
NOT an implementation, prompt, endpoint, UI, surface card, SQL, or migration
NOT a new frozen contract (this session produces no docs/contracts file)
NOT a re-argument of any 2.6A locked finding (§5); re-readings of individual
    case dispositions are recorded in §38/§41
NOT a change to RelationInput, the frozen parents, or the frozen ADR
NOT a replacement for the existing deterministic rules (they stay; rule
    ownership may change only in a later, authorized session)
```

## 5. 2.6A findings carried forward (locked)

Taken as empirical inputs; not re-argued here.

```text
A  59 primary cases (41 spike pairs + 18 locked claim-impact cases).
B  32/59 require a comparability question.
C  No current component answers Compatibility alone.
D  Current relation contains compatibility leakage: metric overlap, period
   mismatch, unit-family/absence, subject markers, and parts of model
   reasoning.
E  All 10 NEUTRAL-expected spike cases are empirically non-comparability
   cases.
F  AMBIGUOUS currently mixes rule abstention, missing semantics, true
   ambiguity, and provider/model failure.
G  RelationInput eligibility is NOT Compatibility.
H  LOCK-10 pair-shape defect is NOT a Compatibility result.
I  PRESENT formal projections remain runtime-unreachable today.
J  Current runtime relies on legacy analogues.
K  Grounding / Field Provenance are not Compatibility inputs today.
L  Basis = NOT OBSERVED. Denominator = weak/indirect evidence only.
```

## 6. Terminology

| Term | Meaning |
|---|---|
| pair | the two proposition sides of one RelationInput; never a bundle |
| commensurable | the two sides' load-bearing semantics are readable and no kind incompatibility was established for a directional reading |
| kind incompatibility | both sides carry readable semantics that denote kinds which cannot be placed on a common scale for a directional reading; the only normative blocking rule (CM-19.1) |
| unreadable semantics (insufficiency) | a load-bearing path's semantics are not readable from the authoritative record or the explicit statement content; the only source of INDETERMINATE |
| disposition | the compatibility answer: one of three values (§15) |
| finding | one audit entry naming the minimal set of existing frozen semantic paths that carries the blocker, plus its basis; findings are blockers only and carry no kind field (§17) |
| legacy side | a pair side whose formal projection is NOT_MATERIALIZED; semantics read from authoritative recorded values and explicit statement content (§32) |
| explicit semantics | semantics stated in the authoritative record (field value) or explicitly in the recorded statement text; never inferred, never defaulted |
| reference-capable value | a frozen qualifier value Compatibility reads when it is present and the comparison requires it; its absence never blocks in v1 (CM-25.2) |

CM-6.1  "Comparable" is not used as a noun in this document; the vocabulary
        of this contract is disposition + findings.
CM-6.2  No term here may be mapped onto an ADR relation label. Compatibility
        produces no SUPPORTS/COUNTERS/NEUTRAL/AMBIGUOUS and no status
        vocabulary of its own beyond the disposition (§11/§37).

## 7. Compatibility boundary

CM-7.1  Compatibility answers: CAN this pair be meaningfully compared for a
        directional Relation judgment?
CM-7.2  Compatibility MUST NOT answer: WHAT is the relation, how strong it
        is, what it does to belief, which pair should have been presented, or
        whether the input is eligible.
CM-7.3  Compatibility MUST NOT duplicate RelationInput identity beyond a
        binding reference (CM-14.7), MUST NOT copy evidence/claim content,
        MUST NOT construct or modify semantic frames, and MUST NOT aggregate.
CM-7.4  Compatibility MUST NOT consume a relation label, an impact label, a
        confidence, or a verifier score as input or output (CM-33.1,
        CM-44.1).

## 8. RelationInput relationship

CM-8.1  Compatibility consumes exactly one RelationInput v1 and is
        meaningless without it. Its assessment binds that input by reference
        (CM-14.7); it never re-derives, re-validates or restates pair
        identity.
CM-8.2  Compatibility operates on the two sides as presented: one Evidence,
        one Claim Revision, one asOf. It MUST NOT consult other evidence,
        claim history aggregates, thesis state or retrieval state.
CM-8.3  Compatibility is downstream of construction and eligibility: if no
        valid RelationInput can be constructed, Compatibility produces no
        outcome at all (CM-9.x). It never produces a "compatibility" result
        as a substitute for a missing pair.
CM-8.4  Compatibility is upstream of Relation and its positive disposition is
        Relation's precondition (§37).
CM-8.5  Compatibility reads semantics from the pinned objects by resolution
        (RI-13.1): the Evidence record, the Claim Revision record, and the
        bound projection when PRESENT exists. It never mutates them and never
        writes a frame (RI-9.2).

## 9. Eligibility boundary

CM-9.1  The following never produce a normal Compatibility outcome: accepted
        Evidence (E1), availability at asOf (E2), Claim Revision authority
        (E3), semantic legality (E4), pair shape (E5). They are RelationInput
        construction/eligibility (RI §11) and the runtime gates that
        implement them.
CM-9.2  A malformed or unconstructible input yields NO pair and therefore NO
        compatibility assessment and NO relation outcome; ADR §4.3
        NOT_EVALUATED + null describes the relation side of that refusal.
CM-9.3  LOCK-10 (a two-evidence bundle reaching a pairwise pipeline) MUST NOT
        be represented as a Compatibility result and MUST NOT be encoded as
        anything like "incompatible multi-evidence". It is a pair-shape
        eligibility defect (ADR §6.2, RI §18) owned by RelationInput /
        orchestration.
CM-9.4  Compatibility must not be invoked to decide whether evidence is
        accepted, trusted, or visible.

## 10. Selection boundary

CM-10.1  Selection answers: SHOULD this pair be considered/presented?
         Compatibility answers: GIVEN this valid presented pair, CAN the
         proposition semantics be read and compared?
CM-10.2  Compatibility MUST NOT own retrieval ranking, candidate discovery,
         subject filtering policy, portfolio relevance, or "which evidence
         is interesting".
CM-10.3  Selection may continue to own obvious identity filtering (for
         example subject-id equality as a construction precondition). That
         pre-filtering is not a compatibility verdict and must not be
         reported as one.
CM-10.4  Where the two subjects are not identical but semantically related
         (segment/group, subsidiary/parent, part/whole, peer), the bearing
         question belongs to Relation, not Compatibility: Compatibility's
         only subject-side question is whether a load-bearing referent is
         readable (CM-18.3), and its answer is insufficiency, never a
         conflict (2.6B-2: the 2.6B-1 "related subject" conflict rule is
         removed, CM-18.4).
CM-10.5  Referent resolution of an unstated subject/metric is NOT selection
         policy and NOT model discretion; it is insufficiency when the record
         does not state it (CM-18.3, CM-32.3.2d).

## 11. Relation boundary

CM-11.1  Compatibility MUST NOT output SUPPORTS, COUNTERS, NEUTRAL,
         AMBIGUOUS, direction, strength, entailment, probability, or any
         relation-shaped value.
CM-11.2  Compatibility MUST NOT "pre-decide" the relation for the purpose of
         explaining itself. Findings name semantic obstacles; they never
         state a bearing.
CM-11.3  A positive disposition is permission to evaluate, not an assertion
         that the evidence bears on the claim, and not a prediction of the
         relation outcome.
CM-11.4  A negative disposition MUST NOT be converted into a relation label
         by any downstream component (§37).

## 12. Impact boundary

CM-12.1  Compatibility MUST NOT output strengthen/weaken/materiality/revision
         recommendations/belief updates or any ClaimRevisionProposal input.
CM-12.2  Compatibility MUST NOT absorb the value-quality family merely
         because 2.6A found silent failures there (LOCK-01/02/07/08/13/14).
         Restatement, provisional-to-final and correction semantics are
         examined in §29 and assigned ownership explicitly; none of them
         becomes a v1 compatibility rule.
CM-12.3  Persistence (continuation over time) is examined in §28 and
         explicitly excluded from v1 compatibility as a normative dimension.
CM-12.4  Where a pair is refused by Compatibility, no Impact evaluation may
         occur for that pair; the refusal is not "no material effect" and not
         "insufficient evidence" (§37.3).

## 13. Candidate output models

Five candidate models, compared against the nine criteria the task names.
Scoring: good / mixed / poor, with the reason in the cell.

```text
OPTION A  Boolean gate: compatible = true / false
OPTION B  Three-way overall disposition only
          (comparable / not comparable / cannot determine)
OPTION C  Overall disposition + auditable finding/reason set
OPTION D  Dimension findings only, no overall disposition
OPTION E  Score/confidence threshold
```

| Criterion | A (boolean) | B (three-way only) | C (disposition + findings) | D (findings only) | E (score) |
|---|---|---|---|---|---|
| Auditability ("why entered / why refused") | poor: false hides six distinct causes | mixed: right bucket, no reason | good: obstacle + basis per finding | good on detail, no single answer | poor: a number is not a reason |
| Abstention | poor: "false" cannot express "cannot tell" | good | good | good | poor: threshold manufactures decisiveness |
| Determinism posture | good | good | good | good | poor (score invites model grading) |
| Legacy runtime | mixed: forces a verdict even where semantics are absent | mixed: forces a verdict shape but at least allows the third value | good: insufficiency is the honest legacy answer | good | poor |
| Relation gating | mixed: conflates "no" with "unknown" | good | good | poor: consumers would re-derive the gate | poor |
| Reason visibility | poor | poor | good | good | poor |
| Object explosion | minimal but lossy | small | small (findings list) | medium (full matrix pressure) | minimal but opaque |
| Implementation burden | low but wrong | low | moderate (typed findings) | moderate-high | low |
| Future replay | poor: cannot reconstruct why | mixed | good: findings + basis are replayable | good | poor: score is unreproducible |

Assessment:

CM-13.1  Option E is rejected outright. FlowCredit's adjacent frozen contracts
         already reject generic confidence (ADR §6.3; Qualifier v1's
         no-default discipline; Core Proposition §14). A threshold would also
         hide blocking incompatibilities behind a scalar and create an
         un-auditable cutoff. There is no empirical case in which a
         comparability question was a matter of degree: every observed case is
         a known incompatibility, a known insufficiency, or a clean
         alignment.
CM-13.2  Option A is rejected. 2.6A's central defect is that NEUTRAL and
         AMBIGUOUS each hide several semantic causes; a boolean gate
         recreates that loss with fewer bits. Under A, the archive's
         refusals (7 kind incompatibilities + 11 unreadable-semantics cases)
         would collapse into "false".
CM-13.3  Option D is rejected. The gate decision must be a first-class,
         derivable answer; requiring every consumer to recompute it from a
         dimension matrix duplicates logic, invites drift, and contradicts
         the requirement that the overall disposition be derivable from
         findings (§40).
CM-13.4  Option B is insufficient. It is honest and small, but it cannot
         answer the product invariant question "why did this pair enter
         Relation / why was it refused" without reading hidden heuristics
         (2.6A P2-1).
CM-13.5  Option C is the chosen model (§14), attacked and reduced in
         2.6B-2. It is Option B plus the minimum obstacle record needed for
         auditability, with no score, no confidence, and no new dimension
         ontology (§25/§30).

---
## 14. Chosen model

```text
CHOSEN MODEL: OPTION C, attacked and reduced in 2.6B-2.

CompatibilityAssessment (names approved for freeze; CM-1.1)
  input        : a binding reference to the exact RelationInput
  disposition  : COMMENSURABLE | NOT_COMMENSURABLE | INDETERMINATE
  findings     : [ Finding ]   (blocking reasons only; empty if COMMENSURABLE)

Finding
  paths        : the minimal set of existing frozen semantic paths that
                 jointly carry the obstacle (one, or two where the obstacle is
                 genuinely shared; never a new ontology, never a graph)
  basis        : the recorded field value or the explicit statement content
                 (literal tokens) that carries the semantics or its absence
```

Not part of the v1 model (2.6B-2 removed them from the 2.6B-1 draft):
`contractRef`; the finding
`kind` field (derivable from the disposition, see CM-15.3.4); the finding
`note` field; informational/non-blocking findings; the "COMMENSURABLE with
caveats" language; the actuality reading convention; the five-dimension
blocking list (replaced by one kind rule, CM-19.x); special sections for
comparisonReference / denominator / basis (replaced by the general
consultation clause, CM-25.x).

Load-bearing properties:

CM-14.1  One assessment per RelationInput. No bundle, no aggregate, no
         history, no cross-pair reasoning.
CM-14.2  The disposition is DERIVED from blocking findings by the rule of
         CM-15.3, never assigned by taste, model output or threshold.
CM-14.3  Every finding carries a basis. A finding without a basis is a
         defect, not a warning.
CM-14.4  No scores, no confidences, no probabilities, no weights, no ranks.
CM-14.5  The assessment is semantically complete without persistence: it can
         be produced, consumed and discarded. Durability, schema, stores and
         replay metadata are explicitly deferred; nothing non-semantic
         (provider ids, engine ids, model ids, hashes, evaluation time) is
         part of the assessment.
CM-14.6  The assessment is the gate and the record: Relation consumes its
         disposition; humans consume its findings (CM-40.x).
CM-14.7  Binding choice: the assessment binds the exact
         RelationInput by REFERENCE to the input's pair identity, not by
         copying the evidenceId/claimId/revisionId/asOf tuple. No new pair
         identifier is introduced.

## 15. Overall disposition

### 15.1 Disposition values

```text
COMMENSURABLE      every load-bearing path for this pair is readable and no
                   kind incompatibility was established; Relation evaluation
                   is permitted.
NOT_COMMENSURABLE  at least one load-bearing path carries a KNOWN kind
                   incompatibility (CM-19.x); Relation evaluation is refused
                   because no common scale exists for a directional reading.
INDETERMINATE      no kind incompatibility was established, but at least one
                   load-bearing path's semantics are not readable; Relation
                   evaluation is refused because comparability could not be
                   determined.
```

CM-15.1.1  Exactly three values. The count and the names (COMMENSURABLE /
           NOT_COMMENSURABLE / INDETERMINATE) are approved for freeze by the
           Session 2.6B-3 freeze review; no other value exists (CM-15.1.2).
CM-15.1.2  No fourth value exists. There is no "permit with caveats": a
           permitted assessment carries no findings (CM-17.1.3).
CM-15.1.3  Eligibility failure produces no assessment at all (CM-9.x).

### 15.2 Disposition cardinality attack (2.6B-2)

The attack: can the model be PERMIT/REFUSE plus a typed refusal
basis? Assessment: the typed basis would carry the whole distinction, so the
model would survive only if the refusal-basis type is always present and always
read. Two costs decided against it: (a) the gate would have to read findings
to distinguish "definitively refused" from "could not tell", moving the
primary semantic out of the disposition that every consumer reads first; and
(b) the ADR clarification question (CM-47.x) is precisely about that
distinction, so it must be visible at the top of the artifact. Three values
are therefore retained and no finding-kind field is needed (CM-15.3.4).

### 15.3 Derivation rule

```text
1. If any load-bearing path has a KNOWN kind incompatibility
      -> NOT_COMMENSURABLE; findings = the incompatible-kind findings only
2. Else if any load-bearing path's semantics are not readable
      -> INDETERMINATE; findings = the unreadable-path findings
3. Else -> COMMENSURABLE; findings = []
```

CM-15.3.1  Conflict dominates insufficiency for the disposition: one known
           incompatibility is a decisive fact. In that case
           insufficiencies are NOT recorded, because they change nothing about
           the outcome and findings record only blockers.
CM-15.3.2  No archived case contains both a kind incompatibility and an
           unreadable load-bearing path; the rule is stated for the general
           case, not because a case demands it.
CM-15.3.3  No other input may influence the disposition: not a model
           preference, not a verifier score, not an impact hint, not the
           expected outcome.
CM-15.3.4  The finding kind is derivable: NOT_COMMENSURABLE implies
           incompatible-kind findings; INDETERMINATE implies unreadable-path
           findings. A mixed record would be a contract violation, so no kind
           field is needed.

### 15.4 What each disposition means downstream

```text
COMMENSURABLE      Relation evaluation MAY execute (CM-37.1).
NOT_COMMENSURABLE  Relation MUST NOT execute (CM-37.2).
INDETERMINATE      Relation MUST NOT execute (CM-37.2).
```

## 16. Known incompatibility vs unreadable semantics

CM-16.1  The distinction is the contract's primary design decision
         and is preserved at the disposition level.
CM-16.2  Empirical anchors after the 2.6B-2 re-reading:

```text
known incompatibility (7)     DEV-019, DEV-020, DEV-024, DEV-026,
                              LOCK-05, LOCK-11, LOCK-17
unreadable semantics (11)     DEV-027, DEV-029, DEV-030, DEV-031, DEV-033,
                              DEV-034, DEV-035, DEV-036,
                              LOCK-06, LOCK-12, LOCK-18
reclassified to COMMENSURABLE DEV-021, DEV-022, DEV-023, DEV-025, DEV-028
                              (2.6A bucket B -> permit; they are differences
                              of instance, not of kind; see CM-22.2, CM-23.2)
```

CM-16.3  "Not comparable" MUST NOT be used for missing semantics. An absent
         period is not a mismatched period; an absent referent is not a
         different subject.
CM-16.4  Conversely, "cannot determine" MUST NOT be used to soften a known
         incompatibility.
CM-16.5  Unreadable semantics are a property of the PAIR (what the record
         makes available for this evaluation), not of the world: no finding
         may claim permanent incomparability where semantics are merely
         absent.
CM-16.6  Neither negative disposition is a relation label. Neither maps to
         NEUTRAL, AMBIGUOUS, or any impact label.

## 17. Assessment / findings model

CM-17.1  Findings record blockers ONLY:

```text
COMMENSURABLE      findings = []                       (no positive list)
NOT_COMMENSURABLE  findings >= 1, all kind incompatibilities
INDETERMINATE      findings >= 1, all unreadable load-bearing paths
```

CM-17.1.1  There is no "warning" kind and no informational finding.
CM-17.1.2  A permitted assessment records nothing positive. The permission is
           auditable from the disposition plus the pinned pair semantics plus
           the contract (CM-40.2).
CM-17.1.3  "COMMENSURABLE with caveats" is not expressible and is not a
           supported outcome.

CM-17.2  Paths, not a new ontology:

```text
a finding cites existing frozen semantic paths only:
  CP.subject, CP.predicate, CP.objectValue, CP.assertionType,
  CP.direction, CP.comparator,
  QF.temporal, QF.unit, QF.denominator, QF.basis, QF.actuality,
  QF.scope, QF.comparisonReference, QF.persistence, QF.valueQuality
```

CM-17.2.1  There is no CompatibilityDimension enum, no closed list, and no
           graph. Multi-path findings are allowed where the
           obstacle genuinely spans paths (for example predicate + unit in
           DEV-026); the minimal set is used.
CM-17.2.2  A path is cited only when it is load-bearing for the pair
           (CM-31.4); citing a non-load-bearing path is a defect.

CM-17.3  Basis requirement:

```text
allowed basis (read from the pinned records only)
  - a recorded field value (for example the Evidence record's unit)
  - a literal number
  - a literal unit/scale token
  - a literal date/period phrase
  - an explicit entity name or role word
  - an explicit comparator
  - explicit forward-looking or actual wording
not allowed as basis
  - a model-inferred subject, scope, metric, unit, period or referent
  - an unstated denominator or basis
  - any content that is not present in the pinned records
```

CM-17.3.1  A model may classify semantics that are already present (for
           example: this token is a unit; this phrase is a period); it may not
           manufacture the semantics being classified.
CM-17.3.2  A finding whose basis is model-inferred is malformed and MUST NOT
           be produced; the situation is INDETERMINATE by construction
           (CM-32.4.1).
CM-17.3.3  No chain-of-thought, no provider log and no free-text note is part
           of the assessment.

CM-17.4  Replay: a permitted assessment is re-derivable from the
         disposition, the pinned pair semantics and this contract. A refusal
         is re-derivable from the recorded findings. No hidden heuristic is
         required to answer either audit question.

## 18. Subject semantics

CM-18.1  Subject semantics covers three questions kept distinct (2.6A §8):
         identity (selection, CM-10.3), instance difference (not blocking,
         CM-18.2), and referent readability (insufficiency, CM-18.3).
CM-18.2  Rules:

```text
same entity                                 not an obstacle
different entity, relationship stated or    not an obstacle: same-kind
  not, quantity of the same kind            values of different entities are
                                            a bearing question for Relation
                                            (NEUTRAL available)
referent unstated where the subject/        INSUFFICIENCY (DEV-033)
  metric is load-bearing
identity equality already enforced          selection, not Compatibility
  upstream                                  (CM-10.3)
```

CM-18.3  Compatibility MUST NOT resolve a referent from context, from the
         claim's subject or from plausibility. DEV-033/034 are the empirical
         proof that this inference happens today and is wrong.
CM-18.4  The 2.6B-1 rules "aggregate claim vs part value = conflict" and
         "universal claim vs counterexample = aligned" are not rules of this
         contract: both are bearing questions that
         Relation answers (the archive's R11 marker rule already produces the
         correct NEUTRAL for DEV-022/023, and the NLI/Qwen layers produce the
         correct COUNTERS for DEV-012/017). A generic aggregate-vs-part veto
         is not supportable: a largest-customer share can be exactly the
         intended evidence for a concentration claim.
CM-18.5  Compatibility MUST NOT manufacture a subject for a side whose
         subject is unstated; that is insufficiency.
CM-18.6  Residual risk: a pair whose entity relationship is stated but whose
         bearing Relation cannot judge will now produce a Relation outcome
         (potentially NEUTRAL) rather than a refusal. Recorded as a watch item
         (CM-46 W2), not as a Compatibility rule.

## 19. Predicate / metric semantics: the kind rule

CM-19.1  The metric/predicate family is the strongest empirically supported
         dimension (2.6A §9) and is the ONLY normative blocking rule in v1.
         It is stated as one rule, not as a dimension list.

```text
KIND RULE
A pair is NOT_COMMENSURABLE when, on a load-bearing path, both sides'
readable semantics denote kinds that cannot be placed on a common scale for
a directional reading.
```

CM-19.2  Empirical instances of the rule (the only ones with evidence):

```text
(a) a value claim vs a statement that asserts no quantity or property of the
    claim's kind: office/administrative statements and reporting-
    classification statements
      DEV-019, DEV-024, LOCK-05, LOCK-11, LOCK-17
(b) quantities of incompatible measurement kinds for the pair's comparison:
      amount vs ratio           DEV-020
      count vs amount           DEV-026
(c) unit families that cannot be converted (percent vs currency/count)
      no pure archived case; the limb exists because DEV-026 exercises both
      limbs at once
```

CM-19.3  Explicit exclusions from the kind rule:

```text
- differences of INSTANCE are never kind incompatibilities: time period,
  entity, extent/scope, and reference differences are bearing questions for
  Relation (CM-22.x, CM-23.x)
- a qualitative claim informed by a numeric quantity is NOT a kind mismatch
  (a largest-customer share can bear on a concentration claim); the numeric
  evidence must not be refused merely for being numeric
- a direction claim informed by a quantity (or vice versa) is NOT a kind
  mismatch when the quantity can bear on the direction
- object/source form differences (text claim vs table-row value) are NOT kind
  mismatches (CM-20.x)
- restatement / provisional / correction differences are NOT kind mismatches
  (CM-29.x)
- guidance vs actual is NOT a kind mismatch (CM-24.x)
```

CM-19.4  The 2.6B-1 permission rule ("record-stated definitional/component
         derivation -> aligned") is not a rule of this contract: Compatibility must
         not become an entailment engine. Whether a related-but-different
         metric bears on the claim is Relation's question, and Compatibility
         only refuses when the kinds cannot share a scale.
CM-19.5  Model assistance may CLASSIFY the kinds of explicit semantics (for
         example: this token is a percentage; this statement asserts a
         location); it may not invent the semantics being classified and may
         not extend a classification to a semantic the record does not state.
CM-19.6  The line between "related" and "incompatible kind" is the rule's
         softest edge; it is listed as a residual risk and a freeze-review
         item (F7, CM-46 W1).

## 20. Object / assertion semantics

CM-20.1  Assertion-type mismatch is NOT blocking by itself. No
         `sameAssertionType` requirement exists.
CM-20.2  Rules:

```text
numeric vs numeric (same measurement kind)          not an obstacle
threshold vs numeric value                          not an obstacle
direction vs direction                              not an obstacle
direction vs numeric instance                       not an obstacle
qualitative claim vs numeric quantity               not an obstacle
value claim vs non-quantity statement               kind rule (CM-19.2a)
value claim vs quantity of an incompatible kind     kind rule (CM-19.2b)
```

CM-20.3  The 2.6B-1 statement "value-vs-non-value pairs may be conflicts" is
         retained only through the kind rule of CM-19.2a, which requires an
         explicit statement that asserts nothing of the claim's kind; it is
         not a generic form veto.
CM-20.4  Source form differences (text claim vs table-form value, DEV-007) are
         not obstacles; form is a representation question, not a semantic one.

## 21. Unit semantics

CM-21.1  Unit blocking is a limb of the kind rule (CM-19.2c), not a separate
         dimension: a unit-family incompatibility between quantities that are
         otherwise comparable prevents a common scale.
CM-21.2  Rules:

```text
same unit                                   not an obstacle
convertible scale (thousand/million/…; k/m/bn)  not an obstacle (the recorded
                                            conversion is part of the basis)
same family, different scale without a      INSUFFICIENCY
  stated conversion
different family on the same comparison     kind rule (CM-19.2c)
unit absent where the comparison depends    INSUFFICIENCY (DEV-031, DEV-036)
  on it
```

CM-21.3  Load-bearing condition: unit participates only when both
         sides assert quantities whose comparison depends on the unit. A
         qualitative claim vs a numeric quantity does not make unit
         load-bearing for a family veto; it is not unit-blocked.
CM-21.4  No unit score, no conversion confidence, no partial comparability.

## 22. Temporal semantics

CM-22.1  asOf stays eligibility (E2/E3) and is never a compatibility finding
         (RI-12.2).
CM-22.2  Rules:

```text
claim dated, evidence same/overlapping period       not an obstacle
claim dated, evidence explicitly other period       NOT an obstacle: same
                                                    measurement at a different
                                                    time is a bearing question
                                                    for Relation (NEUTRAL
                                                    available); the archive's
                                                    R5 produces the correct
                                                    NEUTRAL for DEV-021/025/028
claim latest-referenced, evidence newer period      not an obstacle (DEV-011,
                                                    LOCK-16)
claim universal/ongoing vs any covered period       not an obstacle
comparative claim vs multi-period series            not an obstacle (DEV-014/
                                                    040)
claim dated, evidence period absent where the       INSUFFICIENCY (DEV-035)
  claim's timeline is load-bearing
claim period absent where the timeline is           INSUFFICIENCY (no
  load-bearing                                     archived case)
```

CM-22.3  The universal 2.6B-1 rule "different period = conflict" is not a rule of this
         contract. Temporal insufficiency survives because a comparison
         whose timeline is load-bearing cannot be attempted without a
         readable time.
CM-22.4  "Timeline is load-bearing" is decided by the claim's explicit
         temporal semantics (a dated or latest-referenced claim) or by frozen
         parent applicability (COMPARATIVE requires temporal), not by model
         discretion.
CM-22.5  The R5 rule (period mismatch -> NEUTRAL) is not frozen as
         Compatibility semantics; under this revision it remains a Relation
         rule and is consistent with the contract.

## 23. Scope semantics

CM-23.1  No scope blocking rule exists in v1. Scope runtime is largely
         absent or model-derived; a normative blocking rule cannot rest on
         it, and no archived case requires one (DEV-023 is a bearing
         question: the R11 marker rule yields the correct NEUTRAL).
CM-23.2  Rules:

```text
same subject, same scope                          not an obstacle
same subject, differing extent/breadth            not an obstacle (bearing is
                                                  Relation's)
scope unstated where breadth matters              not an obstacle in v1; the
                                                  burden stays with Relation's
                                                  own reading of the wording
scope as a Compatibility refusal                   does not exist in v1
```

CM-23.3  Compatibility MUST NOT require or permit model inference to
         manufacture a scope; since scope is not load-bearing for
         v1 refusals, no scope finding is produced either way.
CM-23.4  Deferred: if a future case shows a directional reading that is
         meaningless without scope alignment, scope returns with that
         evidence (CM-45 Q3, CM-46 W3).

## 24. Actuality semantics

CM-24.1  The 2.6B-1 actuality reading convention ("an unmarked value statement
         is read as actual-reported") is not a rule of this contract.
CM-24.2  Rationale: the convention was a silent default. It conflicts with
         Qualifier v1's actuality discipline (modality is never defaulted;
         UNKNOWN is not a value; NOT_APPLICABLE must never be read as
         "actual"), with the Field Provenance no-silent-assumption boundary,
         and with the NOT_MATERIALIZED honesty rule (RI-10.2: no semantic may
         be implied by a non-materialized side). No frozen principle permits
         inventing ACTUAL for an unmarked statement.
CM-24.3  Consequences adopted:

```text
- Compatibility does not read, default, classify or block on modality.
- A pair whose modality is unmarked carries no actuality finding and no
  actuality obstacle; modality is simply not a load-bearing path for it.
- A pair with explicit forward-looking wording (guidance/estimate/plan) vs
  explicit actual wording is NOT a kind mismatch (CM-19.3); the bearing
  judgment belongs to Relation, which reads the same wording.
- A pair whose directional meaning genuinely depends on modality alignment
  has no v1 semantic: it is deferred to the materialized QF.actuality slot
  (CM-46 W4). No archived case requires it.
```

CM-24.4  The product invariant "Guidance is not Actual" is not weakened: it
         is a claim-content discipline (a guidance number must never be
         presented as an actual result) plus Relation's reading; Compatibility
         neither enforces nor contradicts it, and no consumer can cite a
         Compatibility finding as evidence that a guidance figure was actual.
CM-24.5  DEV-005/018 and DEV-032 are explained without any modality
         machinery: they are same-kind pairs whose direction Relation judges
         (DEV-005/018 correctly at the deterministic layer; DEV-032 is the
         ADR-legal abstention).
---

## 25. Comparison-reference, denominator, basis: one consultation clause

CM-25.1  The 2.6B-1 special sections for comparisonReference, denominator and
         basis are not rules of v1. No reference-, denominator- or
         basis-specific rule exists in v1: no archived case isolates a
         commensurability question that such a rule would decide.
CM-25.2  They are replaced by ONE general clause.

```text
CONSULTATION CLAUSE
(a) Compatibility reads a frozen qualifier value when it is PRESENT and the
    comparison required for this pair's directional reading depends on it.
(b) An absent such value is not an obstacle by itself: no slot is required,
    no slot is defaulted, no semantic is manufactured.
(c) A present value participates through the pair's readable semantics; if it
    carries a kind incompatibility, the finding cites the corresponding
    frozen path (CM-17.2, CM-19.1).
```

CM-25.3  The clause covers the five capability slots — comparisonReference,
         denominator, basis, persistence and valueQuality — and any other
         frozen qualifier value whose presence the comparison genuinely
         requires. It creates no ranking and no priority among slots.
CM-25.4  Actuality and assertion form are NOT governed by this clause: they
         are governed by CM-24.3 (not read for blocking) and CM-20.x
         (non-blocking form) respectively.
CM-25.5  Rationale for restraint: promoting a slot's capability into a
         blocking rule requires an empirical case where a directional reading
         genuinely fails without it. None exists for the
         capability slots, and the archive's reference/denominator/basis
         cases were resolved by relation-side semantics (DEV-011/014/038/039/
         040; DEV-020 is a measurement-kind case, CM-19.2b).
CM-25.6  Freeze condition: the first real case where a directional reading
         fails because a consultation-clause value is absent returns here
         with evidence.

## 26. Denominator (folded)

CM-26.1  Denominator semantics are covered by the consultation clause
         (CM-25.2); the 2.6B-1 informational-finding language is removed
         (findings are blockers only, CM-17.1).
CM-26.2  A present denominator is read when the comparison depends on it; an
         absent denominator is never an obstacle by itself (CM-25.2b).
CM-26.3  No archived case turns on denominator semantics; the risk that a
         future ratio pair's comparability genuinely turns on a denominator
         is recorded as a residual risk (W3) and a freeze-review acceptance
         item, not as a theory-driven rule.

## 27. Basis (folded)

CM-27.1  Basis semantics are covered by the consultation clause; zero
         empirical cases; nothing is frozen from theory.
CM-27.2  Absence of basis is never an obstacle by itself. A finding may cite
         QF.basis only where the record states a basis and that stated basis
         is itself part of a kind incompatibility.
CM-27.3  Freeze condition: the first basis-sensitive pair returns here with
         evidence before any basis rule is written.

## 28. Persistence (kept out)

CM-28.1  Persistence remains EXCLUDED from v1 as a normative compatibility
         dimension.
CM-28.2  Reasoning: continuation-over-time is a belief-revision question (how
         long a value stays true) owned by Impact. The broad-claim family
         (DEV-012/017, LOCK-03/09/15) is a bearing question: under this
         revision those pairs are explicitly COMMENSURABLE (CM-19.3,
         CM-22.2, CM-23.2) and the archive's R11 marker rule produces the
         correct NEUTRAL for them.
CM-28.3  A PRESENT persistence value participates only through the
         consultation clause (CM-25.2); it never blocks.
CM-28.4  Freeze condition: a case where two sides' persistence semantics make
         a directional relation meaningless.

## 29. Value quality (kept out)

CM-29.1  Value quality remains OUT of v1. No case shows that
         without value-quality alignment the directional relation itself is
         meaningless: the restatement/correction families are semantically
         aligned pairs whose observed failures were attribution/calibration
         errors at other layers.
CM-29.2  Ownership assignment (substance unchanged from 2.6B-1, with the
         2.6B-2 reclassifications):

```text
LOCK-01/07/13  restatement read as new evidence -> confirm vs strengthen is
               an Impact calibration error; the pair's semantics are
               identical (same metric, period, value). Not Compatibility.
LOCK-02/08/14  provisional -> final: input-shape sufficiency for the Impact
               call plus evaluator attribution. Not Compatibility.
LOCK-04        correction semantics: which value is current is read from the
               record's explicit replacement wording; the impact/attribution
               failure is the existing validator's. Not Compatibility.
DEV-002/003/004/010  restatement pairs: semantics aligned; Relation decides.
```

CM-29.3  Correction/supersession semantics are read where the record states
         them and never invented; they never produce a blocking finding.
CM-29.4  Ownership of the value-quality failure family must still be assigned
         by a later authorized session (Impact calibration or the evaluator);
         it is tracked as F10 and is not a Compatibility blocker.

## 30. Dimension disposition matrix

Replaces the 2.6B-1 "candidate dimension matrix" and its five blocking
dimensions. Report:

```text
NORMATIVE BLOCKING RULE     exactly one: the kind rule (CM-19.1), applied on
                            load-bearing paths only. Its empirical instances
                            live on predicate/metric (limbs a, b, c) and
                            unit-family (limb c).
READABILITY QUESTIONS       two: is a load-bearing referent readable
                            (CM-18.3), and is a load-bearing timeline
                            readable (CM-22.2). Their absence is
                            insufficiency (INDETERMINATE), never a conflict.
REFERENCE-CAPABLE ONLY      five capability slots via CM-25.2:
                            comparisonReference, denominator, basis,
                            persistence, valueQuality. Present values are
                            read when required; absence never blocks.
EXCLUDED / OTHER LAYER      eligibility, selection, relation, impact,
                            grounding re-validation, provenance trust,
                            object/source form (CM-20.4), modality reading
                            (CM-24.3), scope breadth (CM-23.x).
NOT EMPIRICALLY READY       none. The former subject/scope/temporal blocking
                            dimensions are gone: what remains of them is
                            empirically grounded (DEV-033, DEV-035).
```

CM-30.1  The v1 blocking surface is therefore one rule plus two readability
         questions; the 2.6B-1 count of "five blocking dimensions" is retired.
CM-30.2  No CompatibilityDimension enum, no closed list, no graph:
         findings cite existing frozen paths (CM-17.2).
CM-30.3  No dimension may block outside the kind rule. In particular:
         different period, different entity, different extent, a different
         metric identity sharing one scale, and unmarked modality are never
         obstacles (CM-19.3).

## 31. Kind-rule minimum (empirical support)

CM-31.1  The minimum v1 structure that explains every negative empirical
         outcome is one kind rule plus two readability questions. Each
         failure family has a home:

```text
kind incompatibilities (7)     DEV-019/020/024/026, LOCK-05/11/17
unreadable load-bearing semantics (11)
   predicate unreadable        DEV-027, DEV-034, LOCK-06/12/18
   value form unreadable       DEV-029 (with period), DEV-030
   unit/scale unreadable       DEV-031, DEV-036
   referent unreadable         DEV-033
   timeline unreadable         DEV-035
out of scope (1)               LOCK-10 (eligibility)
reclassified to COMMENSURABLE (5)
                               DEV-021/022/023/025/028 (differences of
                               instance, not of kind; CM-16.2)
```

CM-31.2  Every negative outcome is explained by empirical evidence; nothing
         is promoted from theory (unchanged from 2.6B-1).
CM-31.3  Unit blocking survives only as kind-rule limb (c) plus the
         unit-readability question when the comparison depends on the unit;
         the 2.6B-1 universal "unit missing -> INDETERMINATE" reading is
         narrowed to the load-bearing condition.
CM-31.4  "Load-bearing" is decided per pair by frozen-parent
         semantics plus the explicit content: a path is load-bearing when its
         readable alignment, or its absence, could change whether a
         directional reading is meaningful for this exact pair. It is never
         a persisted field and never decided by model authority alone
         (CM-22.4, CM-32.4.1).

## 32. NOT_MATERIALIZED / legacy path

### 32.1 Candidate approaches

```text
A. No formal projection -> Compatibility always INDETERMINATE.
B. Explicit legacy evaluation path: read authoritative recorded values and
   explicit statement content, without promoting anything into formal
   semantics.
C. Temporary reconstructed semantic frame.
D. Model-generated frame.
```

### 32.2 Assessment

CM-32.2.1  Option C is rejected. RI-9.2 forbids synthesizing a projection from
           legacy metric/unit/value/statement fields; RI-25.3 forbids
           renaming, merging or promoting legacy fields into frozen slot
           names. A temporary frame is the same synthesis with a shorter
           lifetime.
CM-32.2.2  Option D is rejected for the same reason plus the empirical
           record: model-supplied semantics produced the archive's referent
           failures (DEV-033/034), the scale over-read (DEV-036) and the
           SUPPORTS answers on absent units/periods (DEV-031/035). A
           model-generated frame is fabrication with extra steps.
CM-32.2.3  Option A is rejected as vacuous rather than as unsafe: it would
           refuse all 59 cases, including the compat-relevant cases whose
           semantics are recorded and were decided correctly by deterministic
           rules 30/30. It converts a materialization gap into a blanket
           "incomparable", which conflicts with the insufficiency discipline
           (CM-16.5: a record-dependent absence is not a permanent verdict).
CM-32.2.4  Option B is chosen with guardrails (CM-32.3/32.4). It is the only
           option that is simultaneously honest (nothing is promoted), useful
           (recorded semantics can be read) and constraint-preserving
           (absence stays insufficiency). It remains a migration bridge, not
           a second semantic ontology: no legacy-field enum, no
           reconstructed frame, no guessed slot states.

### 32.3 Legacy evaluation path

CM-32.3.1  Compatibility MAY read:
           (a) authoritative recorded field values of the pinned records
               (today: evidence `metric`, `normalizedValue`, `unit`,
               `periodStart/periodEnd`, `category`, correction marker; claim
               `category`, `status`, `confidence`, `method` and the statement
               text);
           (b) semantics explicitly stated in the recorded statement text.
CM-32.3.2  Compatibility MUST NOT:
           (a) promote a read value into a frozen slot name or claim that a
               frame exists;
           (b) write back to any record;
           (c) read trust-shaped fields as pair semantics (RI-25.4);
           (d) supply a semantic the record does not state.
CM-32.3.3  The side's state remains NOT_MATERIALIZED for auditability; the
           assessment records which basis (field vs statement content) was
           read for each finding (CM-17.3).
CM-32.3.4  Not carried by this contract (removed in 2.6B-2): the 2.6B-1
           "unmarked value = actual-reported"
           reading convention (old CM-24.2/CM-32.3.4). Unmarked modality is
           not read, not defaulted and not an obstacle (CM-24.3). The
           convention conflicted with QF-12.3 (NOT_APPLICABLE never read as
           ACTUAL), with the Field Provenance no-silent-assumption boundary
           and with RI-10.2 (NOT_MATERIALIZED implies nothing), and no
           archived case required it.

### 32.4 Legacy provider obligations

CM-32.4.1  Whatever produces the assessment MUST be able to abstain: when a
           load-bearing path's semantics are not readable, the outcome is
           INDETERMINATE with the unreadable-path finding, never a guess.
CM-32.4.2  A legacy path that cannot abstain is non-conforming, regardless of
           its accuracy on other pairs (the archive's 5 SUPPORTS-on-missing
           answers are the counter-example).
CM-32.4.3  Model assistance on the legacy path may interpret recorded content;
           it may not extend it (CM-19.5, CM-32.2.2), and it may not default
           modality or resolve referents (CM-24.3, CM-18.3).

## 33. Trust boundary

```text
trusted for compatibility purposes
  identity and availability facts of the binding envelope
  authoritative recorded field values of the pinned records
  explicit statement content of the pinned records

not trusted as compatibility fact
  model-supplied subjects, referents, metrics, units, periods, scopes
  model-supplied modality or kind classifications of absent semantics
  verifier scores (NLI / MiniCheck) in any role
  other pairs' semantics, history aggregates, thesis state
  provenance/derived-value origin as a relevance signal
```

CM-33.1  A model statement of the form "the referent is the same" with no
         recorded referent is not a finding; it is a violation (CM-17.3.2).
CM-33.2  Provider failure (timeout, malformed output, parse error) is not a
         compatibility disposition. It is an execution error of the
         implementing provider and must surface as such, never as
         INDETERMINATE-by-accident (mirroring ADR's ERROR separation).
CM-33.3  No rank, weight, vote or ensemble across providers may produce a
         disposition.

## 34. Deterministic / model boundary

CM-34.1  The contract assesses (and does not freeze) a deterministic-first
         posture: explicit recorded semantics should be decidable without a
         model; model assistance is a fallback for semantics that require
         interpretation of prose.
CM-34.2  Empirically deterministic-leaning checks (2.6A §29): explicit period
         comparison; explicit unit family and scale; value presence; explicit
         markers (latest, every-month, universal wording); identity markers.
CM-34.3  Model-assisted candidates after 2.6B-2: measurement-kind
         classification of explicit semantics, predicate readability,
         value-form readability, referent-sufficiency detection (not
         resolution), explicit forward-looking wording classification. Scope
         breadth reading is REMOVED from the list: scope is not load-bearing
         for any v1 refusal (CM-23.1), so a model reading of it can influence
         nothing. Actuality defaulting is REMOVED (CM-24.3).
CM-34.4  Invariants for any model assistance (CM-34.4.x):
           - it may interpret recorded content, never supply missing content;
           - it MUST be able to return "not readable" and that MUST map to
             the unreadable-path finding (INDETERMINATE);
           - it MUST NOT produce a kind-incompatibility finding unless both
             sides carry readable semantics;
           - it MUST NOT default modality, resolve referents, or extend a
             classification to semantics the record does not state;
           - it MUST NOT emit a score, probability or confidence;
           - its output MUST be expressible as findings with bases (or the
             assessment is malformed).
CM-34.5  No engine, no layer count, no threshold and no provider choice is
         frozen by this contract. The boundary statement exists so that a
         later implementation cannot claim that model-only comparability was
         mandated (the archive shows model-only comparability fails).

## 35. Grounding boundary

CM-35.1  Grounding is NOT Compatibility input (2.6A finding K).
         Compatibility does not re-open support, does not re-validate
         quotes, does not test groundedness.
CM-35.2  If a semantic field cannot be trusted without re-opening support,
         that is upstream semantic materialization/validation work, not a
         compatibility finding. The three grounding-adjacent cases
         (DEV-007/027/034) are handled as object/source form (CM-20.4) and
         predicate unreadability (CM-19.x, CM-31.1).
CM-35.3  Compatibility MUST NOT read grounding identity to decide relevance,
         and MUST NOT convert source-form differences into conflicts.

## 36. Field Provenance boundary

CM-36.1  Field Provenance is NOT a compatibility score and NOT a trust
         judgment. Compatibility resolves already-authoritative
         values regardless of origin.
CM-36.2  Converted/derived values (DEV-006/013 unit scaling) participate by
         their semantic identity (the value plus its stated unit/scale), with
         the conversion recorded as the finding basis; no origin weighting, no
         provenance confidence.
CM-36.3  Where provenance would matter (supersession, model-proposed
         metrics), the answer is insufficiency or reading discipline, not a
         provenance rule (CM-29.x, CM-32.3.2d).
---

## 37. Relation execution consequence

CM-37.1  Positive disposition: Relation MAY execute; its own status and
         relation outcome follow the frozen ADR exactly as today.
CM-37.2  Non-positive dispositions: Relation MUST NOT execute. That is the
         whole cross-contract consequence stated here. Recording the
         processing status of a non-executed evaluation belongs to the frozen
         ADR (NOT_EVALUATED + null is its legal cell, ADR §4.3/§4.5); this
         contract neither owns nor restates that mapping.
CM-37.3  A refused pair MUST NOT receive NEUTRAL, AMBIGUOUS or any impact
         label; "no material effect" and "insufficient evidence" are impact
         outputs and require an executed evaluation (CM-12.4).
CM-37.4  ADR interface (resolved; narrowed in 2.6B-2): ADR §3.3 canonizes as
         NEUTRAL the very shape this rule refuses at the top — its example
         ("the company opened a new office" against a customer-concentration
         claim) has the shape of kind-rule limb (a) (CM-19.2a; archived
         instances DEV-019, LOCK-05/11/17). The temporal/
         subject/scope family (DEV-021/022/023/025/028) is not part of that
         tension. The published ADR clarification (commit `5c043ad`, ADR
         §3.3) states that the relation labels describe permitted evaluations
         and that its example does not state which pairs are permitted to
         enter evaluation, so the kind-rule refusal is legal without any
         reinterpretation of the ADR, and a refused pair receives no Relation
         label (CM-37.2/CM-37.3).
CM-37.5  RelationReceipt design is out of scope; a future receipt must be
         able to reference the assessment that permitted or refused the
         evaluation.

## 38. NEUTRAL protection

CM-38.1  Structural rule: a refused pair cannot become Relation NEUTRAL: Relation cannot produce any label for a pair it must not
         execute (CM-37.2/CM-37.3).
CM-38.2  Re-check of the 10 old NEUTRAL cases under the revised model:

| Case | Disposition | Why |
|---|---|---|
| DEV-019 | NOT_COMMENSURABLE | limb (a): an office statement asserts nothing of the claim's kind |
| DEV-020 | NOT_COMMENSURABLE | limb (b): amount vs ratio |
| DEV-021 | COMMENSURABLE | instance difference (period); R5 NEUTRAL is a legal Relation outcome |
| DEV-022 | COMMENSURABLE | instance difference (entity); R11 NEUTRAL is legal |
| DEV-023 | COMMENSURABLE | instance difference (extent); R11 NEUTRAL is legal |
| DEV-024 | NOT_COMMENSURABLE | limb (a): reporting-classification statement |
| DEV-025 | COMMENSURABLE | instance difference (period) |
| DEV-026 | NOT_COMMENSURABLE | limbs (b)/(c): count vs amount |
| DEV-027 | INDETERMINATE | predicate unreadable |
| DEV-028 | COMMENSURABLE | instance difference (period) |

CM-38.3  The task's question ("were any actually comparable but simply
         non-bearing?") is answered yes for five of the ten
         (DEV-021/022/023/025/028). They are now permitted and reach
         Relation, where the archive's existing rules produce the
         ADR-legal RESOLVED+NEUTRAL. This is a reclassification from the
         2.6A bucket, recorded for freeze review.
CM-38.4  The four refusals are all kind-rule cases; none may become NEUTRAL.
         The frozen ADR's own canonical NEUTRAL example has exactly the shape
         of that family; the ADR clarification published in commit `5c043ad`
         (ADR §3.3) resolves the interface — the labels describe permitted
         evaluations — so no silent reinterpretation of the ADR is needed or
         permitted.

## 39. AMBIGUOUS protection

CM-39.1  Structural rule (unchanged): compatibility insufficiency MUST NOT be
         collapsed into Relation AMBIGUOUS; AMBIGUOUS remains available only
         after Relation actually executed and the relation itself was
         ambiguous (ADR RESOLVED/ABSTAINED discipline).
CM-39.2  8 historical AMBIGUOUS cases: 7 become refusals with
         unreadable-semantics findings (DEV-029/030/031/033/034/035/036) and
         1 (DEV-032, "early indications ... may exceed") remains
         COMMENSURABLE so that Relation may abstain legitimately
         (ABSTAINED + AMBIGUOUS is the ADR-legal cell for genuine
         ambiguity). No modality is read for this decision (CM-24.3).
CM-39.3  The 5 Qwen over-answers (SUPPORTS on absent unit/period/referent/
         scale) remain structurally prevented: those pairs never reach a
         relation provider, so no direction can be produced.
CM-39.4  Provider/model failure is neither disposition (CM-33.2); the 8 cases
         contain no provider failure (the archived run had 0 provider errors).

## 40. Auditability

CM-40.1  The two product questions and their answers under this contract:

```text
"Why did this pair enter Relation?"
    disposition COMMENSURABLE with findings = [], plus the pinned pair
    semantics and this contract. There is no positive match list.
"Why was this pair refused?"
    the disposition plus its findings: each finding names the minimal set of
    existing frozen semantic paths and the recorded basis (a field value or
    explicit statement content). Unreadable-path findings additionally name
    what is absent (field absent / statement silent) and claim nothing about
    the world.
```

CM-40.2  Neither answer requires model chain-of-thought, provider logs or
         hidden heuristics. This is why Option C was chosen
         over Option B (§13.4).
CM-40.3  Replay: a permission is re-derivable from the disposition, the
         pinned pair semantics and this contract; a refusal is re-derivable
         from the recorded findings. No hidden heuristic is required for
         either audit question.
CM-40.4  Durability of the refusal record is deferred (CM-14.5); the semantic
         content is complete without persistence, and persistence remains a
         non-semantic design question.

## 41. Empirical examples (59-case regression)

### 41.1 Aggregate result

```text
Dispositions over the 59 archived cases:

  COMMENSURABLE     40   (DEV 29, LOCK 11)
  NOT_COMMENSURABLE  7   (DEV  4, LOCK  3)
  INDETERMINATE     11   (DEV  8, LOCK  3)
  no assessment      1   (LOCK-10: eligibility, out of scope)

Compared with the 2.6A audit buckets (A 34 / B 13 / C 11 / D 1), 2.6B-2
re-reads seven case dispositions:

  DEV-027  B -> INDETERMINATE   (claimed column absent: semantics unreadable,
                                not conflicting)
  DEV-032  C -> COMMENSURABLE   (only the modality is hedged; the archive's
                                AMBIGUOUS label is the ADR-legal abstention
                                and must remain reachable)
  DEV-021  B -> COMMENSURABLE   period instance difference (R5 NEUTRAL is a
  DEV-025  B -> COMMENSURABLE   Relation outcome, not a comparability
  DEV-028  B -> COMMENSURABLE   failure)
  DEV-022  B -> COMMENSURABLE   entity instance difference (R11)
  DEV-023  B -> COMMENSURABLE   extent instance difference (R11)

The refusal set (dispositions other than COMMENSURABLE) shrinks from 23
(12 + 11) to 18 (7 + 11): the five instance-difference cases leave it, no
case enters it, and every 2.6B-1 refusal remains a refusal (DEV-027 changes
disposition from NOT_COMMENSURABLE to INDETERMINATE, both refusals).
```

### 41.2 The task's named cases in detail

| Case | Disposition | Blocking finding(s) | Relation | Owner layer |
|---|---|---|---|---|
| DEV-020 | NOT_COMMENSURABLE | kind rule limb (b): amount vs ratio (paths: CP.predicate, QF.unit; basis: statement content both sides) | refused | Compatibility |
| DEV-021 | COMMENSURABLE | none (period instance difference; R5 NEUTRAL is legal) | allowed (NEUTRAL) | Relation |
| DEV-022 | COMMENSURABLE | none (entity instance difference; R11 NEUTRAL is legal) | allowed (NEUTRAL) | Relation |
| DEV-023 | COMMENSURABLE | none (extent instance difference; R11 NEUTRAL is legal) | allowed (NEUTRAL) | Relation |
| DEV-025 | COMMENSURABLE | none (period instance difference) | allowed (NEUTRAL) | Relation |
| DEV-026 | NOT_COMMENSURABLE | kind rule limbs (b)+(c): count vs amount (paths: CP.predicate, QF.unit) | refused | Compatibility |
| DEV-027 | INDETERMINATE | predicate unreadable (claimed column absent from the table) | refused | Compatibility |
| DEV-028 | COMMENSURABLE | none (period instance difference) | allowed (NEUTRAL) | Relation |
| DEV-031 | INDETERMINATE | unit unreadable (no unit recorded or stated) | refused | Compatibility |
| DEV-033 | INDETERMINATE | referent unreadable ("the figure" unresolved) | refused | Compatibility |
| DEV-034 | INDETERMINATE | predicate unreadable (row without header) | refused | Compatibility |
| DEV-035 | INDETERMINATE | timeline unreadable (dated claim, undated evidence) | refused | Compatibility |
| DEV-040 | COMMENSURABLE | none (two-period percent series; arithmetic is Relation's) | allowed (R2) | Relation |
| LOCK-01 | COMMENSURABLE | none (restatement: identical semantics) | allowed | Impact (confirm vs strengthen) |
| LOCK-05 | NOT_COMMENSURABLE | kind rule limb (a): office-address statement vs receipts value | refused | Compatibility |
| LOCK-07 | COMMENSURABLE | none (restatement) | allowed | Impact |
| LOCK-10 | no assessment | eligibility: two-evidence bundle / pair shape | n/a | RelationInput / orchestration |
| LOCK-11 | NOT_COMMENSURABLE | kind rule limb (a) | refused | Compatibility |
| LOCK-13 | COMMENSURABLE | none (restatement) | allowed | Impact |
| LOCK-17 | NOT_COMMENSURABLE | kind rule limb (a) | refused | Compatibility |

### 41.3 The 10 old NEUTRAL cases under this contract

See CM-38.2: four refusals (DEV-019/020/024/026, all kind-rule), five
permitted (DEV-021/022/023/025/028), one insufficiency (DEV-027).

### 41.4 The 8 historical AMBIGUOUS cases under this contract

| Case | Disposition | Finding | If Relation ran |
|---|---|---|---|
| DEV-029 | INDETERMINATE | value + timeline unreadable (favorable prose, no amount/period) | refused |
| DEV-030 | INDETERMINATE | value-form unreadable (statement truncated) | refused |
| DEV-031 | INDETERMINATE | unit unreadable | refused |
| DEV-032 | COMMENSURABLE | none (semantics readable; modality hedged) | ABSTAINED + AMBIGUOUS (ADR-legal) |
| DEV-033 | INDETERMINATE | referent unreadable | refused |
| DEV-034 | INDETERMINATE | predicate unreadable (header) | refused |
| DEV-035 | INDETERMINATE | timeline unreadable | refused |
| DEV-036 | INDETERMINATE | scale unreadable ("on the reported scale") | refused |

Separation achieved: compatibility insufficiency (7), true
Relation ambiguity (1), provider/model failure (0).

### 41.5 Full 59-case disposition list

For every case the review questions are answered as follows: eligibility and
pair shape are construction-level (LOCK-10 is the only case that produces no
assessment); every pair side resolves through the legacy reading path today
(§32), so "legacy semantics usable" is exactly what the finding column
records (an unreadable path means they were not usable for that path); the
finding column names the blocking kind incompatibility or the unreadable
semantics; Relation is permitted exactly for COMMENSURABLE; and the owner of
anything left is the layer named in the finding's path (or, for LOCK-10,
RelationInput/orchestration).

| Case | 2.6A bucket | Disposition | Finding |
|---|---|---|---|
| DEV-001 | A | COMMENSURABLE | none (aligned numeric threshold) |
| DEV-002 | A | COMMENSURABLE | none (restatement aligned) |
| DEV-003 | A | COMMENSURABLE | none (provisional->final aligned) |
| DEV-004 | A | COMMENSURABLE | none |
| DEV-005 | A | COMMENSURABLE | none (guidance vs actual: bearing is Relation's; no modality read) |
| DEV-006 | A | COMMENSURABLE | none (unit scale conversion readable as basis) |
| DEV-007 | A | COMMENSURABLE | none (source/table form non-blocking) |
| DEV-008 | A | COMMENSURABLE | none (direction aligned) |
| DEV-009 | A | COMMENSURABLE | none |
| DEV-010 | A | COMMENSURABLE | none (correction wording readable) |
| DEV-011 | A | COMMENSURABLE | none (latest wording readable; period difference is bearing) |
| DEV-012 | A | COMMENSURABLE | none (broad claim vs counterexample: bearing is Relation's) |
| DEV-013 | A | COMMENSURABLE | none (unit scale conversion readable as basis) |
| DEV-014 | A | COMMENSURABLE | none (multi-period series; reference readable) |
| DEV-015 | A | COMMENSURABLE | none (distractor clause ignored) |
| DEV-016 | A | COMMENSURABLE | none |
| DEV-017 | A | COMMENSURABLE | none (universal claim vs counterexample: bearing is Relation's) |
| DEV-018 | A | COMMENSURABLE | none (guidance vs actual: bearing is Relation's) |
| DEV-019 | B | NOT_COMMENSURABLE | kind rule limb (a): office statement (CP.predicate) |
| DEV-020 | B | NOT_COMMENSURABLE | kind rule limb (b): amount vs ratio (CP.predicate, QF.unit) |
| DEV-021 | B | COMMENSURABLE | none (period instance difference) |
| DEV-022 | B | COMMENSURABLE | none (entity instance difference) |
| DEV-023 | B | COMMENSURABLE | none (extent instance difference) |
| DEV-024 | B | NOT_COMMENSURABLE | kind rule limb (a): classification statement (CP.predicate) |
| DEV-025 | B | COMMENSURABLE | none (period instance difference) |
| DEV-026 | B | NOT_COMMENSURABLE | kind rule limbs (b)+(c): count vs amount (CP.predicate, QF.unit) |
| DEV-027 | B | INDETERMINATE | predicate unreadable (claimed column absent) |
| DEV-028 | B | COMMENSURABLE | none (period instance difference) |
| DEV-029 | C | INDETERMINATE | value + timeline unreadable |
| DEV-030 | C | INDETERMINATE | value-form unreadable (truncated) |
| DEV-031 | C | INDETERMINATE | unit unreadable |
| DEV-032 | C | COMMENSURABLE | none (modality hedged; Relation may abstain) |
| DEV-033 | C | INDETERMINATE | referent unreadable |
| DEV-034 | C | INDETERMINATE | predicate unreadable (no header) |
| DEV-035 | C | INDETERMINATE | timeline unreadable |
| DEV-036 | C | INDETERMINATE | scale unreadable (reported scale) |
| DEV-037 | A | COMMENSURABLE | none (later restatement aligned) |
| DEV-038 | A | COMMENSURABLE | none (comparator boundary is Relation's) |
| DEV-039 | A | COMMENSURABLE | none (comparator boundary is Relation's) |
| DEV-040 | A | COMMENSURABLE | none (percent arithmetic is Relation's) |
| DEV-041 | A | COMMENSURABLE | none |
| LOCK-01 | A | COMMENSURABLE | none (restatement) |
| LOCK-02 | A | COMMENSURABLE | none (provisional->final) |
| LOCK-03 | A | COMMENSURABLE | none (broad claim vs partial decline: bearing is Relation's) |
| LOCK-04 | A | COMMENSURABLE | none (correction wording readable) |
| LOCK-05 | B | NOT_COMMENSURABLE | kind rule limb (a): office address |
| LOCK-06 | C | INDETERMINATE | value + timeline unreadable |
| LOCK-07 | A | COMMENSURABLE | none (restatement) |
| LOCK-08 | A | COMMENSURABLE | none (provisional->final) |
| LOCK-09 | A | COMMENSURABLE | none (broad claim: bearing is Relation's) |
| LOCK-10 | D | OUT | eligibility: multi-evidence pair shape (no assessment) |
| LOCK-11 | B | NOT_COMMENSURABLE | kind rule limb (a): office address |
| LOCK-12 | C | INDETERMINATE | value + timeline unreadable |
| LOCK-13 | A | COMMENSURABLE | none (restatement) |
| LOCK-14 | A | COMMENSURABLE | none (provisional->final) |
| LOCK-15 | A | COMMENSURABLE | none (broad claim: bearing is Relation's) |
| LOCK-16 | A | COMMENSURABLE | none (latest selector vs newer period: instance difference) |
| LOCK-17 | B | NOT_COMMENSURABLE | kind rule limb (a): office address |
| LOCK-18 | C | INDETERMINATE | value + timeline unreadable |

## 42. P0 / P1 / P2 coverage

| Finding | Assignment | Basis |
|---|---|---|
| P0-1 comparability absorbed into directional labels | MUST SOLVE IN COMPATIBILITY V1 (contract level) | §§7/14-17/37-40: the disposition is decided before Relation, refusals carry visible findings and block execution, so non-comparable pairs cannot become NEUTRAL and insufficient pairs cannot become AMBIGUOUS. Implementation closure is not claimed. |
| P0-2 multi-evidence bundle reached pairwise pipeline | NOT A COMPATIBILITY CONCERN (RelationInput/orchestration) | CM-9.3; LOCK-10 gets no assessment |
| P1-1 missing dimensions | MUST SOLVE IN V1 (one kind rule + two readability questions) and DEFER TO SEMANTIC MATERIALIZATION for the rest | §30/§31; capability vs enforcement split |
| P1-2 claim-side prose-only semantics | DEFER TO SEMANTIC MATERIALIZATION (legacy reading path is the interim bridge, §32) | CM-32.3 |
| P1-3 status separation | MUST SOLVE IN V1 (disposition values; Relation MUST NOT execute; ADR owns status recording) | §15/§37; ABSTAINED remains Relation's |
| P2-1 no comparability/refusal record | MUST SOLVE SEMANTICALLY (assessment artifact); persistence deferred | CM-14.5/CM-40.4 |
| P2-2 verifier thresholds uncalibrated | NOT A COMPATIBILITY CONCERN (contract forbids consuming verifier scores) | CM-33.1/CM-35.x |
| P2-3 regression surface (new case families) | DEFER (case bookkeeping; not a contract item) | §45 statuses |

## 43. Complexity budget (before / after)

```text
                                    2.6B-1        2.6B-2
new concepts                         1             1   (CompatibilityAssessment)
disposition values                   3             3
finding kinds                        2             2   (now DERIVED; no field)
normative blocking rules             5 dimensions  1   (the kind rule)
reading conventions                  1             0   (actuality removed)
required members                     4             3   (binding, disposition,
                                                        findings)
optional members                     2             0   (note; informational
                                                        findings)
dimension vocabulary                 0 new         0 new (frozen paths only)
scores / confidence                  0             0
new entity / DAG / bundle / history  no            no
frozen enums                         no            no
```

CM-43.1  The reduction is real on every axis:
one fewer required member, two fewer optional members, four fewer normative
blocking rules, one fewer reading convention, and no positive/informational
records. Dispositions and finding kinds are unchanged in count; the finding
kind is no longer stored at all.
CM-43.2  Concept count did not increase; no new concept was added anywhere in
         this revision.

## 44. Explicit exclusions

```text
- eligibility, admission, availability and pair shape (CM-9.x)
- selection, retrieval, ranking, portfolio relevance (CM-10.x)
- relation labels, direction, strength, entailment (CM-11.x)
- impact labels, materiality, belief revision, proposals (CM-12.x)
- grounding re-validation (CM-35.x)
- provenance trust judgment / origin weighting (CM-36.x)
- verifier scores as compatibility evidence (CM-33.1)
- model-supplied semantics for absent paths (CM-32.3.2d)
- model-supplied modality or resolved referents (CM-24.3, CM-18.3)
- confidence, probability, similarity, thresholds (CM-44.1)
- persistence/schema/entity design (CM-14.5, CM-37.5)
- benchmark relabeling (no gold label is touched)
- implementation of any kind
```

CM-44.1  No generic confidence of any form: no compatibilityConfidence, no
         similarityScore, no semanticScore, no LLMConfidence, no rank, no
         weight. FlowCredit's adjacent frozen contracts already reject
         generic confidence (ADR §6.3), and the 59 cases contain no graded
         comparability question (CM-13.1).

## 45. Open-question status

Re-evaluation of all 12 2.6B-1 questions:

| # | Question (2.6B-1) | Status | Disposition |
|---|---|---|---|
| Q1 | disposition shape / split insufficiency | RESOLVED | three values kept (§15.2); splitting has no evidence |
| Q2 | naming | RESOLVED | 2.6B-3 freeze review approved the count and the names (CM-15.1.1) |
| Q3 | conflict vs insufficiency precedence | RESOLVED | kind incompatibility decides; only blocking findings participate; no severity (CM-15.3.1) |
| Q4 | positive auditability | RESOLVED | no positive list; disposition + pinned semantics + contract suffice (CM-40.1) |
| Q5 | subject/selection line | RESOLVED | identity filtering = selection; readability = Compatibility; bearing = Relation (CM-10.x, CM-18.x) |
| Q6 | referent detection without guessing | RESOLVED at contract level; mechanism DEFERRED WITH OWNER | the producer MUST be able to abstain (CM-32.4.1); detection mechanism is an implementing-provider obligation |
| Q7 | predicate commensurability line | RESOLVED | the definitional/component permission rule is removed; only the kind rule remains; soft edge kept as residual risk W1 |
| Q8 | actuality reading convention | RESOLVED | removed entirely (CM-24.1, CM-32.3.4) |
| Q9 | legacy path acceptability | RESOLVED | the path promotes nothing, defaults nothing and must abstain (CM-32.3/32.4) |
| Q10 | artifact lifetime | DEFERRED WITH OWNER | non-semantic design question; the semantic contract is lifetime-independent (CM-14.5) |
| Q11 | ADR interaction | RESOLVED | narrowed to the kind-rule family; ADR clarification published in commit 5c043ad (F8) |
| Q12 | capability slots | RESOLVED | special sections removed; consultation clause; absence never blocks (CM-25.x) |

## 46. Freeze-blocker status (F1-F14)

| # | 2.6B-1 blocker | Status | Disposition |
|---|---|---|---|
| F1 | artifact vs gate | RESOLVED | one object is both; durability is a non-semantic design question (CM-14.5/14.6) |
| F2 | disposition shape and naming | RESOLVED | three values retained after the cardinality attack (§15.2); the freeze review approved the naming (CM-15.1.1) |
| F3 | mismatch/insufficiency boundary for mixed cases | RESOLVED | kind incompatibility decides (CM-15.3.1); no archived case mixes; DEV-027/032/036 re-read and stable |
| F4 | finding/reason representation | RESOLVED | blockers only; paths + basis; kind derived; no positive coverage (CM-17.x, CM-40.x) |
| F5 | normative dimension minimum | RESOLVED | one kind rule + two readability questions; the "five dimensions" count is retired (CM-30.1) |
| F6 | subject/selection boundary | RESOLVED | identity filtering = selection; readability = Compatibility; bearing = Relation (CM-18.x) |
| F7 | predicate commensurability rules | RESOLVED | permission rule removed; only the kind rule; soft edge = residual risk W1 |
| F8 | ADR interaction | RESOLVED | ADR §3.3's example is the kind-rule-refused family; the ADR is frozen and is not modified; the clarification is published in commit 5c043ad (CM-37.4, CM-38.4) |
| F9 | actuality reading convention | RESOLVED | convention removed (CM-24.1, CM-32.3.4) |
| F10 | value-quality ownership | RESOLVED for Compatibility | excluded from v1; ownership assignment remains a cross-session item, not a Compatibility blocker (CM-29.4) |
| F11 | basis semantics | RESOLVED | no basis rule; consultation clause (CM-27.x) |
| F12 | denominator non-enforcement | RESOLVED with recorded risk | no denominator rule; absence never blocks; risk recorded (CM-26.3, W3) |
| F13 | legacy evaluation path | RESOLVED | retained with guardrails; promotes nothing; abstention mandatory (CM-32.x) |
| F14 | relation status mapping | RESOLVED | the contract states only "MUST NOT execute"; status recording belongs to the frozen ADR (CM-37.2) |

CM-46.1  No blocker remains. The single dependency recorded at 2.6B-2 (F8)
         was a cross-session ADR clarification, not a contract-revision
         problem, and it is resolved by the published ADR clarification
         (commit `5c043ad`, ADR §3.3). No other blocker is hidden as
         implementation work.
CM-46.2  Watch items (residual risks carried alongside the blockers, not
         blockers themselves):

```text
W1  the soft edge of the kind rule: where "related" ends and "incompatible
    kind" begins (CM-19.6; F7).
W2  pairs whose entity/extent relationship is stated but whose bearing
    Relation cannot judge now produce a Relation outcome (potentially
    NEUTRAL) instead of a refusal (CM-18.6).
W3  a future ratio pair whose comparability genuinely turns on an absent
    denominator would be permitted by v1 (CM-26.3; F12).
W4  a pair whose directional meaning genuinely depends on modality
    alignment has no v1 semantic; it is deferred to the materialized
    QF.actuality slot (CM-24.3).
```

## 47. Contract decision

```text
CONTRACT DECISION (freeze candidate v1)

Compatibility v1 decides ONE pairwise, pre-Relation question with
ONE derived three-value disposition and, for refusals only, a minimal
auditable finding record bound to existing frozen semantic paths:

  COMMENSURABLE      -> Relation MAY execute (findings = [])
  NOT_COMMENSURABLE  -> a load-bearing path carries a known kind
                        incompatibility; Relation MUST NOT execute
  INDETERMINATE      -> a load-bearing path's semantics are not readable;
                        Relation MUST NOT execute

One kind rule with three empirical limbs explains every refusal; two
readability questions explain every insufficiency. All other frozen qualifier
slots are reference-capable via one consultation clause. No score, no
confidence, no new dimension ontology, no new entity, no persistence, no
implementation, no reading convention, no positive finding list.
```

CM-47.1  Revision notes (2.6B-1 -> 2.6B-2), in the task's REMOVE / DEFER /
         NARROW / REFERENCE vocabulary:

```text
REMOVED      contractRef; finding kind field; finding note; informational
             findings; "COMMENSURABLE with caveats"; the actuality reading
             convention; the five-dimension blocking list; the special
             comparisonReference / denominator / basis sections; the
             definitional/component permission rule; the aggregate-vs-part
             conflict rule; the universal-vs-counterexample alignment rule;
             the temporal conflict rule; scope blocking; the subject conflict
             rule.
NARROWED     findings (blockers only); unit blocking (kind-rule limb plus
             load-bearing condition); finding basis (recorded/explicit
             sources only, no inference); "load-bearing" (explicit semantics
             plus frozen-parent applicability, never model authority).
REFERENCED   relation processing status (frozen ADR owns it); the five
             capability slots (one consultation clause, CM-25.2).
KEPT         three dispositions; two finding types (now derived); the known
             incompatibility vs insufficient information distinction; the
             legacy reading path with guardrails.
RECLASSIFIED VS 2.6A   DEV-021/022/023/025/028 (B -> COMMENSURABLE);
             DEV-027 (B -> INDETERMINATE); DEV-032 (C -> COMMENSURABLE).
```

CM-47.2  Freeze dependency (resolved): F8 (ADR clarification). ADR §3.3
         canonizes as NEUTRAL the shape the kind rule refuses (its own
         example is an office statement against a concentration claim). The
         ADR is frozen and was not modified. The question raised for the
         ADR's NEUTRAL grounds — does NEUTRAL require a
         Compatibility-positive pair, or does it also cover pairs this
         contract refuses? — is answered by the published clarification
         (commit `5c043ad`, ADR §3.3): the relation labels describe
         permitted evaluations; they do not state which pairs are permitted
         to enter evaluation, and a pair whose evaluation was not permitted
         receives no label. No blocker remains.

Status: Accepted / Frozen for v0.12.1A (see the header).

---

## Appendix A — Adversarial examples (28)

Columns: eligibility (construction), disposition, findings, Relation
allowed, owner layer of the outcome.

| # | Example | Eligible? | Disposition | Findings | Relation | Owner |
|---|---|---|---|---|---|---|
| 1 | same metric, same period, plain value | yes | COMMENSURABLE | none | allowed | Relation |
| 2 | incompatible measurement kinds (amount claim vs ratio evidence) | yes | NOT_COMMENSURABLE | kind limb (b) (CP.predicate, QF.unit) | refused | Compatibility |
| 3 | statement asserting nothing of the claim's kind (office move vs revenue value) | yes | NOT_COMMENSURABLE | kind limb (a) (CP.predicate) | refused | Compatibility |
| 4 | related metric sharing one scale, no stated derivation (gross margin vs operating margin) | yes | COMMENSURABLE | none (bearing is Relation's) | allowed | Relation |
| 5 | qualitative claim informed by a numeric quantity (largest-customer share vs concentration claim) | yes | COMMENSURABLE | none (bearing is Relation's) | allowed | Relation |
| 6 | different entity, same-kind value (peer revenue vs own claim) | yes | COMMENSURABLE | none (instance difference; R11 NEUTRAL legal) | allowed | Relation |
| 7 | subsidiary value vs group aggregate claim | yes | COMMENSURABLE | none (instance difference; R11 NEUTRAL legal) | allowed | Relation |
| 8 | explicitly different period, same metric | yes | COMMENSURABLE | none (instance difference; R5 NEUTRAL legal) | allowed | Relation |
| 9 | dated claim, evidence undated where the timeline is load-bearing | yes | INDETERMINATE | timeline unreadable (QF.temporal) | refused | Compatibility |
| 10 | unit family mismatch (currency vs percent) | yes | NOT_COMMENSURABLE | kind limb (c) (QF.unit; CP.predicate) | refused | Compatibility |
| 11 | unit missing on evidence, claim unit explicit, comparison depends on it | yes | INDETERMINATE | unit unreadable (QF.unit) | refused | Compatibility |
| 12 | scale referenced without a value ("on the reported scale") | yes | INDETERMINATE | scale unreadable (QF.unit) | refused | Compatibility |
| 13 | referent unresolved ("the figure was 57") | yes | INDETERMINATE | referent unreadable (CP.subject) | refused | Compatibility |
| 14 | reporting-classification statement vs value claim | yes | NOT_COMMENSURABLE | kind limb (a) (CP.predicate) | refused | Compatibility |
| 15 | guidance claim vs actual evidence (modality explicit both sides) | yes | COMMENSURABLE | none (bearing is Relation's; no modality read) | allowed | Relation |
| 16 | unmarked plain value statement | yes | COMMENSURABLE | none (no modality default exists) | allowed | Relation |
| 17 | restated value (same value, "final" wording) | yes | COMMENSURABLE | none | allowed | Impact (confirm vs strengthen) |
| 18 | provisional vs final value | yes | COMMENSURABLE | none | allowed | Impact / model input |
| 19 | correction with explicit replacement wording | yes | COMMENSURABLE | none (reading, not adjudication) | allowed | Impact / validator |
| 20 | ratio evidence with a present denominator the comparison depends on | yes | COMMENSURABLE | none (consultation clause reads it; kind-compatible) | allowed | Relation |
| 21 | ratio evidence whose denominator is absent | yes | COMMENSURABLE | none (absence never blocks; risk W3 recorded) | allowed | Relation |
| 22 | NOT_MATERIALIZED one side: fields recorded, prose explicit | yes | COMMENSURABLE | none (legacy path reads recorded semantics) | allowed | Compatibility (legacy path) |
| 23 | NOT_MATERIALIZED both sides, statements state metric/period/unit | yes | COMMENSURABLE | none (statement readings) | allowed | Compatibility (legacy path) |
| 24 | NOT_MATERIALIZED both sides, statements silent on the metric | yes | INDETERMINATE | predicate unreadable (CP.predicate) | refused | Compatibility |
| 25 | multi-evidence bundle (two evidence items) | no | no assessment | n/a | n/a | RelationInput / orchestration |
| 26 | verifier strongly contradicts, but kinds are incompatible | yes | NOT_COMMENSURABLE | kind finding; verifier not consulted | refused | Compatibility |
| 27 | model proposes a referent the record never states | yes | INDETERMINATE | referent unreadable (proposal is a violation, not a finding) | refused | Compatibility |
| 28 | truncated evidence statement with readable value but no assertion | yes | INDETERMINATE | value-form unreadable (CP.objectValue) | refused | Compatibility |

Notes: examples 3 and 5 are the deliberate stress pair — non-quantity
statement vs quantity claim. Example 3's statement asserts nothing of the
claim's kind (refusal); example 5's quantity lies on the claim's kind's
scale and is read for bearing by Relation (permission). Example 4 is the
narrowed line: same-kind metrics are never refused; only incompatible
measurement kinds are. Example 21 is the recorded denominator risk (W3).
Example 25 is eligible = no by construction, which is exactly the point: no
compatibility outcome exists for it.
