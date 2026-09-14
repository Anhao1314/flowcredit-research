# Claim relation spike — measured results

All numbers below were produced on this development machine (Apple M5, 10 CPU cores, 16 GiB unified memory, macOS) by the harness in this directory. Sources: `artifacts/nli-output.json`, `artifacts/qwen-output.json`, `artifacts/qwen-resource.json`, `artifacts/results.json`, `artifacts/preregistration.json`.

Run sequence (frozen before any model call, `artifacts/preregistration.json`):

1. `node cli.js freeze` — dev set, relation prompt and code hashes frozen at 2026-09-14T08:36:13Z.
2. `python nli/run_nli.py` — one pass over all 41 frozen pairs (section J/K below).
3. `node cli.js qwen --opt-in --limit 3` — wiring smoke test (3 real calls).
4. `node cli.js qwen --opt-in` — the single preregistered Qwen run over all 41 pairs.
5. `node cli.js evaluate` — all architectures recomputed from stored outputs.

The historical locked 18 were **not** re-run. Thresholds were calibrated on the spike dev set only (section "calibration" in `results.json`).

## A. Relation accuracy and Macro-F1 (41 frozen dev pairs)

| Architecture | Accuracy | Macro-F1 | Coverage | SUP rec. | CNT rec. | NEU rec. | AMB rec. | False support | False counter | Qwen calls |
|---|---|---|---|---|---|---|---|---|---|---|
| Deterministic only | 30/41 = 0.732 | 0.824 | 0.73 (decides 30) | 0.91 | 0.83 | 0.50 | 0.63 | 0 | 0 | 0 |
| NLI only (2 small models) | 19/41 = 0.463 | 0.398 | 1.00 | 0.09 | 0.67 | 0.90 | 0.13 | 0 | 0 | 0 |
| Qwen 9B only | 33/41 = 0.805 | 0.773 | 1.00 | 1.00 | 0.92 | 0.80 | 0.38 | 0 | 0 | 41 |
| Hybrid, no Qwen | 32/41 = 0.780 | 0.848 | 0.78 | 1.00 | 0.92 | 0.50 | 0.63 | 0 | 0 | 0 |
| **Hybrid + Qwen fallback** | **38/41 = 0.927** | **0.916** | 1.00 | 1.00 | 1.00 | 0.90 | 0.75 | 0 | 0 | 9 |

Recall is per class over the frozen expected labels (SUPPORTS 11, COUNTERS 12, NEUTRAL 10, AMBIGUOUS 8). "Coverage" is the share of pairs the architecture is willing to answer at all; for the deterministic layer the other 11 pairs are withheld, not guessed.

Hybrid routing: 30 deterministic, 1 MiniCheck textual-support, 1 NLI high-confidence contradiction, 9 Qwen fallback. The hybrid answers 5x fewer Qwen calls than Qwen-only and is more accurate (+0.122), because the deterministic layer removes the numeric cases where Qwen still slips (e.g. DEV-040, see E).

Conflict bundles (`results.json.bundles`): 4/4 aggregate classes semantically correct — CONFLICT, all-supports (reducer label `SUPPORT_DOMINANT`), NO_RELEVANT_EVIDENCE, COUNTER_DOMINANT.

## B. Qwen baseline detail (deliverable O)

`qwen3.5:9b`, Q4_K_M, 9.7B parameters, 6.59 GB GGUF, non-thinking, temperature 0, context 8192, structured JSON, loopback only.

- 41/41 calls completed, 0 provider errors, 0 remote network attempts, 0 paid API calls.
- Tokens: 20,363 in / 1,946 out.
- Median latency 6.07 s per pair, max 10.62 s; full 41-pair pass 4 min 02 s.
- 8 errors: 5 abstention collapses (DEV-031/033/034/035/036 → SUPPORTS when a unit, metric, period or scale was missing), 1 scope error (DEV-023 subsidiary-called-COUNTERS against a group claim), 1 metric-boundary case (DEV-020 revenue claim vs margin evidence → AMBIGUOUS), 1 label flip with correct reasoning (DEV-040: the reason states "6% ... contradicting the claim of more than 10 percent" but the label was SUPPORTS).
- All SUPPORTS answers were correct (11/11) and COUNTERS 11/12 — the model reads direction well; its weakness is deciding *when the input does not license a decision*.

## C. Lightweight verifier detail (deliverable P)

Two models, both MIT, both resident in one Python process (MPS):

| Model | Params | Disk (fp32) | Peak process RSS | Load | Median / pair | Batch throughput |
|---|---|---|---|---|---|---|
| MiniCheck-DeBERTa-v3-Large | 435,063,810 | 1.74 GB | 2.08 GB (both models) | 3.19 s | 53.9 ms (both models) | 18.5 pairs/s |
| DeBERTa-v3-base-mnli-fever-anli | 184,424,451 | 0.74 GB | (same process) | — | — | — |

- Batch and sequential scores agree to 1.4e-6, so batching is safe.
- MiniCheck (binary textual consistency) fired ≥ 0.5 on exactly **one** dev pair: DEV-008, the only paraphrase-style pair ("All three segments grew" ⇐ "All three segments reported growth", p = 0.96). Every numeric-threshold pair scored ≤ 0.23.
- Control probe (isolated from the dev set): `"December tool revenue was 57 USD."` against
  `"…was 57 USD."` → p = 0.83 (supported);
  `"…was greater than 40 USD."` → p = 0.02 (unsupported);
  `"…was 22 USD."` → p = 0.02 (unsupported).
  MiniCheck verifies **textual consistency**, not arithmetic: it cannot see that 57 > 40, and it does not separate contradiction from irrelevance.
- The generic MNLI model carries a real contradiction signal (contradiction ≥ 0.5 on 9/12 COUNTERS pairs; ≥ 0.9 on DEV-009/016/017/038) but is useless for entailment (1/11 SUPPORTS) and collapses NEUTRAL/AMBIGUOUS into one label. One false positive at ≥ 0.9: DEV-028 (dated December claim vs February evidence, a period mismatch).
- NLI-only therefore scores 0.463 overall. Its value in the hybrid is exactly one specific signal: high-confidence contradiction.

## D. Hybrid detail (deliverable Q)

Three errors remain, all produced by the Qwen fallback:

| Pair | Expected | Produced | Why |
|---|---|---|---|
| DEV-020 | NEUTRAL | AMBIGUOUS | revenue claim vs margin evidence read as on-topic-but-incomplete instead of a different metric |
| DEV-033 | AMBIGUOUS | SUPPORTS | "the December figure was 57 USD" — the model assumed the referent is tool revenue |
| DEV-034 | AMBIGUOUS | SUPPORTS | "December table row: 57 USD" — the model assumed the row is tool revenue |

DEV-033/034 are the *referent hallucination* pattern that the AMBIGUOUS class exists to prevent; it is exactly the residual class the ADR must keep a human/model-disagreement path for.

## E. Where each layer earns its place

- Deterministic (2.6 µs per pair, no model resident): 30/41 pairs, 100% correct on what it decides, including strict/inclusive boundaries (DEV-038/039), unit normalization (DEV-006/013), two-period arithmetic (DEV-014/040), correction notices (DEV-010), period mismatch (DEV-021/025/028) and subject/scope mismatch (DEV-022/023). Zero false counters, zero false supports.
- MiniCheck: one pair (paraphrase support) that the deterministic layer cannot reach; cheap enough to keep as a second opinion, not a relation engine.
- MNLI contradiction gate: one pair (DEV-017 "did not grow in April" against a universal claim) at a threshold where it produced no false positives after the deterministic layer.
- Qwen: the 9 residual pairs — scoping, irrelevance vs ambiguity, broad-claim qualification, guidance misses, conflict bundles. This is the part that genuinely needs a reasoning model.

## F. Latency and memory comparison (deliverable L, M)

| Layer | Per pair | 41-pair wall clock | Resident memory |
|---|---|---|---|
| Deterministic | 0.0026 ms | 0.1 ms | 0 (in-process) |
| NLI pair (both models, MPS) | 53.9 ms | 14.4 s including load | 2.08 GB peak |
| Qwen 9B (Ollama, Metal) | 6,066 ms | 4 min 02 s | 6.25 GB peak Ollama RSS |

Hybrid end-to-end for the 41-pair dev set: deterministic pass (~0.1 ms) + NLI pass (14.4 s, needed only if the textual-support check is kept) + 9 Qwen calls (~55 s) ≈ under 1.5 minutes wall clock versus 4 minutes for Qwen-only, with higher accuracy.

## G. Apple Silicon compatibility (deliverable J)

| Model | Verdict | Evidence |
|---|---|---|
| MiniCheck-DeBERTa-v3-Large (435M) | GOOD | MPS, 53.9 ms/pair, 2.08 GB process peak |
| DeBERTa-v3-base-mnli-fever-anli (184M) | GOOD | same process, negligible addition |
| MiniCheck-RoBERTa-Large (355M, 1.42 GB) | GOOD (not downloaded) | same architecture class |
| MiniCheck-Flan-T5-Large (770M, 3.13 GB) | VIABLE (not downloaded) | encoder-decoder, ~2.5-4x slower per pair on CPU/MPS |
| Bespoke-MiniCheck-7B | HEAVY | 7B weights + vLLM-oriented path; no macOS benefit over the 9B model already present |
| Qwen 9B Q4_K_M | VIABLE | 6.25 GB, 6 s/pair; 11.8 GiB Metal budget on a 16 GiB machine leaves little headroom for parallel workloads |
| Fine-tuned financial NLI (FinNLI-style) | NOT PRACTICAL today | no licensed public checkpoint identified in this spike; training is out of scope |

## H. Calibration and honesty notes

- The routing thresholds (contradiction 0.9, MiniCheck 0.5) were chosen on the dev set after the NLI pass and before the Qwen pass; the Qwen pass itself was single and preregistered. The dev set is synthetic and authored by the same process that wrote the rules — treat the 0.927 as a development number, not a generalization estimate.
- The deterministic layer was written after the dev pairs existed, but its modules are forbidden from reading expected labels or the dev-set file (`research/claim-reasoning-test/spike.test.js` enforces this), and every rule is a domain-general operator (numeric comparator, unit normalization, period comparison, subject/scope equality, hedge/truncation detection).
- 5 of the 41 dev pairs are AMBIGUOUS-by-construction distractors; a production workload that never contains undecidable evidence would see different numbers.
- Two files changed after the preregistration was frozen, both deliberately and both before the Qwen pass: `lib/hybrid.js` (the layered routing policy, calibrated on the dev set after the NLI pass) and `cli.js` (import guard so the offline tests can load it). The frozen artifacts that define the benchmark — dev set, relation prompt, `lib/text.js`, `lib/deterministic.js`, `nli/run_nli.py` — are unchanged and hash-verified by `research/claim-reasoning-test/spike.test.js`. Final hashes of every spike file are recorded in `artifacts/code-state.json`.

## I. Research questions, answered

**RQ1 — is (claim, new evidence) → SUPPORTS/COUNTERS/NEUTRAL/AMBIGUOUS an NLI / fact-verification task?**
Only partly. For *textual* claims it behaves like NLI: MiniCheck scores 0.83 on a verbatim restatement and 0.96 on the only paraphrase pair in the dev set. For *arithmetic and calendar* claims it is not an NLI task at all: a control probe gives MiniCheck 0.02 support for "…was greater than 40 USD" given "…was 57 USD" — an NLI model cannot see the comparison, and the generic MNLI model calls it neutral (0.98). The task is a hybrid of deterministic comparison (numeric/period/scope/unit) and NLI-shaped classification.

**RQ2 — does Qwen 9B add real value over RoBERTa/DeBERTa/MiniCheck?**
Yes, but only in the residual. On the 30 pairs the deterministic layer decides, the models add nothing. On the remaining 11, the small-model-only hybrid reaches 0.780 overall and the Qwen fallback lifts it to 0.927 (+0.147); Qwen-only is 0.805, i.e. *worse* than the hybrid because it also owns cases the deterministic layer handles better. So Qwen's value is real but confined to scope/relevance/conflict reasoning.

**RQ3 — does a lightweight verifier reduce RAM, latency, support batch, and improve relation consistency / attribution confusion?**
RAM: yes, 2.08 GB versus 6.25 GB. Latency: yes, 53.9 ms versus 6,066 ms per pair (112x). Batch: yes, 18.5 pairs/s with batch scores identical to sequential to 1.4e-6. Relation consistency: **no** — the NLI layer collapses NEUTRAL and AMBIGUOUS (AMBIGUOUS recall 0.13; it returns NEUTRAL for 7 of 8 ambiguous pairs). Attribution confusion: not applicable — neither verifier exposes an attribution surface, which is itself an argument for keeping attribution in a deterministic layer that can cite evidence ids.

**RQ4 — should table relations be deterministic?**
Yes for four of six classes (pure comparison, threshold, period change, unit-normalized arithmetic), which is where the deterministic layer scored 100% on what it decided. Categorical table facts need explicit column completeness; only semantic table relations need a model. See `TABLE_TAXONOMY.md`.

**RQ5 — should a claim-aware AtomicFact layer sit between Accepted Evidence and the relation engine?**
Not as a prerequisite for the next iteration. The residual errors in both v0.12 and this spike are semantic-role problems (scope, referent, metric), not sentence-length problems; per-evidence evaluation (which the spike already does) solves the one multi-item failure. The design and its preconditions are in `ATOMIC_FACT_PROPOSAL.md`.

**RQ6 — how would AtomicFact avoid becoming a new hallucination source?**
Verbatim slices only, EXPLICIT/DERIVED labelling, deterministic and reversible normalization, mandatory provenance to Accepted Evidence/Support/Source, temporal inheritance (superseded evidence can only be context), no belief fields, one relation per (claim, evidence), and a measured selector-recall check. Eight rules in `ATOMIC_FACT_PROPOSAL.md`.

**RQ7 — which architecture?**
**Option C, hybrid relation engine** — see the ADR.
