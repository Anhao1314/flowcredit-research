# Local hybrid retrieval — v0.11

v0.11 keeps the v0.10 local model, prompts, schema, SourceSupport contract, parsers,
Grounded Validator V2, Candidate conversion and Claims exactly as they were, and adds
one thing in front of the selection call: fully local hybrid retrieval that narrows
the verified SourceSpan candidate set of a page to a bounded Top-K. No paid inference
API and no paid embedding API are called (`paidInferenceApiCostUsd = 0`,
`paidEmbeddingApiCostUsd = 0`).

```text
Local retrieval narrows the world.
Local LLM understands the narrowed world.
Deterministic code verifies the result.
Human policy controls what becomes institutional knowledge.
```

## 1. Why v0.10 was context- and throughput-bound

The v0.11 [pre-code audit](../research/local-retrieval/REPOSITORY_AUDIT.md) rebuilt
every locked case's selection prompt and counted tokens with the pinned model's own
tokenizer. The result is unambiguous:

- each case offered the model **29–62 SourceSpans (mean 40.5)** — the whole page, not
  a selection of it;
- the selection prompt was **3,368–6,106 tokens (mean 4,168)**;
- **91% of those tokens were candidate material**: 66.9% rendered span context and
  24.5% the `availableSpanIds` list, which duplicates the `SPAN <id>` line already
  present in every rendered block. Instructions (381), schema (159) and metadata (18)
  together were 558 tokens;
- the three cases that hit the frozen 60 s single-call limit were exactly the three
  with the largest candidate sets and prompts (62 spans, 8,588 characters,
  6,106 tokens), and the next largest case finished at 57.8 s.

The selection call is therefore a prompt-processing problem, not a generation
problem (the frozen run averaged ~108 output tokens per call). Retrieval that reduces
candidate material reduces the dominant cost, and it also bounds how many spans the
model can select — every selected span costs a further interpretation call.

## 2. Local embedding architecture

```text
verified SourceSpans (registry/support)      ← never re-derived, never edited
  → span-retrieval-render/v1                 deterministic retrieval text
  → LocalEmbeddingProvider.embedMany         32 spans per loopback call
  → SpanEmbeddingIndex (immutable, external) content-hash + model + renderer keyed
  ─────────────────────────────────────────
  → SpanRetrievalLayer.retrieve
      filter subject + availableAt ≤ asOf    before ranking
      span-bm25/v1            (v0.3 policy: k1=1.2, b=0.75, coverage 0.6, min score 0.05)
      cosine vs stored vectors (v0.3 floor minSimilarity = 0.3)
      span-rrf/v1             (rrfK = 60, imported from v0.3, not tuned)
  → Top-K                                    K frozen from development evidence
  → unchanged span-selection call
```

Design rules that are enforced in code, not documented intent:

- **Retrieval is not truth.** A retrieval score is never confidence, never Evidence
  strength and never an admission signal. High similarity cannot create a Candidate.
- **Filter first.** Spans of another subject or with `availableAt > asOf` are removed
  before any scoring, and the layer re-asserts both properties on every returned row.
- **No silent degradation.** Semantic and hybrid modes fail loudly without a real
  loopback embedding runtime; there is no lexical-only fallback and no cloud fallback.
- **Versioned, rebuildable index.** Records are keyed by span content hash, renderer
  version, embedding model, model digest and index version; re-indexing an unchanged
  span is idempotent, and a changed span hash leaves the previous vector unreachable
  instead of drifting identity.
- **Answer-free questions.** A question names the subject, the period and the metric
  family; the expected value, its unit and its location are never in it, and a build
  time assertion fails the run if an expected numeric value appears.

The Evidence Analyst gained one optional hook (`retrieve`); with the hook absent the
prompt, the candidate set and every downstream artifact are byte-for-byte what v0.10
produced, which is what makes the in-session control arm a valid control.

## 3. Model choice

| fact | value |
| --- | --- |
| runtime | Ollama 0.34.0, loopback `http://127.0.0.1:11434` |
| embedding model | `nomic-embed-text` |
| digest | `0a109f422b47e3a30ba2b10eca18548e944e8a23073ee3f3e947efcf3c45e59f` |
| parameters / quantization | 137M / F16 |
| embedding length | 768 |
| disk size | 274,302,450 bytes |
| chat model (unchanged) | `qwen3.5:9b`, Q4_K_M, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |

Selection principle: small enough to stay resident on a 16 GiB unified-memory machine
next to a 9.7B chat model, adequate for English financial text and structured table
captions, and fast enough that a per-page query adds milliseconds rather than seconds.
Residency measurements are in §11.

## 4. Lexical baseline

Span-level BM25 with the audited v0.3 policy, on three sets:

- **v0.3 dev topics (21, literal queries)**: R@1 0.947, R@3 1.000, R@10 1.000, MRR 0.974
- **v0.3 dev topics, answer-free variant**: R@1 0.474, R@3 0.737, R@5 0.842,
  R@10 0.842, MRR 0.603
- **locked 16 questions**: R@1 0.000, R@3 0.063, R@10 0.063, MRR 0.021

The v0.3 topics contain their literal (`FY2025 revenue 5,131`), so BM25 is excellent
there. Remove the literal — which is what an actual research question looks like —
and BM25 alone collapses: the question shares vocabulary with the metric family, not
with the row/cell text, and the 0.6 coverage floor then drops the right span. That is
the honest lexical baseline, and it is the reason this phase needed embeddings.

## 5. Semantic benchmark

Local `nomic-embed-text` retrieval over span renderings, cosine with the v0.3 floor:

- **v0.3 dev topics (literal)**: R@1 0.579, R@3 0.947, R@10 1.000, MRR 0.754
- **v0.3 dev topics (answer-free)**: R@1 0.421, R@3 0.632, R@5 0.842, R@8 1.000,
  R@10 1.000, MRR 0.588
- **locked 16 questions**: R@1 0.062, R@3 0.375, R@5 0.500, R@8 0.938, R@10 0.938,
  MRR 0.305

The semantic arm is what makes answer-free questions retrievable at all: it reaches
15/16 on the locked questions at K = 8. Its weakness is precision at the very top —
short questions against a page of similar rows rarely pick the exact row first — which
is exactly why the Top-K goes to a model that reads the candidates rather than to a
threshold that pretends the first hit is the answer.

## 6. Hybrid benchmark

Reciprocal rank fusion (rrfK = 60) of the two arms:

- **v0.3 dev topics (literal)**: R@1 0.895, R@3 1.000, R@5 1.000, R@10 1.000, MRR 0.947
- **v0.3 dev topics (answer-free)**: R@1 0.474, R@3 0.842, R@5 0.947, R@8 1.000,
  R@10 1.000, MRR 0.662
- **locked 16 questions**: R@1 0.062, R@3 0.438, R@5 0.500, R@8 0.938, R@10 0.938,
  R@20 1.000, MRR 0.313

Fusion recovers the lexical precision when literals are present (R@1 0.895 vs 0.579)
and the semantic recall when they are not (dev answer-free R@3 0.842 vs 0.632, locked
R@8 0.938 vs 0.063). The fusion constant was taken from v0.3 and never adjusted
against locked Gold.

Top-K sweep (dev sets only, hybrid):

| K | v0.3 dev (literal) | v0.3 dev (answer-free) |
| --- | --- | --- |
| 3 | 1.000 | 0.842 |
| 5 | 1.000 | 0.947 |
| 8 | 1.000 | 1.000 |
| 10 | 1.000 | 1.000 |
| 20 | 1.000 | 1.000 |

## 7. Negative queries and abstention

Six negatives were generated deterministically: for locked pages, the same metric
family asked for a period that does not exist in the corpus, each one proven absent
with the same Gold annotator the positives use.

- BM25 abstains on all six (the coverage floor rejects them).
- Semantic and hybrid retrieval do not abstain: the v0.3 similarity floor (0.3) is
  calibrated for chunks and short financial spans sit well above it (top-1 cosine for
  negatives: median 0.706).
- A similarity-floor sensitivity analysis is reported in the artifact; no threshold
  in the tested range separates negatives from positives without destroying positive
  recall, and nothing was tuned on the locked set.

Abstention therefore stays where v0.10 put it: in the deterministic validator. A span
that does not support the asked fact cannot become a validated proposal, so a
retrieval miss produces a named `RETRIEVAL_MISS`, never fabricated Evidence. When
retrieval removes every candidate (for example all candidates are invisible for the
case's `asOf`), the analyst abstains **before** the model call and records
`RETRIEVAL_ABSTAINED`.

## 8. Temporal filtering and subject isolation

`filterVisibleSupports` runs before any scoring: a span whose `subjectId` differs from
the research subject is dropped, as is a span whose `availableAt` is after the case's
`asOf` in replay or audit mode. The returned rows are re-checked against the same
rules and the layer throws rather than returning a row it cannot justify
(`WRONG_SUBJECT_RETRIEVAL`, `FUTURE_LEAKAGE_RETRIEVAL`). Per-case counts of filtered
rows are recorded in every retrieval receipt, so the locked run reports
`wrongSubject = 0` and `futureLeakage = 0` as measurements, not as assertions.

## 9. Candidate reduction, token reduction, timeout reduction

Candidate set (all 16 locked cases; control = whole page, retrieval = frozen Top-8):

| metric | control | retrieval | change |
| --- | --- | --- | --- |
| spans offered to the model, median | 33 | 8 | −75.8% |
| spans offered to the model, p95 | 62 | 8 | −87.1% |
| spans offered to the model, total | 648 | 128 | −80.2% |
| selection-call timeouts (frozen 60 s limit) | 3 | 0 | −3 |

The candidate set is bounded by construction: after the subject/`asOf` filter and
fusion, the ranking is truncated to the frozen K and nothing else reaches the prompt.
Measured `efficiency.candidateReductionMedian = 0.7576` (gate: ≥ 0.5).

Input tokens are compared on the 13 cases that produced usage in **both** arms, so the
number is not contaminated by the control arm's three calls that were cancelled at the
frozen 60 s limit and therefore report no usage:

| metric | control | retrieval | change |
| --- | --- | --- | --- |
| prompt tokens, total (13 matched cases) | 169,462 | 77,608 | −54.2% |
| prompt tokens, median | 12,772 | 7,737 | −39.4% |
| prompt tokens, p95 | 25,465 | 8,750 | −65.6% |

Measured `efficiency.tokenReductionTotal = 0.5420` (gate: ≥ 0.4). Arm totals over every
case an arm actually completed — control 169,462 tokens over 13 calls, retrieval 96,512
tokens over 16 calls — are recorded in the artifact but are not the headline number,
because the control arm's three timeouts left no usage behind to compare against.

Those three timeouts are a direct consequence of the largest candidate sets: each
cancelled control call had been offered the corpus maximum of 62 spans. The retrieval
arm offers at most 8 and finished every call, so `efficiency.timeouts = 0` with the
60 s limit unchanged.

Selection and end-to-end latency follow:

| metric | control | retrieval | change |
| --- | --- | --- | --- |
| selection call, median | 34.5 s | 18.3 s | −47% |
| selection call, p95 | 60.0 s | 32.7 s | −45% |
| end-to-end per case, median | 106.8 s | 69.9 s | −35% |
| end-to-end per case, p95 | 220.2 s | 91.4 s | −59% |

Retrieval itself is not a cost worth claiming: 33 ms median per query (32.99 ms
embedding, 0.23 ms lexical), 229 ms p95, against a one-time index build of 63.9 s for
7,687 spans.

## 10. End-to-end impact

Same model, same prompts, same schema, same SourceSpans, same SourceSupport contract,
same Grounded Validator V2, same Candidate conversion. The in-session control arm is
the v0.10 configuration; the only difference is whether the selection call received
the whole page or the frozen Top-8.

| metric | control (v0.10 configuration) | retrieval (v0.11) |
| --- | --- | --- |
| target selection | 12/16 (0.750) | 12/16 (0.750) |
| candidate conversion | 11/16 (0.688) | 11/16 (0.688) |
| full chain | 6/16 (0.375) | 6/16 (0.375) |
| table selection | 12/16 (0.750) | 11/12 (0.917) |
| text selection | 3/4 (0.750) | 1/4 (0.250) |
| numeric accuracy | 10/12 (0.833) | 11/12 (0.917) |
| unit accuracy | 10/12 (0.833) | 11/12 (0.917) |
| period accuracy | 12/12 | 12/12 |
| fabricated support | 0 | 1 |
| validator false accepts | 0 | 0 |
| validator false rejects | 2 | 4 |
| retrieval recall@8 | — | 15/16 (0.938) |

Read honestly:

- **Capability neither improved nor degraded at this sample size.** Target selection and
  candidate conversion are identical, so narrowing the world did not cost the model its
  targets. The sub-split movements (table up, text down) sit on 12-case and 4-case
  denominators and are reported as observed, not as effects.
- **The safety gate fails on one case.** GOLD-08's selection response repeated
  near-identical ids and duplicated one character
  (`SPAN-e01cd2a68842fefdfdfdf652ce`) where the offered id is
  `SPAN-e01cd2a68842fefdfdf652ce`. The offered list — and the retrieval receipt that
  produced it — contains the correct id, so this is a model transcription error on a
  visible candidate, not retrieval leakage: `parseSelection` raised
  `INVALID_SPAN_REFERENCE`, the case is reported as `FABRICATED_SPAN`, and
  `safety.fabricatedSupport` moves 0 → 1 against a 0-tolerance gate. The same code
  produced no such error on the same case in a second run, so the defect is intermittent
  rather than a property of the narrowed candidate set.
- **Retrieval removes the failure mode that dominated v0.10.** The three
  `PROVIDER_TIMEOUT` cancellations are gone, and the injection cases now abstain before
  the model is called at all: both report `RETRIEVAL_ABSTAINED` with 0 fabricated spans
  and 0 promotions, while the control arm still generated one validated (non-injected)
  proposal on INJECTION-02.
- **Nothing else moved.** `futureLeakage = 0`, `wrongSubject = 0`,
  `validatorFalseAccepts = 0`, forbidden judgment findings 0, and Claims are unchanged
  at 4 claims / 4 revisions with the same payload hash `sha256:893ea5e7…`.

Gate outcome: 11 of 12 frozen checks pass — every retrieval, efficiency, timeout and
capability item among them — and `safety.fabricatedSupport` fails at 1 against an
expected 0. With the gate frozen before the run and no item softened afterwards, the
decision for this phase is **`STAY ON RETRIEVAL`**. Retrieval is measurably worth
keeping (recall 0.938, candidates −75.8%, tokens −54.2%, timeouts −3, selection latency
−47%), but the evidence does not support declaring it ready while a single
non-deterministic transcription typo can turn a clean run red.

## 11. Memory and hardware

Measured on the machine the run was taken on, with both models resident at once:

| fact | value |
| --- | --- |
| CPU | Apple M5, 10 cores |
| memory | 16 GiB unified (17,179,869,184 bytes) |
| chat model resident | `qwen3.5:9b` Q4_K_M, 6,594,474,711 bytes on disk |
| embedding model resident | `nomic-embed-text` F16, 274,302,450 bytes on disk |
| Ollama runtime RSS, peak | 1.30 GB |
| swap in use, first / peak / last | 14.55 / 14.79 / 14.45 GiB |
| swap change across the session | −0.09 GiB |
| resource samples | 503 |

Both models do stay resident together: the embedding model is deliberately the smallest
one that worked (137M parameters), and the index is built in 241 batches of 32 spans
(63.9 s, 8.31 ms per span, 239,054 prompt-eval tokens) rather than span by span, so the
machine never holds a second working copy of either model. Swap was already heavily in
use before the run began and oscillated around 14.5 GiB rather than growing, so the
pressure visible here is a property of the machine's prior state, not of this phase.

Measurement hygiene, recorded because it once changed a conclusion: the 60 s
single-call limit is an in-process wall-clock timer, and macOS suspends wall-clock
timers while the machine sleeps. A run interrupted by system sleep can therefore record
timeouts that measure the laptop rather than the model. Every latency and timeout number
in these artifacts comes from a run taken with sleep inhibited.

## 12. Privacy

Every inference in this phase is local: the chat model and the embedding model both
run through the loopback Ollama runtime on this machine. The embedding adapter reuses
the v0.10 transport guard, which rejects any non-loopback endpoint before a socket is
opened, and the offline test installs a global fetch guard and proves both the
retrieval loop and the analyst loop keep working while a remote call is refused.
Research text is never sent to a cloud LLM, a cloud embedding provider or a cloud
reranker.

## 13. Cost

Local inference and local embedding have no API price:

```text
paidInferenceApiCostUsd = 0
paidEmbeddingApiCostUsd = 0
```

Hardware, electricity, disk and elapsed wall-clock time are not zero and are reported
separately in `research/eval/local-retrieval/runtime-costs.json`.

## 14. Limitations

- The embedding floor cannot separate "related but wrong" financial spans from
  supporting ones; abstention is a deterministic validation outcome, not a retrieval
  score.
- Recall on answer-free questions is a Top-K property: R@1 is low (0.062 on the locked
  set) because many rows on a page are near-misses. The design depends on the model
  reading K candidates, not on the first hit.
- One locked case (GOLD-11) does not reach the Top-8; it is reported as a retrieval
  miss rather than hidden in model-error statistics.
- The index is per-corpus and rebuildable; a changed span invalidates its vector, so
  the first run after a corpus change pays the build cost.
- Only sentence and table spans are retrievable. Any future span type must be added to
  `render.js` and to the index identity before it can be retrieved.

## 15. Reproduction

```bash
cd research
node local-retrieval/cli.js preflight --opt-in            # runtime + model facts
node local-retrieval/cli.js index --opt-in                # build/reuse the span index
node local-retrieval/cli.js benchmark --opt-in --set all  # BM25 / semantic / hybrid + sweep
node local-retrieval/cli.js locked --opt-in               # control arm vs hybrid arm
node --test local-retrieval-test/*.test.js                # offline, no runtime needed
```

Artifacts: `research/eval/local-retrieval/{index-build,retrieval-benchmark,phase-gate,results,comparison,runtime-costs,hardware}.json`;
raw run data stays outside the repository under `~/fc-agent/research-local-retrieval/`.
