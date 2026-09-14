# Local hybrid retrieval (v0.11)

Narrows the SourceSupport candidate set of one (document, page) with fully local
retrieval before the Evidence Analyst's selection call. It changes nothing about the
frozen contract: the model still selects span ids, SourceSupport is still built only
from verified spans, Grounded Validator V2 still decides what becomes a proposal, and
Candidate conversion and Claims are untouched.

```text
verified SourceSupports of the page
  → subject + temporal filter        (before ranking, never after)
  → BM25 over span text              (v0.3 policy, reused verbatim)
  → local embeddings + cosine        (loopback Ollama, stored vectors)
  → reciprocal rank fusion           (rrfK=60, imported from v0.3)
  → Top-K                            (K frozen from development evidence)
  → unchanged span-selection call
```

## Files

| file | role |
| --- | --- |
| `render.js` | versioned deterministic retrieval rendering of a SourceSupport (`span-retrieval-render/v1`) |
| `provider.js` | `LocalEmbeddingProvider` over the loopback Ollama `/api/embed` endpoint, batched, timeout-bounded, no cloud fallback |
| `index.js` | `SpanEmbeddingIndex`: immutable, rebuildable sqlite store of span vectors with provenance |
| `lexical.js` | `span-bm25/v1` over SourceSupports, importing the audited v0.3 tokenizer and policy |
| `search.js` | `rankSpansSemantic` (cosine, `minSimilarity` 0.3) and `fuseSpanRankings` (RRF) |
| `layer.js` | `SpanRetrievalLayer.retrieve`: filter → rank → Top-K with a deterministic receipt |
| `queries.js` | answer-free research questions, the v0.3 dev queries at span level, proven-absent negatives |
| `eval.js` | Recall@K / MRR, candidate and token reduction, failure decomposition, gate evaluation |
| `cli.js` | `preflight`, `index`, `benchmark`, `locked` |
| `REPOSITORY_AUDIT.md` | the pre-code audit that justified this design |

## Discipline

- **Retrieval is not truth.** A retrieval score is never confidence, never Evidence
  strength and never an admission signal. High similarity cannot create a Candidate.
- **Filter first, rank second.** `availableAt > asOf` spans and spans of another
  subject never enter the candidate set, so they can never reach the prompt.
- **Versioned embeddings.** A record is keyed by span content hash, renderer version,
  embedding model, model digest and index version. Re-indexing an unchanged span is
  idempotent; a changed span hash leaves the old vector unreachable instead of drifting.
- **No silent degradation.** Semantic and hybrid modes fail loudly when no real
  embedding runtime is configured; they never fall back to lexical-only or to a test
  provider, and never to a remote API.
- **Answer-free queries.** A question names the subject, the period and the metric
  family. The expected value, its unit and its location are excluded and asserted
  against the Gold expectation at build time.
- **Retrieval misses are named.** A case whose expected span never enters the Top-K is
  reported as `RETRIEVAL_MISS`, never folded into model error.

## Usage

```bash
cd research
node local-retrieval/cli.js preflight  --opt-in
node local-retrieval/cli.js index      --opt-in                 # build the reusable span index
node local-retrieval/cli.js benchmark  --opt-in --set all       # BM25 / semantic / hybrid + Top-K sweep
node local-retrieval/cli.js locked     --opt-in                 # locked 16, control arm vs hybrid arm
```

Every mode requires explicit opt-in (`--opt-in` or `FC_LOCAL_RETRIEVAL_OPT_IN=1`),
talks only to the loopback runtime and writes raw run data outside the repository
(`FC_LOCAL_RESULTS`, default `~/fc-agent/research-local-retrieval`). Sanitized
artifacts are written to `research/eval/local-retrieval/`.

Environment: `FC_LOCAL_ENDPOINT` (default `http://127.0.0.1:11434`),
`FC_EMBEDDING_MODEL` (default `nomic-embed-text`), `FC_EMBEDDING_DIM`, `FC_SPAN_INDEX`,
`FC_RETRIEVAL_INDEX`, `FC_GROUNDING_PYTHON`.

## Offline tests

`node --test research/local-retrieval-test/*.test.js` runs without Ollama, weights,
GPU or network: the loopback runtime is replaced by an in-process HTTP stand-in over
the real transports, and the real analyst, SourceSupport, validator and Candidate
conversion run unchanged.
