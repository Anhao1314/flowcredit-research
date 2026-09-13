# Evidence Support Contract v0.9 pre-code audit

Baseline `3997a77`. Read before coding: v0.1 Evidence schema and identity rules, v0.2
Memory persistence and correction/supersession, v0.3 Retrieval Candidate contract and
chunker, v0.4 Admission review boundary and mapping, v0.5 analyst validator, v0.6 real
model validation, v0.7 EvidenceSpanProposal and parsers, v0.8 SourceSpan/TableSpan,
registry, renderer and false-reject records, the locked 16 Gold cases, and the v0.8
artifacts in `research/eval/source-grounding/`. No code was written before this audit and
locked Gold truth was not changed.

## 1. Which fields of the v0.1 Evidence schema force a continuous quote?

The v0.1 schema (`research/schemas/evidence.schema.json`) has no quote field, but four of
its fields are quote-shaped by convention and by every producer:

- `statement` — every writer passes the candidate's verbatim `quotedText` (admission
  `mapCandidate`, v0.5 analyst, v0.7 staged, v0.8 grounding), and the v0.5 validator
  enforces `statement === quotedText` (`statement_not_exact`).
- `location` — `JSON.stringify(canonical(candidate.locator))` of a *chunk* locator
  (`{unitIndex, unitStart, unitEnd, raw:{type:'pdf_page', page, bbox}}`), i.e. a
  contiguous text range, never a cell/label tuple.
- `rawValue` / `rawUnit` — the validator re-finds them inside the quote
  (`rawTokens(quote).includes(rawValue)`, `unitSupported(quote, rawUnit)`), and admission
  re-checks `rawPresent(candidate.quotedText, fact.rawValue)`.
- `periodStart` / `periodEnd` / `observedAt` — the validator requires each date to appear
  in the quote (`dateIn(quote, date)` → `period_not_supported`).

`section`, `page`, `metric`, `category`, `scope`, `normalization`, `contentHash` and
`provenance.sourceContentHash` are not quote-shaped and are reusable as-is.

## 2. In which layer does each assumption live?

| Assumption | Layer | Site |
|---|---|---|
| `quotedText` must be an exact substring of a chunk | Candidate v0.3 | `validateCandidate` → `quote_not_in_chunk`; `createCandidate` identity |
| Candidate identity/query is quote-driven | Candidate v0.3 | `createCandidate(chunkId,{query})`; retrieval search must return the chunk |
| quote contains value, unit words and period text | Validator v0.5 | `invalid_quote`, `statement_not_exact`, `unsupported_numeric`, `ambiguous_value_binding`, `numeric_unit_binding_invalid`, `unknown_or_unsupported_unit`, `period_not_supported`, `category_unsupported` |
| raw value must appear in the reviewed quote | Admission v0.4 | `mapCandidate` → `rawPresent`; `statement: candidate.quotedText` |
| generated span quote must be verbatim | Analyst v0.7 | `validateSpan` → `QUOTE_HALLUCINATION`, `QUOTE_TOO_BROAD` |
| a best-effort contiguous quote can represent a table fact | Grounding v0.8 | `facts.js sourceQuote` + `deriveSpanFact` substring checks |

Measured consequence (v0.8 run `GROUND-1789316602580`): 10 of 10 selected table cases are
`VALIDATOR_FALSE_REJECT` even though numeric/unit/period parse exactly to locked Gold,
because the unit phrase and the period live in the caption and the column header, outside
any contiguous cell quote. One text case false-rejects for the same reason. Candidate
conversion is 0/16.

## 3. What can be solved with a versioned extension?

- A new `GroundedEvidenceValidatorV2` with common checks plus a text branch and a table
  branch. The v0.5 validator stays frozen for v0.1–v0.8 evidence.
- An `EvidenceProposal v2` schema whose `support` is a union (`TextSupport|TableSupport`)
  instead of an implicit quote.
- Sentence-level `SentenceTextSpan` records derived deterministically from existing block
  spans (block spans stay; ids stay).
- A support-carrying Candidate sidecar that wraps a retrieval-level anchor candidate; the
  v0.3 Candidate object itself stays byte-identical in shape.
- Additive Gold annotations (`expectedSupportType`, `expectedSpanIds`) without touching
  factual Gold.

## 4. What must stay legacy-compatible?

- v0.1 Evidence records, ids and `contentHash`, and the quote convention for existing text
  evidence.
- v0.2 Memory append-only history, correction/supersession semantics.
- v0.3 parser, chunker, chunk ids, locators, Candidate schema and validation.
- v0.4 human admission review semantics; no auto-Evidence from any new path.
- v0.5 validator behaviour for existing text evidence (no relaxation).
- v0.7 EvidenceSpanProposal ids and v0.8 SourceSpan/Registry ids, hashes and verification.
- No data migration: v1 records stay readable and verifiable exactly as stored.

## 5. How does table evidence enter the existing boundary without fabricated prose?

1. The model selects a verified table cell span; it never writes cell text, labels, unit or
   period. `TableSupport` is built by deterministic code from the span's structure
   (cell, row label, column label/header path, unit context, page, table id).
2. Value, unit and period come from deterministic parsers over `cellText`, the unit
   context and the column label (`bindingLiteral` + `parseNumeric`, `spanPeriodText` +
   `parsePeriod`); the LLM never computes a normalized value.
3. Candidate conversion keeps a *verbatim contiguous excerpt* (row-label words plus cell
   words exactly as they occur in chunk text) only as the retrieval anchor. The support
   sidecar carries the structural truth and its hash. The anchor is never presented as the
   fact's source; renderer prose never enters provenance.
4. Human admission is unchanged and still required; v0.9 demonstrates conversion to
   Candidate, not Evidence.

## 6. What granularity do text spans need?

Sentence level. In v0.8, block-level text spans hold several facts; 3 of 4 text Gold cases
selected the right block but interpreted a literal from a different sentence (numeric 1/4).
The fix is deterministic sentence segmentation inside each block (`SentenceTextSpan` with
parent span id, char range, line range, stable id), punctuation-preserving, no LLM
segmentation, with whole-block fallback when a boundary is unreliable. This lets the model
select the narrowest candidate and lets the deterministic value check bind to the same
sentence that states the fact.

## Corpus confirmation

The same 16 locked cases remeasured against the v0.8 registry: 12 table groundable
(GOLD-01,02,03,04,07,09,11,12,13,14,15,16; single core cell + context each, no case needs
multi-cell composition), 4 text groundable (GOLD-05,06,08,10) which now require sentence
spans. Unsupported-layout spans stay abstained. The 11 v0.8 false rejects break down as 10
table + 1 text and must each be replayed in v0.9.

## Design consequences

- New workstream `research/evidence-support/`: sentences, table structure index, support
  union, validator V2, proposal v2, support analyst, evaluation, controls, CLI.
- Frozen: v0.5 validator, v0.3 Candidate schema, v0.4 admission boundary, v0.8 registry
  and parser; all new behaviour is additive and versioned.
- Pre-registered gate before the locked run; report `resolved by TableSupport`,
  `resolved by sentence spans`, `still false rejected` per case; fabrication, wrong
  support, and validator false accepts are separate counters.
