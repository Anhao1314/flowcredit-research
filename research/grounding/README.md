# Source Grounding Layer v0.8

Grounding is deterministic; semantic selection may use the LLM; citation content is never invented by the LLM. A deterministic PyMuPDF 1.26.5 layout parser turns each source into a Document plus a SourceSpan registry: TextSpans are contiguous page text blocks outside recovered table regions, TableSpans are row-plus-column cells that carry row label, header path, caption and unit context. The model receives rendered candidate spans and may only return `spanIds` that already exist. An id outside the supplied set is `INVALID_SPAN_REFERENCE` and is rejected before any interpretation call. Pass 2 interprets a verified span into raw literal strings; deterministic parsing checks value/unit/period fidelity against the span and constructs the unchanged v0.5 EvidenceProposal. The unchanged validator and promotion boundary remain mandatory.

```
node --test research/grounding-test/*.test.js
node research/grounding/cli.js dev --opt-in
node research/grounding/cli.js gold --opt-in --provider deepseek
node research/grounding/cli.js injection --opt-in
```

Real calls are explicit opt-in (`--opt-in` or `FC_GROUNDING_OPT_IN=1`) and use the same configured DeepSeek path/model as v0.6/v0.7. Optional paired `--index`, `--results` flags; runtime outputs must be external. Full runs, provider responses and the per-run SQLite stores live only outside Git in private runtime files; sanitized summaries omit raw model output and literals but retain hashes, parser results, statuses and findings. Existing formal Memory is opened read-only and Claims/revision payload hashes are compared before and after.

Tables are never reconstructed by a model. When row/column structure is not deterministically recoverable the parser records `unsupported_table_layout` and guesses nothing; the run's raw text stays available as ordinary text spans. Placeholder-only cells are grounded but excluded from the candidate set. Header paths preserve every header level, header units and captions keep provenance bboxes, and multi-period columns stay separate spans with separate periods. `Q2 2026`/`FY2025` remain unknown without an explicit calendar; fiscal calendars are out of scope.

Known v0.8 limitations recorded by the phase gate: the frozen v0.5 validator rejects a table fact because a contiguous quote cannot carry the table's unit and period (`VALIDATOR_FALSE_REJECT`, 10 of 10 selected table cases), and block-level text spans can hold several facts, so a correct selection may still interpret the wrong literal. Neither is relaxed here; both are reported separately.

See [pre-code audit](REPOSITORY_AUDIT.md), [registered gate](../eval/source-grounding/phase-gate.json), [delivery](../../docs/source-grounding-layer-v0.8.md).
