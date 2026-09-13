# Evidence Support Contract v0.9

Versioned Evidence support for the Research Evidence Analyst. The v0.5
contiguous-quote validator is frozen; v0.9 adds an additive, versioned path that
lets narrative and table facts reach an EvidenceCandidate without fabricating prose.

## What v0.9 adds

- `sentences.js` — deterministic `sentence-segmentation/v1` over verified block
  TextSpans. Segments are exact whitespace-preserving slices (no LLM, no text
  manufacture); abbreviation, decimal, parenthetical and clause guards; whole-block
  fallback; `SentenceSpanIndex` verifies parent chain, offsets and hashes.
- `support.js` — the `source-support/v1` union. `TextSupport` binds an exact sentence
  slice; `TableSupport` binds cell, row label, header path, unit context, page and
  hashes from a verified TableSpan. Deterministic value/unit/period parsing lives here
  (`parseTableValue`, `parseTablePeriod`); the model never computes or copies them.
- `validator.js` — `grounded-evidence-validation/v2` (`Grounded Validator V2`): common
  checks (source, document, subject, availability, span existence/hash, support
  immutability) plus a text branch (exact slice/text/locator/parent) and a table branch
  (table/row/column/cell existence, exact cell/labels/unit context/page/hashes).
- `proposal.js` + `proposal-v2.schema.json` — `evidence-proposal/v2` with the support
  union, deterministic `value`/`period`, provenance and validation findings.
- `layer.js` — `EvidenceSupportAnalyst`: span selection over sentence and table
  candidates, interpretation, deterministic validation and explicit promotion to a
  retrieval-level Candidate plus a support-carrying `supportCandidate` sidecar. Human
  admission through v0.4 is unchanged; nothing writes Evidence.
- `gold.js` — `gold-span-annotation/v2` adds `expectedSupportType` and sentence/table
  `expectedSpanIds` without touching locked Gold truth.
- `eval.js`, `controls.js`, `synthetic-pdf-v2.py`, `cli.js` — metrics, pre-registered
  gate, injection control (hostile table row labels and narrative) and the real
  DeepSeek run entry point.

## Complements

- `docs/evidence-support-contract-v0.9.md` — delivery report A–V.
- `REPOSITORY_AUDIT.md` — pre-code audit of continuous-quote assumptions.
- `../eval/evidence-support/` — pre-registered gate and sanitized run artifacts.
- `../grounding/README.md` — the v0.8 SourceSpan registry this layer builds on.

## Run

```bash
cd research
node evidence-support/cli.js gold --opt-in        # real locked-Gold benchmark
node evidence-support/cli.js injection --opt-in   # real injection control
node --test evidence-support-test/*.test.js       # offline regression (36 tests)
```

Real runs require explicit opt-in and the external `fc-agent` credential/workspace; raw
model output, credentials and results stay outside the repository.
