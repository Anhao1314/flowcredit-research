# Source Grounding Layer v0.8 pre-code audit

Baseline `19e6cb9`. Read before coding: v0.3 PDF/HTML parser and chunker, Document/Chunk
contracts and locators, content hashes, v0.5/v0.6 EvidenceProposal, v0.7
EvidenceSpanProposal/InterpretedFact/parsers, the locked 16 Gold cases, the 12
`GOLD_MAPPING_LIMITATION` cases, v0.7 `failureBreakdown`, `comparison.json`,
`phase-gate.json` and the v0.5–v0.7 documentation and tests. Gold truth was not changed.

Corpus facts confirmed from the index and the external raw files:

| Case group | Document | PDF page | Shape |
|---|---|---|---|
| GOLD-01, GOLD-09 | annual (SRC-537a3ecf) | 140 | geographic revenue table, 3 value columns (2025/2024/2023) |
| GOLD-02, GOLD-03, GOLD-16 | annual | 93 | consolidated statements of operations, 3 value columns |
| GOLD-04, GOLD-07, GOLD-12 | q2 (SRC-093bb8c3) | 46 | statements of operations, 4 value columns (3M/6M x 2026/2025) |
| GOLD-11, GOLD-13, GOLD-14, GOLD-15 | q2 | 18 | significant-customers table, 4 value columns |
| GOLD-05, GOLD-06, GOLD-08, GOLD-10 | q2 p18/p52, annual p77/p26 | - | narrative prose |

## 1. How many of the 12 mapping limitations are true tables?

12/12. Every one of the 12 is a row/column grid with a caption naming the unit
("(in millions)", "(in millions, except per share data)") and one or more header lines
above value columns. None is a form layout, a chart, or a footnote artifact.

## 2. How many come from parser layout loss?

12/12, in the specific sense that the current value is structurally incomplete: the v1
PDF parser (`pdf-blocks-pymupdf-1.26.5/v1`) joins page blocks into one text string and
records only a whole-page bbox in the Document locator. It preserves every character of
the tables (labels and all values survive), but it discards line/word geometry, so the
column that a value sits under is no longer addressable. This is structure loss, not
text loss.

## 3. How many come from multi-column / multi-period representation?

12/12 carry two or more value columns per row (3 or 4 in the observed cases). Seven rows
across the studied pages also carry "*" placeholders that a naive pairing would misread.

## 4. How many are text-representable, with only the quote contract unsuitable?

Source literals are present in the page text for 12/12, and the earlier thousand-separator
regex explains the four literal misses noted in v0.7 (`1915` vs `1,915`, etc.). However,
after literal matching, 0/12 is faithfully representable as a value/period binding through a
plain prose quote: the value column is only implied by ordering, headers sit in separate
lines, and the v0.5 EvidenceProposal contract requires one explicit period per fact. The
existing parser therefore has the characters but not the binding; a table-aware deterministic
span is required.

## 5. Is the current Chunk locator sufficient for table-region or cell-level grounding?

No. `locator = {unitIndex, unitStart, unitEnd, raw:{type:'pdf_page', page, bbox:<whole page>}}`
addresses a page-unit range only. It cannot address a line, a cell, or a header phrase. It is
sufficient to anchor a page (which bounds the candidate span set of a case) and to detect
source mutation, but a new deterministic layout extraction with word/line coordinates is
required for cell-level grounding.

## Consequence for the design

- Keep the v1 parser, chunker, index, chunk IDs and GitHub-committed corpus untouched.
- Add an additive, versioned grounding parser that reads the same raw PDFs and emits
  deterministic line/word geometry plus table regions (or explicit
  `unsupported_table_layout`), pinned to the same PyMuPDF version.
- Build the SourceSpan registry from that output; TextSpans exclude recovered table regions
  so that a recovered table fact has exactly one authoritative representation, while an
  abstained (`unsupported_table_layout`) run keeps its raw text as ordinary text spans.
- The LLM receives a bounded deterministic rendering of the spans for the case's page and
  may only return span IDs from that set; quote generation and table reconstruction leave
  the model's responsibilities.
- The unchanged v0.5 validator, Candidate stop and Claims boundary remain the final gate.
