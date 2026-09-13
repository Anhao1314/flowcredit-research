# Evidence Admission Layer v0.4

Explicit immutable Review → accepted formal v0.1 Evidence or rejected negative research history. Citation integrity is not admissibility. Retrieved Chunk ≠ Candidate ≠ accepted Evidence ≠ Claim. Admission imports no Claim builder/writer, risk engine or model harness.

## CLI

Use existing external v0.3 index and v0.2 Memory databases; seed each explicitly. No admission happens during indexing/search/eval.

```sh
node research/src/admission.js candidates coreweave
node research/src/admission.js candidate CANDIDATE_ID
node research/src/admission.js accept CANDIDATE_ID --subject coreweave --candidate-hash sha256:HASH --reviewer human --reviewer-id LOCAL_ID --reason verified_primary_source --note "Reviewed exact primary passage"
node research/src/admission.js reject CANDIDATE_ID --subject coreweave --candidate-hash sha256:HASH --reviewer human --reviewer-id LOCAL_ID --reason wrong_period --note "Passage describes another period"
node research/src/admission.js review-history CANDIDATE_ID
node research/src/admission.js deep-provenance EVID_ID
node research/src/admission.js stats coreweave
```

Every command accepts `--index PATH --db PATH`; environment/defaults match Retrieval and Memory. Missing databases/unknown/duplicate options fail. CLI requires explicit human label, nonempty identity/note, subject, reason and exact Candidate hash. There is no test/agent/LLM/policy actor option or batch accept. Local reviewer identity is self-asserted; this is a trusted local CLI capability boundary, not authenticated multi-user authorization. A caller already holding writable database access can bypass local policy; no adversarial authentication/security certification is claimed.

Without `--fact-file`, accept stores a **pure exact quotation**, rawUnit/unit quoted_text, identity normalization, metric quoted_primary_passage, observedAt descriptive Source documentDate, no financial period. Confidence=1 expresses faithful literal copying, not issuer truth/model confidence. For reviewed numeric/text facts supply a strict fact JSON containing researchField/category/metric/scope/rawValue/rawUnit/unit/normalization/periodStart/periodEnd/observedAt/confidence. Quote cannot be edited, no statement override allowed. Raw literal must be present, existing v0.1 unit scaling is recomputed. Boolean/structured or transformed/nonliteral facts are deliberately unsupported. Human review establishes metric/unit/period context; a number appearing in a long page alone does not prove semantics.

`--existing-evidence-id EVID_ID --reason verified_existing_evidence --fact-file PATH` explicitly maps to an existing fact. Source/page and all declared fact fields except confidence must match. It returns already_accepted, retaining the original paraphrase/locator/hash. This explicit existing-record mapping does not rewrite Candidate quote. Ambiguous matches need a valid exact ID.

Queue filters: --state, --query-id, --source-id, --created-from, --created-to, --method, --validation, --as-of. Actual Candidate stores queryId, not original query wording. Current pending candidates with invalid raw citations show stale. Accepted/rejected derives from last visible Review; raw validity is separate. Historical queue state never applies today's raw failure retrospectively; validation shown remains current and is not an archived historical validation result. Review history contains actual frozen validation snapshots.

## Domain and persistence

AdmissionLayer supports acceptCandidate, rejectCandidate, listCandidates, stats, reviewHistory, deepProvenance. Programmatic constructor defaults to human only. `allowSystemTest:true` is explicit trusted test capability for controlled fixtures; CLI never enables it. Test simulations must not be described as actual human acceptance.

Reviews are independent immutable relations in the same Memory SQLite database. Optional `backend.admissionRecords()` lazily adds admission_reviews and admission_fact_links, sharing existing transaction/savepoints. records/links table and user_version=2 are unchanged; old APIs/tests work. Evidence + Review + duplicate link commit atomically or roll back. FK ties accepted Review to formal Evidence. Immutable triggers reject UPDATE/DELETE. This additive table extension is not forward-compatible with an older writer that ignores Admission; domain use must retain this layer, and storage operational backup remains separate work.

Each Review records stable ID/version/previousReviewId, decision/reason/reviewer/note, Candidate hash/request hash, Source/Chunk/Document/quote snapshots, validation, mapping, resultingEvidenceId and four knowledge times plus recordedAt. Sources/Chunk snapshots are preserved even for rejection; Candidate stays in Retrieval. No deletion/retraining/reranking from rejected data.

Repeat identical latest operation is idempotent. A different operation requires explicit latest `--supersedes REVIEW_ID`; appends, never updates. An accepted Candidate cannot remap to a different fact even under re-review: generate a new Candidate. Rejection after acceptance changes workflow history but does not delete Evidence or undo prior admission. Use v0.2 correction for erroneous accepted facts. Deep provenance also finds original admission through correction lineage; v0.2 concise provenance remains unchanged.

## Duplicate and temporal policy

New fact key binds Source, canonical exact locator/quote and normalized semantic fact, excluding query/reviewer/confidence. Different query Candidates reuse Evidence; first confidence is retained. Existing facts additionally match exact Source/page/semantic raw/unit/period fields. Human declaration is mandatory; matching does not infer unsupported periods/metrics. Superseded facts cannot receive fresh admission; original reviews survive correction.

availableAt is scoped public Source content time (nullable), retained from Document, never replaced with today. candidateCreatedAt is discovery; reviewedAt starts explicit review; acceptedAt is successful atomic admission/acknowledgment; recordedAt is completed journal knowledge time. evidenceMemoryCreatedAt separately records the fact's first actual Memory ingest (may predate a new review of an existing fact). Audit historical Review queries require recordedAt ≤ cutoff; formal Evidence remains governed by Memory ingestion time. Replay still uses availableAt for passages and never backdates Memory. Unknown availability may be admitted in Audit, stays unknown and excluded from Replay.

## Validation and TOCTOU

Require stored Candidate/expected hash, full v0.3 fresh original-byte/reparse citation validation, subject, primary Source identity and temporal consistency. Hold a Retrieval read snapshot while executing the Memory write transaction. Revalidate with a new parser-validation instance and compare the complete reviewed snapshot immediately before Review append. Changed candidate/source/chunk/parsed text, invalid quote/locator and future context fail closed; Evidence rolls back on final validation or durable Review failure.

SQLite cannot lock an external raw file. Final original-byte checks + immutable copied reviewed snapshots identify the content admitted; an external writer changing bytes after final check is a known filesystem boundary, not a claim of OS-level atomicity. Future operations revalidate again; committed history is not rewritten.

## Results/boundaries

Actual isolated CoreWeave system_test recovery: 13 reviewed / 13 existing matched / 0 new / 0 duplicates. Claims/revisions remain 4/4. Synthetic complete new admission: 32 USD millions →32,000,000 USD, one Evidence, no Claim. Technically valid citation rejected for wrong_period. Records in experiments/ are deterministic delivery summaries, not raw/runtime databases.

No auto accept, Agent/LLM authority, Claim mutation, Thesis, LLM-Wiki, real semantic provider, multi-agent, trading, Risk Engine, TAI/CCI, public contract/UI/production change or deployment. v0.3 parser/chunking/BM25/eval ground truth and benchmark remain unchanged. See [audit](REPOSITORY_AUDIT.md) and [delivery](../../docs/evidence-admission-layer-v0.4.md).
