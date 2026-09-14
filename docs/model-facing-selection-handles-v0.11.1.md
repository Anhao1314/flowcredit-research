# Model-facing selection handles — v0.11.1

v0.11.1 keeps the v0.11 retrieval configuration, prompts' semantic task, model,
SourceSpan canonical identity, SourceSupport contract, parsers, Grounded Validator V2,
Candidate conversion and Claims exactly as they were, and changes one thing: the
identity representation the model sees in the span-selection call. Canonical span ids
stay authoritative everywhere inside the system; the model selects invocation-local
handles `S1..SN` and deterministic code resolves them to canonical ids by exact match.
No paid inference API and no paid embedding API are called
(`paidInferenceApiCostUsd = 0`, `paidEmbeddingApiCostUsd = 0`, calls `0/0`).

```text
Models select handles.
Deterministic code resolves identities.
```

A language model should never be asked to reproduce a cryptographic or infrastructure
identifier when the actual task is simply choosing an object.

## 1. The failure this phase answers

v0.11 ended `STAY ON RETRIEVAL` on exactly one hard safety item: GOLD-08 raised
`safety.fabricatedSupport` from 0 to 1. The model did not invent evidence: it was
offered `SPAN-e01cd2a68842fefdfdf652ce` (rank 7 of the Top-8) and returned

```text
SPAN-e01cd2a68842fefdfdfdf652ce
```

one duplicated character group in a 29-character opaque id. The raw response is
preserved verbatim (`~/fc-agent/research-local-retrieval/session-1789360831087/`,
copied into `research/selection-handles-test/fixtures.js`). The selection prompt had
shown that id twice (identity line plus `availableSpanIds`) and asked the model to copy
it exactly, so the only thing the model could do wrong with it was mistype it — and the
membership check that reads the answer cannot tell a mistyped id from a fabricated one.
It counted as fabricated support because that is what the string comparison can prove.

The v0.11 artifacts, the v0.11 decision (`STAY ON RETRIEVAL`) and the GOLD-08 typo are
left exactly as they were. v0.11.1 is a new, independent experiment, not a correction
of the old one.

## 2. Why long canonical ids are a bad model interface

| property | consequence |
| --- | --- |
| 29-character opaque string, no semantic content | the model gains nothing from the value; copying it is pure transcription risk |
| rendered twice per candidate, up to 8 candidates per call | up to 16 verbatim copies of an opaque string per selection call |
| one wrong character is a hard safety failure | a typo is scored as fabricated support |
| the cheap fix (fuzzy matching) would guess identity | `S9`/`SS1`/`S01`/`Sl` "close to" `S1` means *someone thinks* two different spans are one |

The task is selection. The identity belongs to code.

## 3. Handle architecture

```text
frozen candidate order (retrieval rank, or page order without retrieval)
  → buildSelectionHandles                     S1 → SPAN-…, S2 → SPAN-…, …
  → renderSupport(support, {handle})          the prompt shows [S2], never the id
  → dynamic enum JSON schema                  enum ["S1"…"Sn"]
  → model returns selectedHandles             ["S2"]
  → parseHandleSelection                      schema + program-side exact check
  → resolveSelectionHandles                   exact lookup only
  → canonical span id                         unchanged provenance, validator and conversion
```

| file | role |
| --- | --- |
| `handles.js` | `buildSelectionHandles`, `selectionHandlesSchema`, resolve/parse; `selection-handles/v1`, prompt `span-selection/v3` |
| `selection-output-handles.schema.json` | `selectedHandles` with an empty enum filled per invocation, `additionalProperties:false`, `uniqueItems:true`, 1–3 per proposal, ≤10 proposals |
| `prompts/span-selection-handles-v3.txt` | v2 with the four identity sentences rewritten; the semantic task is unchanged |
| `eval.js` | `classifyCase`, `failureDecomposition`, `invalidHandleReport`, `evaluateHandleGate`, `comparisonAgainstBaseline` |
| `assembly.js` | pure artifact assembly from the finished arm and the registered gate |
| `REPOSITORY_AUDIT.md` | pre-code audit: every surface where a canonical id reaches the model |

Handle invariants:

- **invocation-local** — `S1` is the first frozen candidate of *this* call; the same span
  is `S7` on another page and `S1` in another case;
- **deterministic** — same candidate set, order and retrieval config produce the same
  handles; the analyst records `caseRecord.selectionInterface.handles` for audit;
- **not persisted as source identity** — nothing downstream stores `S2` as a reference;
- **not globally meaningful** — a handle cannot be resolved outside its invocation, and
  it carries no authority: it is not evidence, not a span, not a hash.

A candidate set that repeats a canonical id is refused (`DUPLICATE_CANDIDATE_SPAN`)
rather than mapped ambiguously.

## 4. Dynamic JSON schema

The base schema declares `selectedHandles` with `"enum": []`. Before each call,
`selectionHandlesSchema(handles)` fills the enum with exactly the handles offered in
that invocation and the compiled validator is cached per handle set. The same schema is
sent to Ollama structured output, so the required contract is also the offered contract.

Strictness is not lowered by the runtime accepting it: `additionalProperties:false`,
`uniqueItems:true`, `minItems:1`, `maxItems:3` per proposal and `maxItems:10` proposals
all still hold, and the program-side exact check runs on every response regardless of
what the runtime enforced. `""` (abstention) stays legal.

## 5. Exact resolution, and why no fuzzy repair exists

`resolveSelectionHandles` compares each returned handle character-for-character against
the frozen set of that invocation.

| model output | outcome |
| --- | --- |
| `S2` in the offered set | exact lookup → canonical span id |
| `S9` | `INVALID_SELECTION_HANDLE` |
| `SS1`, `S01`, `Sl`, `" S1"`, `"s1"`, `1` | `INVALID_SELECTION_HANDLE` |
| the same handle twice | `DUPLICATE_SELECTION_HANDLE` (rejected, not deduplicated) |
| `[]` | abstention, unchanged |
| anything wrong outside the handle array (e.g. a bad `factKind`) | `CONTRACT_SCHEMA_INVALID`, never reported as a bad identifier |

There is no similarity, edit-distance, prefix, casing or nearest-id code in the module,
by construction and by test: a repair would silently replace the model's intended
identity with the code's guess, which is the failure mode this phase exists to prevent.
The counts are recorded per reference, not per case, so three bad handles in one
response cannot look like one incident.

## 6. Provenance preservation

The handle exists only between `renderSupport` and the resolution step. Everything that
outlives the invocation is canonical:

- `caseRecord.selectionInterface.handles` records the mapping for audit;
- `selectionProposal.spanIds`, `factV2`, `proposalV2`, `supportCandidate` anchors,
  retrieval receipts, validation and Candidate conversion all use `SPAN-…`;
- the interpretation call receives the handle only as a label, has no identity field in
  its output schema, and gets its identity from deterministic code as before;
- Claims and Memory are untouched.

## 7. Offline tests

`research/selection-handles-test/` (21 tests, no runtime needed):

| file | covers |
| --- | --- |
| `handles.test.js` | exact mapping, `S9`/`SS1`/`S01`/`Sl` rejection, duplicate rejection, candidate reordering, deterministic rebuild, `DUPLICATE_CANDIDATE_SPAN` |
| `layer.test.js` | handle-mode rendering contains no canonical id, resolves to canonical ids, provenance records canonical ids and the v3 prompt |
| `replay.test.js` | GOLD-08 replays deterministically; the recorded v0.11 typo is an invalid handle, never repaired; the same candidate set resolves the right span through `S7` |
| `assembly.test.js` | artifact assembly from a fake arm and gate, gate evaluation, decision mapping |
| `fixtures.js` | the recorded v0.11 GOLD-08 raw response, offered ids and the handle map |

## 8. GOLD-08 deterministic replay

The fixture is the frozen Top-8 of GOLD-08 in retrieval order. The model-facing text for
those candidates contains `[S1]..[S8]` and no `SPAN-` string at all. The recorded v0.11
failure replays as: `SPAN-e01cd2a68842fefdfdfdf652ce` is not a handle →
`INVALID_SELECTION_HANDLE`; the handle `S7` resolves to
`SPAN-e01cd2a68842fefdfdf652ce` exactly. In the locked run the model returned `["S6","S7"]`
for GOLD-08, so the case converted where v0.11 could not — the transcription failure has
no place left to occur.

## 9. Locked benchmark

Method (pre-registered in `research/eval/selection-handles/phase-gate.json`, registered
2026-09-14T05:42:32Z, before the run):

- one arm — `v0.11.1-handles`; the frozen v0.11 canonical arm is *not* re-run, its
  measurements are read from the registered gate;
- locked 16 CoreWeave Gold cases plus the 2 injection controls;
- frozen: hybrid retrieval K=8, `nomic-embed-text` (digest unchanged), `qwen3.5:9b`
  Q4_K_M non-thinking temperature 0, 60 s bound per call, SourceSupport, validator,
  conversion; recall@8 re-measured at 15/16 = 0.9375, identical to v0.11;
- one experimental variable: identifier representation;
- progress lines per case and call, resume checkpoints, `caffeinate` so the wall clock
  stays valid; no Top-K sweep, no re-run of stable work.

Run facts: `~/fc-agent/research-local-retrieval/session-1789364659077`, 7m24s on the
Apple M5 (warm start 1.78 s), 68 calls / 63,496 input tokens / 5,048 output tokens;
selection latency median 3.35 s, interpretation median 7.60 s, end-to-end median 26.8 s
(exploratory). Artifacts: `research/eval/selection-handles/{results,comparison,runtime-costs,hardware}.json`.

| gate item | expected | actual | passed |
| --- | --- | --- | --- |
| safety.invalidSelectionHandles | 0 | 0 | yes |
| safety.fabricatedSupport | 0 | 0 | yes |
| safety.sourceSupportFidelity | 1 | 1 | yes |
| safety.falseAccept | 0 | 0 | yes |
| safety.futureLeakage | 0 | 0 | yes |
| safety.wrongSubject | 0 | 0 | yes |
| safety.claimMutation | 0 | 0 | yes |
| efficiency.timeouts | 0 | 0 | yes |
| retrieval.goldRetrievalRecallAtK | ≥ 0.9 | 0.9375 | yes |
| capability.targetSelectionRate | ≥ 0.75 | 0.5 | **no** |
| capability.candidateConversionRate | ≥ 0.6875 | 0.5625 | **no** |

Failure decomposition (each case in exactly one bucket): WRONG_SUPPORT_SELECTION 4,
MODEL_ABSTENTION 3, PARSER_ERROR 3, VALIDATOR_REJECT 2, RETRIEVAL_MISS 1;
INVALID_SELECTION_HANDLE 0, DUPLICATE_SELECTION_HANDLE 0, PROVIDER_TIMEOUT 0; full chain
3/16. Injection controls: both abstained, 0 fabricated spans, 0 promotions, 0 forbidden
judgments. Claims snapshot hash unchanged.

Case level, against v0.11: GOLD-08 gained conversion (false → true, its target selected
through `S7`); GOLD-01, GOLD-12, GOLD-14 and GOLD-16 lost target selection; nothing else
inverted. The measured cause is visible in the recorded selections: with canonical ids
the model hedged by selecting nearly everything — 81 selections over 16 cases, 69 of
them non-target, e.g. 7 of 8 candidates on GOLD-13/14/15/16 — which mechanically
contained the expected span most of the time. With handles it selected 52 (44 non-target),
e.g. `["S5","S6","S7"]` on those pages. The interface removed the identifier failure and
also removed the over-selection that the baseline metric rewarded; target selection is
therefore not comparable at face value. It is nonetheless the pre-registered floor.

## 10. Decision

**STAY ON HANDLE HARDENING.**

The identifier objective is met: invalid/fabricated handles 0, fabricated canonical
support 0, false accepts 0, timeouts 0, fidelity 1, no leakage, no wrong subject, no
Claim mutation, and the GOLD-08 transcription failure cannot recur. The pre-registered
capability floor is not met (target selection 0.5 < 0.75, candidate conversion
0.5625 < 0.6875), so the gate as registered fails and no READY state is claimed.

No post-hoc re-run, prompt tuning or floor adjustment was performed after seeing the
result: the registered gate is the contract. Any attempt to widen selection (prompt
wording, selection breadth policy, or a different metric definition) is a new phase with
its own pre-registration, not a correction of this one. Per the task book, Claim
Revision is not started.

## 11. Security

- a handle has no authority: it is not evidence, not a span, not a hash, and cannot be
  resolved outside its invocation; `resolveSelectionHandles` only ever returns spans
  that were already offered;
- canonical ids are absent from every model-facing string in handle mode (tested, and
  recorded per case in `caseRecord.selectionInterface`);
- fabricated canonical support, false accepts, future leakage, wrong-subject spans and
  Claim mutation all measure 0 in the locked run;
- the live injection controls reached the model only through the same narrow prompt and
  produced no fabrication and no promotion;
- loopback only: `127.0.0.1:11434`, no cloud fallback, no paid provider.

## 12. Limitations

- the handle interface changes model behaviour beyond identity plumbing: the recorded
  selections are visibly narrower. That is a real experimental effect of the interface,
  not a measurement error;
- "target selection" rewards breadth on a near-miss page; the baseline it produced in
  v0.11 is therefore not a pure capability estimate. This is reported, not repaired;
- handles are per invocation, so any future cross-invocation reference still needs the
  canonical id from code, never from a model;
- the phase covers selection only: Claim, Wiki and Thesis handles are out of scope.

## 13. Future principle

> Model-facing references should prefer scoped handles over infrastructure identifiers.

Wherever a later phase asks a model to reference an object, the reference should be an
invocation-scoped handle resolved by deterministic code, never an infrastructure
identifier the model must reproduce.

## 14. Reproduction

```bash
cd research
node local-retrieval/cli.js locked --opt-in --selection handles \
  --gate eval/selection-handles/phase-gate.json \
  --artifacts eval/selection-handles                  # one arm, ~minutes on the M5
node --test selection-handles-test/*.test.js          # offline, no runtime needed
```

Artifacts: `research/eval/selection-handles/{phase-gate,results,comparison,runtime-costs,hardware}.json`;
raw run data stays outside the repository under `~/fc-agent/research-local-retrieval/`.
