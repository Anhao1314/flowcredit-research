# Model-facing selection handles — pre-code audit (v0.11.1)

Scope: before changing anything, find every place where an infrastructure
identifier reaches the model, prove which of them the model is asked to
reproduce, and fix the boundary. Read-only: no code was changed to produce this
document.

## 1. Question 1 — where canonical span IDs are exposed to the model today

| surface | field | representation | evidence |
| --- | --- | --- | --- |
| selection prompt, per candidate | first line of each rendered span | `SPAN SPAN-e01cd2a68842fefdfdf652ce` | `evidence-support/layer.js:43` (`renderSupport`) |
| selection prompt, identity list | `data.availableSpanIds` | the same ids again, as an array | `evidence-support/layer.js:109-110` |
| selection instructions | sentence 4 | "Every spanId must be copied exactly from the supplied candidate list … Never invent or modify an id." | `prompts/span-selection-v2.txt:4` |
| interpretation prompt, metadata | `data.span.id` | canonical id | `evidence-support/layer.js:134` |
| interpretation prompt, evidence block | first line of `evidenceText` | `SPAN <canonical id>` | `evidence-support/layer.js:134` via `renderSupport` |

The selection prompt therefore shows each canonical id **twice** (identity line
plus list entry) and then asks the model to reproduce it. In the v0.11 retrieval
arm the id is `SPAN-` plus 24 hex characters, so one selection call requires up
to 8 verbatim copies of a 29-character opaque string.

## 2. Question 2 — where the model must re-output a canonical ID

Exactly one place:

`selection-output.schema.json` requires `spanIds: string[]` (1–3 ids, 1–10
items). `contract.parseSelection` (`evidence-support/contract.js:14-25`) then
compares those strings against the offered set and throws
`INVALID_SPAN_REFERENCE` (status `FABRICATED_SPAN`) when one is not a member.

The interpretation prompt is the counter-example that shows the fix is possible:
its output schema requires metric/value/period fields and **no identity field at
all** (`analyst-staged/interpretation-output.schema.json`), and the analyst
already takes the span id from deterministic code
(`caseRecord.selections[].spanId`). The model is never asked to prove which span
it interpreted; code owns that.

### The failure this audit is about (v0.11, GOLD-08)

The raw selection response, preserved as regression material:

```json
[{"spanIds":["SPAN-ab6a4f2666baf76a412ce7ef","SPAN-690dd2e0535bfd8b70733765","SPAN-c83b19906c4d3d637fdc5537"],"factKind":"financial_metric"},
 {"spanIds":["SPAN-ab6a4f2666baf76a412ce7ef","SPAN-690dd2e0535bfd8b70733765","SPAN-62e029512b0f5661dc59a0be"],"factKind":"financial_metric"},
 {"spanIds":["SPAN-ab6a4f2666baf76a412ce7ef","SPAN-690dd2e0535bfd8b70733765","SPAN-e01cd2a68842fefdfdfdf652ce"],"factKind":"financial_metric"},
 {"spanIds":["SPAN-ab6a4f2666baf76a412ce7ef","SPAN-690dd2e0535bfd8b70733765","SPAN-240b92c16fd8c32c14f80c98"],"factKind":"financial_metric"}]
```

The offered candidate at rank 7 was
`SPAN-e01cd2a68842fefdfdf652ce`; the response contains
`SPAN-e01cd2a68842fefdfdfdf652ce` — one duplicated character group. The id was
offered, rendered and listed, so this is an identifier transcription failure, not
source fabrication, not retrieval leakage and not a semantic hallucination. It
still counted as `fabricatedSupport = 1` because `parseSelection` can only see
that a returned string is not a member of the offered set.

## 3. Question 3 — which paths can become ephemeral handles

Only the selection call needs an identity at all, and it needs it only to say
"this one, not that one" among the candidates of a single invocation:

- the candidate order is already frozen and deterministic (retrieval rank order,
  or page order without retrieval), so handle `S<i>` ↔ candidate `i` is derivable
  from the same data the prompt was built from;
- the interpretation call needs no identity in its output and can receive a
  handle as its label;
- nothing downstream needs the handle: it is resolved to the canonical id inside
  the same case, before any validation, proposal or promotion runs.

Handles are safe to be ephemeral because they carry no authority: `S2` is not
evidence, not a span, not a hash and not stable across invocations.

## 4. Question 4 — what must keep the canonical ID

Canonical identity stays authoritative everywhere it is load-bearing:

- `grounding/grounding.js:24` span id (`SPAN-…`), the span `contentHash`, and
  `supportHash` (`evidence-support/support.js:59-66`);
- `validateSupportV2` registry/sentence/table lookups — all keyed by canonical id;
- `selectionProposal.spanIds`, `factV2` records, `proposalV2` provenance,
  `supportCandidate` anchors and the retrieval receipt — the model never sees
  these, and they must remain canonical so that any two runs, or any two
  machines, agree on identity;
- Claims and Memory have their own identities and are untouched by this phase.

The handle exists **only** between `renderSupport` and the resolution step.

## 5. Invariants the change must not break

1. Candidate order and candidate membership are unchanged; only their labels are.
2. No fuzzy repair of any kind: `S9`, `SS1`, `s1`, ` S1`, `S01` are all invalid,
   deterministically and loudly.
3. Duplicate handles are rejected, not silently deduplicated.
4. Schema strictness is not lowered. If the runtime accepts a per-invocation
   enum, the enum is sent; the program-side exact check runs either way.
5. Provenance, validation, conversion and Claims see canonical ids only.
6. Retrieval, model, prompts' semantic task, K=8, fusion and filters are frozen.
7. The historical v0.11 artifacts and the decision they produced stay as they
   are: this is a new experiment, not a correction of the old one.

## 6. Surfaces audited

`analyst-real/eval.js` (locked cases), `grounding/grounding.js`,
`grounding/layer.js`, `evidence-support/{contract,layer,support,validator,proposal,store}.js`,
`evidence-support/selection-output.schema.json`, `prompts/span-selection-v2.txt`,
`prompts/fact-interpretation-span-v2.txt`, `analyst-staged/interpretation-output.schema.json`,
`local-model/provider.js` (structured output), `local-retrieval/{cli,layer,render,queries}.js`,
the v0.11 locked artifacts under `eval/local-retrieval/` and the raw run data for
`GOLD-08` outside the repository.
