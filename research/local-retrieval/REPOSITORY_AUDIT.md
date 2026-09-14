# Pre-code audit — local hybrid retrieval (v0.11)

This audit answers the five questions the task book asks before any code is written.
Everything below is measured on the frozen v0.10 artifacts, the frozen v0.9 Gold
fixtures and the pinned local runtime; nothing here is estimated from prose.

## 0.1 Method

The frozen v0.10 run (`benchmark.raw.json`) stores aggregate usage only (142 calls,
166,630 input tokens), so per-case context was reconstructed deterministically:

- the same grounding build the run used (`groundingVersion source-span-registry/v1`,
  parser `pdf-layout-spans-pymupdf-1.26.5/v1`),
- the same sentence and table indexes (`sentence-segmentation/v1`, `source-support/v1`),
- the same candidate construction the analyst uses (`supportCandidates` for the
  case's document and page),
- the same selection prompt (`span-selection/v2` instructions, `selection-output.schema.json`,
  `renderSupport` blocks).

Token counts are exact rather than estimated: each reconstructed prompt was sent to
the pinned model (`qwen3.5:9b`, digest `sha256:6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`,
`num_predict: 1`) and read back through `prompt_eval_count`. The reconstruction
differs from the frozen run only in the `generatedAt` field, whose serialized length
is constant, so the counts match the frozen run's call population.

## 0.2 Question 1 — how many SourceSpans does one case expose to the model?

Every case exposes **the entire page**: all sentence spans plus all non-placeholder
table cells of that page. Across the locked 16 that is **29–62 spans per case,
mean 40.5, 648 spans in total**.

| case | page | candidates | text | table | page chars | prompt tokens | v0.10 selection |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GOLD-01 | 140 | 43 | 34 | 9 | 6,972 | 4,295 | 25.5 s |
| GOLD-02 | 93 | 32 | 8 | 24 | 5,251 | 3,618 | 32.9 s |
| GOLD-03 | 93 | 32 | 8 | 24 | 5,251 | 3,618 | 35.2 s |
| GOLD-04 | 46 | **62** | 29 | 33 | **8,588** | **6,106** | **timeout 60 s** |
| GOLD-05 | 18 | 33 | 26 | 7 | 4,750 | 3,375 | 34.6 s |
| GOLD-06 | 52 | 34 | 34 | 0 | 5,543 | 3,368 | 12.1 s |
| GOLD-07 | 46 | **62** | 29 | 33 | **8,588** | **6,106** | **timeout 60 s** |
| GOLD-08 | 77 | 52 | 19 | 33 | 7,714 | 5,242 | 57.8 s |
| GOLD-09 | 140 | 43 | 34 | 9 | 6,972 | 4,295 | 31.3 s |
| GOLD-10 | 26 | 29 | 29 | 0 | 6,897 | 3,445 | 17.3 s |
| GOLD-11 | 18 | 33 | 26 | 7 | 4,750 | 3,375 | 35.6 s |
| GOLD-12 | 46 | **62** | 29 | 33 | **8,588** | **6,106** | **timeout 60 s** |
| GOLD-13 | 18 | 33 | 26 | 7 | 4,750 | 3,375 | 39.2 s |
| GOLD-14 | 18 | 33 | 26 | 7 | 4,750 | 3,375 | 39.0 s |
| GOLD-15 | 18 | 33 | 26 | 7 | 4,750 | 3,375 | 38.1 s |
| GOLD-16 | 93 | 32 | 8 | 24 | 5,251 | 3,618 | 57.6 s |

## 0.3 Question 2 — where do the input tokens go?

Measured incrementally on the reconstructed GOLD-04 prompt (the largest case,
6,106 tokens):

| component | tokens | share |
| --- | --- | --- |
| rendered SourceSupport context (`SPAN/TEXT` or `SPAN/TABLE/ROW/COLUMN/VALUE/UNIT CONTEXT`) | 4,087 | 66.9% |
| `availableSpanIds` list | 1,495 | 24.5% |
| selection instructions (`span-selection/v2`) | 381 | 6.2% |
| output schema (`selection-output.schema.json`) | 159 | 2.6% |
| envelope and metadata (`subjectId`, `asOf`, `timeMode`, `document`, `page`) | 18 | 0.3% |

Two observations drive v0.11:

1. **91% of the prompt is candidate material.** Instructions, schema and metadata
   together are 558 tokens; spans and their id list are 5,582.
2. **The id list is redundant**: every rendered block already starts with `SPAN <id>`,
   and the list alone is 1,495 tokens (24.5%) of the prompt.

A response to a selection call is small (the frozen run averages ~108 output tokens
per call), so the cost is context, not generation length: per-case prompts run
3,368–6,106 tokens (mean 4,168; 66,692 tokens across the 16 selection calls alone).

## 0.4 Question 3 — did the timeout cases carry larger context?

Yes, unambiguously. The three cases that hit the frozen 60 s single-call limit
(`PROVIDER_TIMEOUT`: GOLD-04, GOLD-07, GOLD-12) are exactly the three cases with the
**largest candidate set (62 spans) and the largest prompt (8,588 page chars,
6,106 tokens)**, and GOLD-08 — the next largest context (52 spans, 5,242 tokens) —
finished at 57.8 s, just under the limit. Selection latency and context size move
together (Pearson r = 0.48 over the censored 16, with three samples pinned at 60 s).

End-to-end case latency is dominated by the interpretation calls that follow
(median 110.5 s, p95 238.7 s in v0.10): a case that selects 9 spans pays nine
interpretation calls. Narrowing the candidate set therefore bounds both the
selection prompt and the number of spans the model can select.

## 0.5 Question 4 — can v0.3 BM25 search v0.8/v0.9 SourceSpans directly?

Partially, and not without adaptation.

- `searchLexical` is already a pure function over rows carrying `id`/`text`, so the
  scoring formula, tokenizer and policy (`bm25/v1`, k1=1.2, b=0.75,
  `minQueryCoverage` 0.6, `minScore` 0.05) can be reused verbatim.
- Everything around it is chunk-shaped: `RetrievalLayer.search` builds its row list
  from `index.list('chunk')`, filters by chunk `subjectId`/temporal columns, keys
  results by `chunkId`, and `fuse` reads `row.chunkId`. SourceSupports are not
  chunks: they have `spanId`, `supportHash`, `type` (`text`/`table`) and a
  deterministic rendered form.
- The policy is also calibrated for chunks, and that matters. Feeding the answer-free
  research questions of the locked 16 to span-level BM25 with the v0.3 policy gives
  **Recall@10 = 0.063** (1/16): the question names a metric family
  (`us geographic revenue concentration`) while a table span renders
  (`ROW: United States`, `COLUMN: Year Ended December 31, 2025`, `VALUE: $ 4,801`),
  so 2 of 5 query terms match and the 0.6 coverage floor drops the span.

Conclusion: reuse the v0.3 lexical policy and formula unchanged, adapt the retrieval
unit to SourceSupports, and do not expect lexical retrieval alone to carry
answer-free research questions.

## 0.6 Question 5 — does the semantic provider abstraction accept a local embedding runtime?

Not as written. `validateProvider` (v0.3 `semantic.js`) requires `provider.embed(text)`
and `vector()` throws `Synchronous embedding provider required` when the result is a
promise; an HTTP loopback runtime (`POST /api/embed`) can never satisfy a synchronous
interface. `indexEmbeddings` shares that constraint.

What can be reused without breakage is the *ranking* contract, not the call shape:

- embeddings stay keyed by content hash and are refused when the hash moves,
- ranking stays a pure cosine with the audited `minSimilarity` 0.3 floor,
- the only change is *when* vectors are produced: an async batch step
  (`embedMany`, 32 inputs per call) at index build time, over a loopback-only
  transport that reuses the v0.10 `requestJson` guard (remote hosts rejected before a
  socket is opened, no silent cloud fallback).

v0.11 therefore adds a `LocalEmbeddingProvider` with an async `embedMany` interface
and keeps the v0.3 similarity/ranking semantics for search.

## 0.7 Consequences for the design

Frozen and untouched: model and runtime (qwen3.5:9b Q4_K_M, non-thinking, temperature 0,
`num_ctx` 8192), the 60 s single-call limit, `span-selection/v2` and
`fact-interpretation-span/v2`, the SourceSupport contract, the numeric/unit/period
parsers, Grounded Validator V2, Candidate conversion, Claims and the retrieval
narrowing is the only new variable.

Added: a span-level hybrid retrieval layer (BM25 + local embeddings + RRF) that ranks
the already verified SourceSupports of the page, filters subject and temporal
visibility **before** ranking, and returns a bounded Top-K to the unchanged selection
call. The intended architecture is unchanged:

```text
Local retrieval narrows the world.
Local LLM understands the narrowed world.
Deterministic code verifies the result.
Human policy controls what becomes institutional knowledge.
```
