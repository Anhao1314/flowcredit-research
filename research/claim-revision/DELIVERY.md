# Claim Revision Proposal v0.12 — A–X delivery

**STAY ON CLAIM REASONING**

## A. Push confirmation for bb66cc1

The clean complete v0.11.3 baseline bb66cc1d48524e440ffc678a3d77e75df1802bf6 was pushed to origin/main and independently verified. Production push is disabled; baseline history remains unchanged.

## B. Claim authority audit

ResearchMemory.createClaim/reviseClaim → private #writeRevision → append-only Memory transaction is authoritative. Identity = id/subjectId/createdAt; revision = full belief snapshot plus version/predecessor/reason/note/effective and recording times. Diff/status order is a comparison rule, not impact. Correction preserves history, and old superseded references can persist until explicit human revision. Proposal code has only read capabilities and separate persistence. Full audit: research/claim-revision/REPOSITORY_AUDIT.md.

## C. Files changed

All files are additive:

- research/claim-revision/REPOSITORY_AUDIT.md: authority, identity, provenance, temporal/confidence audit.
- contract.js and two *.schema.json: independent proposal and strict model output contracts.
- reader.js: read-only Memory/Admission snapshots and bounded revision summaries.
- context.js: Accepted Evidence/subject/time/base/category checks and exact aliases.
- validation.js: exact quote/reference/impact-status checks and deterministic summary/hashes.
- layer.js: one bounded reasoning call → validated Proposal only.
- store.js: independent external immutable Proposal/review SQLite; no apply writer.
- fixtures.js/dev.js: independently constructed synthetic admissions/Claims and offline matrix.
- eval.js/cli.js: fixed evaluation, preregistration, guarded one-run receipts/resume/protection.
- report.js/README.md: delivery and usage/lifecycle/limitations.
- research/prompts/claim-impact-v012.txt: one frozen impact prompt.
- research/claim-revision-test/*.test.js and agent/test/claim-revision-proposal.test.js: offline safety, lifecycle, reasoning and artifact checks integrated into CI.
- research/eval/claim-revision/*.json: dev/freeze/gate/held-out/results/cost/resource/push/protection/pending proof, including failed registration trace.
- docs/claim-revision-proposal-v0.12.md and research/claim-revision/DELIVERY.md: A–X measured report.

Frozen frontend, Memory authority, acquisition stack, public API versions and every v0.1–v0.11.3 benchmark artifact: zero modifications.

## D. ClaimRevisionProposal schema

claim-revision-proposal/v0.12: proposalId/subjectId/claimId/baseRevisionId/hash; resolved Accepted Evidence IDs; impact/suggestedStatus/confidence direction; finite reasonCode and exact-source reasonSummary/attributions; provider/name/config/prompt/hash; inputHash/outputHash; Audit asOf/public availability/knowledge/base effective/proposal-created times; exact handle map and full bounded input/output provenance; lifecycle pending. additionalProperties=false at output/proposal/attribution boundaries. Independent Candidate, Evidence, Claim and Revision schemas remain unchanged.

## E. Impact taxonomy

confirm, strengthen, weaken, contradict, no_material_effect, insufficient_evidence. Impact describes evidence effect; suggestedStatus is independently restricted to existing supported/partially_supported/disputed/unverified/stale. No numeric confidence update; increase/decrease/unchanged only.

## F. Reason taxonomy

new_supporting_evidence, new_counter_evidence, conflicting_evidence, period_update, metric_deterioration, metric_improvement, source_correction, insufficient_support, no_relevant_change. These are proposal reasons, not automatic authoritative revision commands.

## G. Evidence handle architecture

Provider sees C1/R1/E1…E8, never canonical Claim/Revision/Evidence/Source IDs. IDs resolve exactly with no whitespace/case/fuzzy repair. Require actual accepted Admission reviews; historical reviewed imports without Admission do not qualify. system_test fixture/recovery acceptance is labeled test capability, not authenticated human approval. Superseded history is context only. Provenance preserves Proposal → base revision → Accepted Evidence → Admission snapshot Candidate/support metadata (when present) → Chunk/Source. Legacy v0.4 may have Chunk rather than a newer SourceSpan; the system does not fabricate a missing SourceSpan.

## H. Temporal model

Audit only: ingestion, Evidence extraction, Source retrieval, Admission accepted/recorded and known public availability ≤ asOf; base recording/effective time ≤ asOf ≤ proposalCreatedAt. Date-only cutoffs use UTC end-of-day. observedAt is not availability. Maximum four new items, two existing support/two counter, three revision summaries. Replay theoretically public knowledge is distinct and explicitly rejected here, never backdated into Audit. New superseded Evidence rejects; historical replaced facts cannot be authoritative attribution.

## I. Deterministic validation

Claim exists; exact visible base; accepted Evidence exists; subject/category/time/source hash match; no new superseded item; output schema/enum; exact handles/contiguous quotes; new Evidence attribution; impact/status/reason/direction compatibility; no forbidden investment language; full snapshot/hash/ID recomputation. Exact quotes establish source fidelity, not arbitrary semantic entailment. A valid proposal remains a suggestion for human review.

{"fabricatedEvidenceReference":0,"unknownClaimReference":0,"futureLeakage":0,"wrongSubject":0,"claimMutation":0,"claimRevisionMutation":0,"evidenceMutation":0,"admissionMutation":0,"forbiddenInvestmentRecommendation":0,"providerTimeout":0,"providerError":0}

## J. Proposal persistence

Separate external SQLite storage version 12, immutable Proposal/review tables, transactions and hash verification; repository/symlink paths and Memory database reuse reject. Same ordered bounded input/base/evidence/prompt/model config yields stable input key and Proposal ID; input order determines aliases and is part of the context hash; repeated input returns existing Proposal without new inference. Different output for the same input conflicts instead of overwriting. Model response/receipts checkpoint before Proposal persistence; completed-case resume, drift checks, in-flight/failed call blocks automatic retry.

## K. Human review lifecycle

pending → accepted/rejected; stale derives from current base/hash or correction changes. Exact Proposal hash and latest previousReviewId required. Human local identity is explicit but self-asserted. system_test review requires explicit test constructor; agent/LLM cannot review. Rejection retains original Proposal/review/reason. Accepted review never calls reviseClaim; there is no apply operation. Stale proposals cannot be accepted but may be rejected. No authenticated multi-user security claim.

## L. Development fixtures

9 independent offline scenarios: confirm/strengthen/weaken/contradict/no effect/insufficient/conflicting/latest-period/correction; all PASS. Scripted responses exercise real frozen parser/Validator/Admission/Memory setup and Proposal validation/store/review, not model accuracy. Zero real dev/smoke inference. Adversarial tests cover handles, unsupported quotes, investing, acceptance, temporal/source/subject/base/category, idempotence, hashes, actor boundaries, stale review and immutable SQL.

## M. Locked benchmark

18 synthetic cases, six balanced impacts, independent wording/values; held-out set constructed after prompt/schema freeze, never supplied as answers to the model. Exactly one impact-only local benchmark. Frozen qwen3.5:9b/Q4_K_M/non-thinking/temp0/context8192; one bounded call per case. No acquisition, ranking, embedding, cloud or model switch. All denominators fixed; validation rejects count as failed capability, even with correct raw impact.

## N. Impact accuracy

38.89% overall; weaken/contradict 66.67%. Pre-registered minima 75% and 75%. Raw impact enum matches (secondary, without validation) 8/18; this does not replace the strict primary score.

|Impact|Correct|Total|Accuracy|
|---|---:|---:|---:|
|confirm|0|3|0.00%|
|strengthen|3|3|100.00%|
|weaken|3|3|100.00%|
|contradict|1|3|33.33%|
|no_material_effect|0|3|0.00%|
|insufficient_evidence|0|3|0.00%|

## O. Evidence attribution accuracy

33.33%; minimum 90%. Evaluator requires all adjudicated new evidence handles with correct supports/counters/context/unclear relationships and exact quotations, no fabricated references; old references are checked against retained support/counter/context roles. Schema validity 100.00%; validated Proposal rate 61.11%; insufficient-evidence abstention accuracy 0.00%.

## P. Unsupported reasoning / hallucination

38.89%; pre-registered maximum 10%. Measured as source-invalid quotations, unknown references or adjudicated relationship errors, including blocked outputs. Fabricated Evidence reference rate 0.00%. No unrestricted model summary: reasonSummary is software-rendered exact quoted evidence plus relationship. Cases with non-exact Evidence quotations: 0; cases with old support/context-role disagreement: 5. Old support roles are preserved internally but are not explicitly labeled as currentRole in the model whitelist; the strict evaluator expects retained support roles. This representation/rubric mismatch contributes to errors and limits any blanket hallucination claim. The model also misjudges new-only impact and abstention. This narrowed metric does not certify arbitrary semantic entailment, unstated causal reasoning or real issuer generalization.

## Q. Forbidden investment judgment

0.00%; hard gate zero. Strict finite output contract and forbidden language scan also apply to model quotations; no Buy/Sell/Hold, targets, returns or allocations. Human review is knowledge-state review.

## R. Claims / Revisions protection

Both original v0.2-coreweave.sqlite and v0.4-recovery-final.sqlite are opened read-only, Claims=4 and Revisions=4 before/after, original claim payload hashes unchanged. Sources/Evidence/identities/revisions/corrections/Admission payload hashes are separately protected; every synthetic benchmark Memory snapshot also remains unchanged across reasoning.

```json
{
  "before": {
    "v0.2-coreweave.sqlite": {
      "claims": 4,
      "revisions": 4,
      "evidence": 32,
      "admissions": 0,
      "payloadHash": "sha256:96ccabdbbd3b656741515081bc810110145ebbceb38c00a4b38e83035136ef38",
      "authorityHash": "sha256:cda21b053270ba85cbf061899de85273894cf7035919b1c126a36e942f751057",
      "claimPayloadHash": "sha256:893ea5e78b0dd6332bf7c239c53cf9ffd9233bf9471478d77d89274ffcfc60a3"
    },
    "v0.4-recovery-final.sqlite": {
      "claims": 4,
      "revisions": 4,
      "evidence": 32,
      "admissions": 13,
      "payloadHash": "sha256:684b5c38c769c70a02c8f6b709aefce158cb285fee4a2a368eba1a55448ccb66",
      "authorityHash": "sha256:b086eb9a942b7d04b083788992d57a7374f4da0b2fd7b51322a1934297a50beb",
      "claimPayloadHash": "sha256:11a61f57358f67bcca305753e0472ded6dc0d145031278399094fb46cebfdf6e"
    }
  },
  "after": {
    "v0.2-coreweave.sqlite": {
      "claims": 4,
      "revisions": 4,
      "evidence": 32,
      "admissions": 0,
      "payloadHash": "sha256:96ccabdbbd3b656741515081bc810110145ebbceb38c00a4b38e83035136ef38",
      "authorityHash": "sha256:cda21b053270ba85cbf061899de85273894cf7035919b1c126a36e942f751057",
      "claimPayloadHash": "sha256:893ea5e78b0dd6332bf7c239c53cf9ffd9233bf9471478d77d89274ffcfc60a3"
    },
    "v0.4-recovery-final.sqlite": {
      "claims": 4,
      "revisions": 4,
      "evidence": 32,
      "admissions": 13,
      "payloadHash": "sha256:684b5c38c769c70a02c8f6b709aefce158cb285fee4a2a368eba1a55448ccb66",
      "authorityHash": "sha256:b086eb9a942b7d04b083788992d57a7374f4da0b2fd7b51322a1934297a50beb",
      "claimPayloadHash": "sha256:11a61f57358f67bcca305753e0472ded6dc0d145031278399094fb46cebfdf6e"
    }
  },
  "unchanged": true
}
```

## S. Paid API proof

Paid inference API $0/calls0; paid embedding API $0/calls0. Local receipts: calls 18, input 23970, output 2728, total 26698. Loopback-only frozen provider, cloud disabled and remote guard; no warm-up or real smoke calls.

## T. Resource usage

Offline development and fixture seeding, real inference only one locked benchmark. A failed first registration used Git-quoted Unicode paths: the shell briefly started an empty Ollama server before the failure was noticed; immediately stopped with zero model loads/inference. This process deviation is archived, not hidden. NUL-separated raw-byte baseline hashing fixed it before any locked inference. Successful gate: 2026-09-14T07:52:21.578Z. Model started for the locked run only after successful registration and stopped afterward. Sampled Ollama/runner RSS peak 6.14 GiB on Apple M5, 16 GiB RAM; first sample 2026-09-14T07:52:48.217Z; earliest cold-load peak may be excluded. Median case end-to-end 25.44 s, max 44.76 s; includes impact call/validation/Proposal persistence, excludes offline fixture setup. caffeinate covers real run; no larger model, fine-tuning, continuous monitoring or parallel agents.

## U. Regression

Before inference: 145 agent tests and 21 Proposal tests (nine dev scenarios) PASS; syntax/frontend discipline/isolation and full verify-release PASS. After completion: 146 agent tests and 22 Proposal tests PASS, including exact locked gate/code/history/proposal/authority consistency; syntax, frontend discipline, development isolation and complete verify-release PASS. CSS unchanged, braces 2112/2112. All frozen baseline files are independently raw-byte SHA256 verified.

## V. End-to-end pending Proposal example

Gate not met: benchmark artifact shown for inspection only; no post-gate demo executed. Actual locked local-model output from LOCK-03, on an isolated synthetic existing Claim + system_test Accepted Evidence, stored independently and validated. Pending human review; no actual human review or Claim update. No extra model call.

```json
{
  "proposalId": "CRP-c3de1a896179ba1d9c4c42fd",
  "claimId": "CLAIM-7c84d8454b661399413f5d3d",
  "baseRevisionId": "CLAIM-7c84d8454b661399413f5d3d:v1",
  "evidenceIds": [
    "EVID-9d34abd3cc4118513b9727a7",
    "EVID-778f380fa2ce83e531581fb7"
  ],
  "impact": "weaken",
  "suggestedStatus": "partially_supported",
  "reasonCode": "new_counter_evidence",
  "reasonSummary": "counters: In February, a smaller division declined\nsupports: All operating divisions reported rising receipts in December.",
  "validation": {
    "valid": true,
    "proposalId": "CRP-c3de1a896179ba1d9c4c42fd",
    "authoritativeRevisionWritten": false
  },
  "state": "pending",
  "authoritativeRevisionWritten": false
}
```

## W. Deliberately not implemented

Automatic Claim Revision, apply writer, LLM-Wiki, Thesis, Buy/Sell, portfolio recommendation, Multi-Agent, UI, deployment, continuous monitoring, cloud/larger-model tier, Replay backdating, generic finance semantic certification. This delivery stops at Proposal review.

## X. Decision

**STAY ON CLAIM REASONING**. Safety pass=true; capability pass=false. No post-run prompt/schema/config/threshold changes or exploratory reruns. Remain on claim reasoning; no next-stage work. If reasoning, rather than deterministic plumbing, is the limitation, record LOCAL_MODEL_REASONING_LIMITATION before considering a new model tier. Input-role/evaluator agreement also needs review in a separately authorized iteration; no changes are made to this locked benchmark.

## Locked per-case trace

|Case|Expected impact|Output impact|Valid Proposal|Impact correct|Attribution correct|Error|
|---|---|---|---|---|---|---|
|LOCK-01|confirm|strengthen|true|false|true|NONE|
|LOCK-02|strengthen|strengthen|true|true|false|NONE|
|LOCK-03|weaken|weaken|true|true|true|NONE|
|LOCK-04|contradict|contradict|false|false|false|DISPUTED_WITHOUT_SUPPORT|
|LOCK-05|no_material_effect|confirm|false|false|false|NEW_EVIDENCE_NOT_ATTRIBUTED|
|LOCK-06|insufficient_evidence|strengthen|false|false|false|IMPACT_ATTRIBUTION_INCOMPATIBLE|
|LOCK-07|confirm|strengthen|true|false|false|NONE|
|LOCK-08|strengthen|strengthen|true|true|false|NONE|
|LOCK-09|weaken|weaken|true|true|true|NONE|
|LOCK-10|contradict|strengthen|true|false|false|NONE|
|LOCK-11|no_material_effect|strengthen|false|false|false|IMPACT_ATTRIBUTION_INCOMPATIBLE|
|LOCK-12|insufficient_evidence|strengthen|false|false|false|IMPACT_ATTRIBUTION_INCOMPATIBLE|
|LOCK-13|confirm|strengthen|true|false|true|NONE|
|LOCK-14|strengthen|strengthen|true|true|false|NONE|
|LOCK-15|weaken|weaken|true|true|true|NONE|
|LOCK-16|contradict|contradict|true|true|true|NONE|
|LOCK-17|no_material_effect|confirm|false|false|false|NEW_EVIDENCE_NOT_ATTRIBUTED|
|LOCK-18|insufficient_evidence|strengthen|false|false|false|NEW_EVIDENCE_NOT_ATTRIBUTED|
