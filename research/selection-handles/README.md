# Model-facing selection handles (v0.11.1)

Replaces the canonical span id in the model-facing selection prompt with an
invocation-local handle (`S1..SN`) that deterministic code resolves by exact match.
The handle is a label, not an identity: it is not persisted as a source reference, it
means nothing outside its invocation, and it is never repaired. A handle that is not in
the frozen set is a loud program-visible error (`INVALID_SELECTION_HANDLE`), never a
guess at the intended span.

```text
frozen candidate order → S1..SN → prompt shows [S2] → model returns ["S2"]
  → exact lookup → canonical SPAN-… → unchanged provenance, validator, conversion
```

## Files

| file | role |
| --- | --- |
| `handles.js` | `buildSelectionHandles`, `selectionHandlesSchema`, `resolveSelectionHandles`, `parseHandleSelection`; versions `selection-handles/v1` and prompt `span-selection/v3` |
| `selection-output-handles.schema.json` | base output schema; the `selectedHandles` enum is filled per invocation |
| `eval.js` | per-case failure classification, invalid-handle report, gate evaluation, baseline comparison |
| `assembly.js` | pure assembly of the locked-run artifacts from the finished arm and the registered gate |
| `REPOSITORY_AUDIT.md` | pre-code audit: every surface where a canonical id reaches the model |

## Discipline

- **Exact resolution only.** No fuzzy matching, edit distance, prefix, casing or
  nearest-id repair exists in this module, and the tests assert their absence.
- **Handles carry no authority.** A handle is not evidence, not a span and not a hash;
  resolution can only ever return a span that was already offered.
- **Canonical identity is preserved.** Proposals, facts, provenance, validation,
  Candidate conversion and the retrieval receipt use `SPAN-…` only;
  `caseRecord.selectionInterface` records the invocation's handle map for audit.
- **Schema strictness is not lowered.** The dynamic enum is sent to the runtime and the
  program-side exact check runs on every response either way.
- **Duplicate candidate spans are refused** (`DUPLICATE_CANDIDATE_SPAN`) instead of
  mapping two handles to one span.

## Usage

```bash
cd research
node local-retrieval/cli.js locked --opt-in --selection handles \
  --gate eval/selection-handles/phase-gate.json --artifacts eval/selection-handles
```

The handle arm reuses the frozen v0.11 canonical arm from the registered gate; the
control arm is not re-run. Retrieval, K=8, the model and the prompts' semantic task are
frozen — the only experimental variable is the identifier representation.

## Offline tests

```bash
cd research
node --test selection-handles-test/*.test.js
```

## Delivery

The benchmark, its gate result and the `STAY ON HANDLE HARDENING` decision are recorded
in [the v0.11.1 delivery](../../docs/model-facing-selection-handles-v0.11.1.md).
Future principle: model-facing references should prefer scoped handles over
infrastructure identifiers (Claim, Wiki and Thesis handles are out of scope here).
