# Research Retrieval Layer v0.3

Search verified primary-source document passages, validate Candidate citations and STOP. Retrieved Chunk is not Evidence; Candidate Evidence is not accepted Evidence; accepted Evidence is not Claim. No retrieval code can mutate accepted Memory.

## Setup and commands

Use Node 22.19/24 and the existing locked agent Ajv dependencies. Install the isolated PDF text-layer dependency outside the repository:

```sh
python3 -m venv /Users/yimingyang/fc-agent/tools/retrieval-python
/Users/yimingyang/fc-agent/tools/retrieval-python/bin/pip install -r research/retrieval/requirements.txt
node research/src/retrieval.js index coreweave
node research/src/retrieval.js search coreweave "customer concentration" --mode lexical
node research/src/retrieval.js search coreweave "customer concentration" --mode hybrid --time-mode replay --as-of 2026-06-30
node research/src/retrieval.js candidate CHUNK_ID --query "customer concentration" --subject coreweave --mode lexical --time-mode replay --as-of 2026-09-13
node research/src/retrieval.js eval coreweave
node --test research/retrieval-test/*.test.js
```

All output is JSON. Commands work from another working directory. `--index PATH` / `FC_RETRIEVAL_INDEX` selects the external SQLite index; default repository-sibling `fc-agent/research-retrieval/index.sqlite`. `--raw-dir PATH` / `FC_RETRIEVAL_RAW` selects the raw corpus directory. `FC_RETRIEVAL_PYTHON` selects the Python interpreter (CI uses its pinned dependency). Raw files, databases and packages must stay outside the repository. Querying a missing index fails. No crawler/network call exists in the CLI. Download the official annual.pdf and q2.pdf URLs in the existing Source manifest explicitly; content hashes must match. Release remains excluded because original byte downloads returned 403; do not put summaries in release.html.

`search --memory-db PATH` adds a separate **Audit** lookup of existing accepted Evidence, Sources/corrections and Claims, using read-only SQLite access. It never constructs a writable Memory object. Replay never synthesizes or backdates accepted Memory.

## Architecture and contracts

Source → parsed Document → stable Chunk → independent index → lexical/semantic retrieval → RRF → EvidenceCandidate → citation validation → STOP.

Draft 2020-12 contracts are in `schema.json`. Document carries existing immutable Source, byte hash, parser version, text hash, units and scoped availability. Chunk includes Source/Document/subject, exact text, page/section, raw locator, parsed UTF-16 char offsets, chunk hash and temporal/version metadata. Candidate has query/context, quote, locator and method/rank; no score-as-confidence or extracted numeric proposal. Separate `objects` table kinds document/chunk/embedding/candidate and foreign keys prevent reuse of formal Evidence. SQLite schema version 3 applies only to this index; v0.2 Memory version 2 is untouched. Per-document indexing is atomic and idempotent; first recorded retrieval/index times survive reindex. Conflicting content/availability rejects; no replacement/migration workflow is introduced.

## Parsing and chunking

PDF: pinned PyMuPDF 1.26.5, `get_text('blocks', sort=True)`, text blocks only. Preserve block text/numbers, one-based page and page rectangle. Version `pdf-blocks-pymupdf-1.26.5/v1`. HTML: small faithful tokenizer/entity decoder, raw markup ranges, headings and table cell/row separators; version `html-addressable/v1`. No OCR/LLM/summarization. Unsupported, encrypted, empty or textless files fail.

PDF reading order/table reconstruction is not guaranteed for every layout. Page rectangles are coarse raw locators; char offsets are in parsed text, not compressed PDF bytes. HTML is static extraction, not browser DOM/CSS execution and not a complete HTML5 parser; unrecognized entities are retained. Both real financial tables were rendered and checked. No numeric interpretation, automatic units or period inference occurs.

Chunker `page-section-lines/v1`: max 6,000 UTF-16 code units, overlap ≤400 within a unit, prefer line boundaries, never cross page/HTML unit boundary, avoid surrogate splitting. Financial table pages usually fit intact; unusually long tables may split and require review. Chunk IDs depend on Source ID, original hash, parser/chunker versions, location/offset and text hash. Section metadata preserves found headings or explicit page context; it is not generated narrative.

## Retrieval and abstention

Dependency-free BM25 `bm25/v1`: k1=1.2, b=0.75, IDF log(1+(N-df+0.5)/(df+0.5)), frequency/length normalization. Unicode word tokens, fixed English stopwords, no stemming or synonym injection. Before scoring, subject and temporal filters restrict the corpus, including document-frequency statistics. Scores are relevance, never confidence. Deterministic abstention requires ≥60% distinct non-stopword query coverage and BM25 ≥0.05; empty/all-stopword queries return insufficient_evidence. This heuristic is not proof that no fact exists; lexical matches may still be irrelevant and never establish facts.

Semantic interface: synchronous `embed(text)` plus provider/model/dimension/embeddingVersion/kind metadata; dimension/finite values and chunk hashes checked. Versioned cached embeddings are separate objects. Cosine similarity must be ≥0.30 (deterministic abstention). The only included provider is **deterministic-fixture / concept-bag / 12 / test/v1**, explicitly test-only, not a trained semantic model. No real model/API credential is configured; CLI semantic returns unavailable and hybrid reports lexical_only degradation. No fake real embedding benchmark. A real provider can be supplied programmatically after independent validation; no external service is invoked here.

RRF k=60: score(chunk)=Σ 1/(60+rank_method), missing ranks contribute zero. Stable chunk-ID tie-break. Output lexicalRank/semanticRank/hybridScore/finalRank. No cross encoder, LLM or complex reranker.

## Audit / Replay

DocumentDate remains existing descriptive publication/signature date, not market availability. Research-only scoped availableAt is a separate sidecar; accepted Source schemas and immutable payloads remain unchanged.

Audit: retrievedAt and indexing createdAt ≤ asOf. Replay: known availableAt ≤ asOf. Unknown excludes Replay. Date-only is end of UTC day; datetimes exact. Annual filing accepted March 2 at 16:14:01 **EST** →21:14:01Z; Q2 August 11 at 19:24:42 **EDT** →23:24:42Z. `corpus.json` links SEC index evidence. Annual pages 1–6 are omitted because wrapper publication is unknown; pages 7 onward reproduce filing content. Q2 availability refers to accepted filing content, not first availability of its IR PDF URL. Replay is readonly public-information reconstruction, not a claim of historical system knowledge.

## Citation and evaluation

Validate Candidate schema/identity, Chunk/Source existence, subject/source equality, exact quote inclusion, locator, hashes, recreated chunks, original raw-byte hash and re-parsed original document units/text. Reparse caches by verified original hash within the session; raw bytes are still checked every validation. Invalid candidates never persist. Valid citation proves text/location integrity, not financial truth or Evidence acceptance.

21 fixed CoreWeave eval queries (19 positives/2 negatives), with reviewed Source/page/text and existing Evidence IDs where applicable. Ground truth fixed before benchmark; wrong provisional page references corrected by direct document inspection before running the benchmark, never in response to scores. Recall@K is per-query expected-location hit rate among positives; MRR uses complete eligible rankings (288 chunks, cap 1,000); safety/citation metrics use returned top five. Negatives reported separately. `benchmark.json` records actual outputs and failures. Lexical: R@1=.4211, R@3=.8421, R@5=.8421, MRR=.6128. Semantic unavailable; degraded hybrid identical. Citation 100%, future leakage 0, wrong subject 0; two negatives abstain. The benchmark has no before-publication negative query; dedicated future/unknown/candidate tests and the real two-date demo validate cutoff behavior separately. Do not infer broad retrieval quality or semantic superiority from this small corpus.

See [pre-code audit](REPOSITORY_AUDIT.md) and [delivery record](../../docs/research-retrieval-layer-v0.3.md).
