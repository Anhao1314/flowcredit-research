# Local Model Validation v0.10

This module answers one question: can the restricted Evidence Analyst semantic
role run on a local open-weight model over a loopback inference runtime, so that
normal research operation no longer requires a paid cloud inference API?

It does not change the research task. The locked 16 CoreWeave Gold cases, the
SourceSpans, the SourceSupport contract, the `span-selection/v2` and
`fact-interpretation-span/v2` prompts, the EvidenceProposal contract, Grounded
Validator V2 and the Candidate conversion path are identical to v0.9. The only
experimental variable is the model and provider runtime.

## Contents

| File | Purpose |
| --- | --- |
| `provider.js` | `LocalProvider` for the loopback Ollama runtime: loopback-only enforcement, bounded JSON transport, runtime/model preflight, warm-up, receipts and metadata |
| `cli.js` | Explicit opt-in local runs: `preflight`, `smoke`, `dev`, `benchmark` |
| `eval.js` | Pre-registered local viability gate, frozen DeepSeek baseline reader, future-leakage detector, forbidden-output scanner, comparison table |
| `HARDWARE_AUDIT.md` | Machine audit recorded before anything was installed |
| `../eval/local-model/phase-gate.json` | Pre-registered gate, written before the locked run |
| `../eval/local-model/{results,comparison,injection,runtime-costs,hardware,memory}.json` | Sanitized benchmark artifacts |
| `../local-model-test/*.test.js` | Deterministic offline tests; no Ollama, no model, no external network |

## Provider contract

`LocalProvider` implements the same pure provider interface as the DeepSeek
adapter (`analyzeEvidence`, `metadata`, `receipts`) and additionally exposes
`preflight()` and `warmUp()` for the local runtime. It reuses the Evidence
Analyst unchanged: no layer, prompt, validator or conversion relaxation exists
for a smaller model.

Metadata pins the reproducibility facts the phase requires:

```text
kind, provider=ollama, model tag, model digest, temperature,
contextLength, think, structuredOutputMode, endpointOrigin,
runtime {name, version}, modelInfo {size, family, parameterSize,
quantization, contextLength, format}
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `FC_LLM_MODE` | `off` | `off` / `local` / `cloud` / `deepseek`; with no explicit mode there is no model call at all, cloud inference requires `FC_LLM_MODE=cloud`, and `local` never falls back to cloud (changed in v0.11: the previous default was `cloud`) |
| `FC_LOCAL_ENDPOINT` | `http://127.0.0.1:11434` | Loopback only; any other host fails as `LOCAL_MODEL_UNAVAILABLE` |
| `FC_LOCAL_MODEL` | `qwen3.5:9b` | Exact runtime tag |
| `FC_LOCAL_CTX` | `8192` | `num_ctx` sent with every request |
| `FC_LOCAL_THINK` | `false` | Explicit thinking / non-thinking mode |
| `FC_LOCAL_FORMAT` | `schema` | `schema` (runtime structured outputs) or `json` |
| `FC_LOCAL_MODEL_OPT_IN` | unset | Must be `1`, or `--opt-in` must be passed, before any local inference |
| `FC_LOCAL_RESULTS` | external `fc-agent/research-local-model` | Raw run output; always outside the repository |
| `FC_LOCAL_ARTIFACTS` | `research/eval/local-model` | Sanitized committed artifacts |

## Running

```bash
# No model, no runtime, no network: deterministic provider and layer tests.
node --test research/local-model-test/*.test.js

# Explicit opt-in local runs (never part of CI).
node research/local-model/cli.js preflight --opt-in
node research/local-model/cli.js smoke --opt-in
node research/local-model/cli.js dev --opt-in --think false
node research/local-model/cli.js benchmark --opt-in
```

A missing runtime or missing model always fails as `LOCAL_MODEL_UNAVAILABLE`.
There is no silent fallback to a paid provider, and no trust boundary is
weakened to make a local model pass.

## Boundary

The local model has no Admission authority, no Claim write path, no risk
authority, no tools and no file access. It selects and interprets verified spans
and nothing else. Live model output never touches `assets/js/ai-ledger.js`; only
offline batch runs write the ledger, and this phase writes nothing at all.
