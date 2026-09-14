# ADR: Claim Relation Engine after the v0.12 spike

Status: accepted (research spike) — 2026-09-14
Scope: next-generation Claim Relation / Impact architecture. Supersedes nothing; proposes the next authorized iteration. No production pipeline is changed by this ADR.
Evidence: `research/claim-reasoning-spike/` (audits, frozen dev set, measured runs, artifacts). Baseline: v0.12 at `658ca01` (pushed to `origin/main` before this spike).

## Context

The v0.12 claim-impact benchmark hit its safety gates but failed every capability gate: strict impact accuracy 7/18, evidence attribution 6/18, unsupported reasoning 7/18, while schema validity was 100% and fabricated/unknown references were 0. The archived run plus the failure decomposition (`research/claim-reasoning-spike/FLOWCREDIT_V012_AUDIT.md`) show the damage is concentrated in the *relation* part of the task, not in the truth layer:

- 9/18 rows collapsed commit/abstention classes into `strengthen` (confirm→strengthen 3/3, insufficient→strengthen 3/3, no_effect→confirm/strengthen 3/3) — a delta-semantics failure, not a knowledge failure.
- 6/18 rows reached a directional impact without citing any direction-bearing NEW evidence: the model answered "is the claim true?" instead of "what does this evidence do to it?".
- 1 case (LOCK-10) silently dropped the one contradicting item out of two new items.
- 1 case (LOCK-04) produced the *correct* impact but was structurally unpersistable (`DISPUTED_WITHOUT_SUPPORT`) — a contract defect.
- 5 cases were penalised for the *old* evidence's role, which the model input never states.

One 9B generative call was doing relation + delta + status + reason + attribution + quote + abstention at once. The spike isolates the relation question and compares architecture options on a fresh, frozen 41-pair dev set.

## Problem

Should the relation step (evidence vs claim → SUPPORTS / COUNTERS / NEUTRAL / AMBIGUOUS) stay with Qwen 9B, move to a lightweight NLI/fact-verification model, or become a deterministic + verifier + reasoning hybrid — decided by measurement on this machine and by deployment/licensing constraints?

## Options

### Option A — Qwen-only relation
Keep a single 9B generative call per (claim, evidence) pair.
Measured: accuracy 0.805, macro-F1 0.773, median 6.07 s and 6.25 GB RSS per pair, 41 model calls for 41 pairs. Direction reading is good (SUPPORTS 11/11, COUNTERS 11/12) but abstention is not: 5 of 8 AMBIGUOUS pairs were forced to SUPPORTS, one scope case was called COUNTERS, one label contradicted the model's own correct arithmetic.

### Option B — Lightweight verifier only
MiniCheck-DeBERTa-v3-Large (435M, MIT) + DeBERTa-v3-base-mnli-fever-anli (184M, MIT), both on MPS.
Measured: accuracy 0.463, macro-F1 0.398, 53.9 ms and 2.08 GB for a pair (both models), 18.5 pairs/s batched. Reason: MiniCheck verifies *textual consistency* — a control probe scores 0.83 for a verbatim restatement but 0.02 for the arithmetically identical claim "…was greater than 40 USD"; the generic MNLI model's entailment signal caught 1 of 11 SUPPORTS, while its contradiction signal caught 9 of 12 COUNTERS. A verifier alone cannot express a four-way relation.

### Option C — Hybrid relation engine (recommended)
```
Accepted Evidence (single item, explicit role)
        ↓
Deterministic checks      numeric comparator · unit normalization · period comparison ·
        ↓                 subject/scope equality · hedge/truncation · table arithmetic
   undecided
        ↓
Lightweight verifier      MiniCheck textual support (≥0.5) · MNLI contradiction gate (≥0.9)
        ↓
   undecided
        ↓
Qwen 9B relation call     one item, relation only, structured output, temperature 0
        ↓
Relation verdict + receipt  (SUPPORTS | COUNTERS | NEUTRAL | AMBIGUOUS)
        ↓  next iteration, not this ADR
Impact reducer            deterministic over (relation, evidence delta, prior claim state)
        ↓
ClaimRevisionProposal
```
Measured: accuracy 0.927, macro-F1 0.916, 30/41 pairs decided by deterministic rules (100% correct on what they decide, 2.6 µs each), 2 pairs finished by the verifier layer, 9 Qwen calls (22% of the workload), end-to-end under 1.5 minutes for the dev set versus 4 minutes for Qwen-only. Zero false counters, zero false supports, zero failed calls.

### Option D — More research required
Not chosen. Licensing, Apple Silicon feasibility and measured accuracy were all resolvable inside this spike; the only genuinely open question (a licensed financial NLI checkpoint) does not block the decision, because the recommended architecture does not depend on one.

## Evaluation

| Dimension | A: Qwen-only | B: verifier-only | C: hybrid |
|---|---|---|---|
| Relation accuracy (41 dev pairs) | 0.805 | 0.463 | **0.927** |
| Macro-F1 | 0.773 | 0.398 | **0.916** |
| AMBIGUOUS recall | 0.38 | 0.13 | **0.75** |
| Latency (41 pairs) | ~4 min | ~14 s | **<1.5 min** |
| Latency per undecided pair | 6.07 s | 0.054 s | 6.07 s (9 calls) |
| Peak resident memory | 6.25 GB | 2.08 GB | 6.25 GB during fallback only |
| Auditability | reasoning only | scores only | rule ids + scores + prompt hash |
| Complexity | lowest | low | medium (three providers, ordered) |
| Licensing | model MIT; no redistribution in repo | MiniCheck models MIT, repo Apache-2.0 | same, plus no new dependency on unlicensed repos |
| Apple Silicon | viable (6 s/pair) | good (MPS) | good |
| CPU-only enterprise path | no | **yes** | yes for the deterministic+verifier subset |

## Decision

**OPTION C — HYBRID RELATION ENGINE**, with three binding conditions:

1. **The deterministic layer is the first implementation, not an optimization.** It is what removed the arithmetic/period/scope errors and cut 73% of the model calls, at microsecond latency and full auditability.
2. **The relation task must be structurally separated from impact.** One provider call answers relation only; the impact mapping (relation + evidence delta + prior claim state → confirm/strengthen/weaken/contradict/no_material_effect/insufficient_evidence) is a deterministic reducer for the decidable part and a bounded model call only for the rest. `COUNTERS` never implies `contradict`, exactly as `SUPPORTS` never distinguishes confirm from strengthen.
3. **NLI labels map as: entailment → SUPPORTS, contradiction → COUNTERS, neutral → NEUTRAL or AMBIGUOUS.** The spike measured that only the high-confidence contradiction direction survives; entailment must be earned by MiniCheck's textual support or by reasoning, not assumed.

Not chosen: Option A (keeps a 9B model on the critical path for arithmetic), Option B (cannot express a four-way relation), Option D (no blocking unknown).

## Consequences

- **Local development**: the common path (numeric, period, scope, table relations) runs with no model resident; deterministic rules are unit-testable in CI (`research/claim-reasoning-test/spike.test.js`); the 9B model is needed only for the residual fallback.
- **Enterprise deployment**: deterministic + verifier can run CPU-only inside a VPC with no external calls; the reasoning fallback can be enabled per deployment. Relation verdicts carry rule/model receipts, so a reviewer can see *why*.
- **Cloud GPU**: not required for the relation layer; if a deployment uses one, it is only for fallback calls, which the routing already bounds.
- **Future fine-tuning**: every routed verdict (claim, evidence, relation, provider, human decision) is training-shaped data for a future small financial relation model — a flywheel, not a commitment. No training, LoRA or dataset distribution happens in this phase, and no unlicensed checkpoint is introduced.
- **LLM-Wiki**: should wait. The relation/impact layers must be stable (and the v0.12 contract defects fixed) before knowledge projection is meaningful; otherwise the wiki would project unverified edges.
- **Claim–Evidence graph**: adopt explicit evidence roles now (new / base support / historical context / superseded), following the CHECKWHY `useful`/`leaf` idea. Letting the model infer the role of historical evidence was penalised 5 times in v0.12.

## Follow-ups required before implementation (not started)

1. Fix the two v0.12 contract defects found in the audit: `DISPUTED_WITHOUT_SUPPORT` when the surviving support is superseded, and the implicit old-evidence role.
2. Pre-register a **new** locked relation evaluation (fresh set, relation labels only) — never reuse the 18 impact cases, and never re-tune against them.
3. Derive structured relation inputs (metric, period, unit, subject/scope, table completeness) from the frozen acquisition contracts; the deterministic coverage is only as good as those fields.
4. Keep the reasoning fallback on the frozen local model (qwen3.5:9b, Q4_K_M, temperature 0, non-thinking) unless a preregistered comparison justifies a change.
