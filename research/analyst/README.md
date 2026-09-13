# Research Evidence Analyst v0.5

Proposal authority only. EvidenceProposal ≠ EvidenceCandidate ≠ accepted Evidence ≠ Claim. Analyst receives RetrievalIndex, ProposalStore and a pure provider, never Memory/Admission/Claim state. Formal writes remain explicit human v0.4 Admission.

## CLI

Existing index is required; runtime Proposal SQLite/raw responses stay outside the repository. Defaults: FC_RETRIEVAL_INDEX and FC_RESEARCH_PROPOSALS_DB, or sibling fc-agent directories.

```sh
node research/src/analyst.js analyze-chunk CHUNK_ID --subject coreweave
node research/src/analyst.js analyze coreweave "customer concentration"
node research/src/analyst.js proposals coreweave
node research/src/analyst.js proposal PROP_ID
node research/src/analyst.js promote PROP_ID
node research/src/analyst.js extraction-eval coreweave
```

Default provider is unavailable: no model call, no fake benchmark. `--provider mock-empty` returns []; `--provider mock-file --response-file PATH` consumes a strictly validated scripted JSON response, not an LLM. For explicit pipeline evaluation only:

```sh
node research/src/analyst.js extraction-eval coreweave --provider mock-gold --mode direct_chunk
node research/src/analyst.js extraction-eval coreweave --provider mock-gold --mode retrieval_assisted
```

mock-gold is a gold-replay oracle with expected observations preloaded: its apparent numeric accuracy is not independent extraction performance. Both input modes are evaluated separately. Use --index/--proposals-db for isolated databases; --as-of/--time-mode for analysis/eval; retrieval mode also accepts --limit 1..10. No agent, accept, batch, tool or model-code execution command exists.

## Provider contract and provenance

A trusted host may inject `{metadata:{kind:'real'|'test',provider,model,modelVersion,temperature}, analyzeEvidence(input,{signal})}`. Return a JSON string matching output.schema.json, never markdown/tools. Unknown snapshot is recorded explicitly (e.g. modelVersion='unknown'), not invented. This phase adds no network adapter, dependency or secret discovery and does not run a real provider. Real LLM extraction benchmark unavailable.

Input includes immutable static instructions/JSON Schema/promptVersion/promptHash and separate UNTRUSTED data containing only eligible Source metadata/Chunk text/locators/hashes/asOf. It excludes Claim confidence/thesis/risk/Memory, local raw filenames and API credentials. Provider is trusted application code; this is not a sandbox for an arbitrary malicious adapter. There is no tool API. Timeout is bounded, cancellation requested; an adapter ignoring AbortSignal can continue externally, but late output cannot mutate this pipeline.

## Validation and lifecycle

Generated run → immutable validated/invalid Proposal → explicit converted_to_candidate promotion event → v0.4 human review. Save exact structured raw response/hash and full input snapshot in external SQLite; illegal structured responses produce invalid_output runs and zero Proposals. Oversized responses are discarded without unlimited storage. A [] response saves an abstention run; empty retrieval context is never sent to provider.

Revalidate Source/Chunk/original bytes/locator/subject/public cutoff before input, after response and at promotion. Existing v0.3 parser session caching is scoped to each validation pass and still checks original bytes every time; promotion uses a fresh pass. Deterministic validators require contiguous quote, statement=quote, literal value with unit binding, supported normalization, contextual category/scope and explicit period/date. Derived/unknown units/unknown periods/ambiguous rows/multiple years or amounts do not convert. Guidance remains separate from actuals; future-period guidance is retained invalid under the existing v0.4 period mapping, not silently converted into actual revenue. Negated numeric clauses do not become positive numeric facts. String risk disclosures may be exact quotations, never risk grades. Financial semantic validation is conservative and incomplete, not proof of issuer truth.

Pure normalization reuses v0.1/v0.4 functions without persisting Evidence. Promotion exports a reviewable fact mapping (confidence=0.5 placeholder, not calibrated model certainty). The human must review the mapping/period/unit and can supply a reviewed fact file to existing Admission CLI; promotion never invokes accept. Existing Candidate proposed fields stay null, all Proposal data is in independent lineage.

## Persistence, identity and correction

Independent SQLite schema version 5; immutable proposals/runs/promotions with hashes/triggers. No Memory/Index schema changes. Validated identity binds financial semantics, Source/Chunk hashes, model/prompt/validation policy and temperature, excluding query/time/quote variants. First validated quote/input/output snapshot is retained; later runs link it and retain their own raw responses. Invalid output uses exact support signature so a corrected quote can produce a new valid Proposal. Different model/prompt/validation versions retain independent results; prompt v1 hash is pinned in tests and must not be edited without a new version. Validator hash records implemented policy; changed policy requires regeneration before promotion.

Promotion uses existing RetrievalLayer.createCandidate with temporal visibility/relevance and exact quote. Its internal query adds a deterministic fact hash so distinct facts sharing a quote do not share one Candidate; model-only variants of the same fact still reuse it. Two databases cannot commit atomically: deterministic Candidate identity plus immutable retryable event makes a crash after Candidate creation recoverable on retry. No accepted Evidence can appear from a partial promotion. External files cannot be OS-locked by SQLite; copied inputs and final checks identify reviewed content, subsequent changes fail future promotion/admission. Historical snapshots are never rewritten.

Proposal→Candidate association remains available after rejection/correction. Optional reviewLineage accepts only a supplied readCandidateHistory capability, preserving model/prompt→negative Review lineage without handing Analyst the Admission writer. No training/reranking from rejections. Existing deep provenance remains unchanged; correction still uses v0.2.

## Evaluation

[Gold](../eval/extraction/coreweave-gold.json) preserves 32 reviewed facts and exact Evidence IDs/hash: 19 indexed PDF facts, 16 literal mappings, 13 unindexed release facts and 3 unsupported transformed/boolean mappings. No different Source substitutes for excluded raw bytes.

[Benchmark](../eval/extraction/benchmark.json) records direct/retrieval gold-replay mock metrics and separate negative fixtures. Reference precision/recall/numeric/unit/period accuracy compare generated fields to unchanged Gold. Citation checks and literal-hallucination findings are separate from conservative admissibility. Validated Gold recall is reported and is zero for the full-page mock: all its 16 quotations combine ambiguous context. This demonstrates a limitation, not a passing model extraction benchmark. False-positive rate counts negative chunks yielding any Proposal, even invalid. Null metrics mean no applicable denominator, never zero-quality success. duplicateProposalRate detects distinct stored semantic copies; repeatedOutputRate measures reused emissions across runs. Future leakage inspects actual provider input availability, supplemented by cutoff tests. Real provider/model performance and injection robustness remain unverified.

See [pre-code audit](REPOSITORY_AUDIT.md) and [delivery](../../docs/research-evidence-analyst-v0.5.md). No automatic admission, Claim changes, risk engine, real semantic retrieval, autonomous agent, UI/API/production changes or deployment.
