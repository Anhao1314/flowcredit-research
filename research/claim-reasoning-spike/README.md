# Claim Reasoning Engineering Spike

Decides the next-generation Claim Relation architecture after v0.12's `STAY ON CLAIM REASONING`. Research only: no production pipeline, contract or memory authority is touched, and nothing here is imported by production code.

Start with `FLOWCREDIT_V012_AUDIT.md` (why v0.12 failed), then `RESULTS.md` (what was measured), then `docs/adr/claim-relation-engine-v0.12-spike.md` (the decision).

## Layout

```
dev-set.json                 41 frozen synthetic relation pairs + 4 conflict bundles
lib/text.js                  domain-general extraction (quantities, units, periods, comparators, hedges)
lib/deterministic.js         rules R1-R11 (numeric, unit, period, subject/scope, hedge/truncation, table arithmetic)
lib/hybrid.js                layered routing + NLI decision + bundle aggregation
lib/metrics.js               accuracy, macro-F1, per-class, false support/counter rates
lib/contract.js              frozen prompt loading + strict model-output parsing
nli/run_nli.py               MiniCheck + MNLI runner (MPS/CPU, batch + per-pair latency)
cli.js                       freeze | qwen --opt-in [--limit N] | evaluate
providers/                   reserved for a future provider split; the spike uses cli.js + nli/
artifacts/                   preregistration, model outputs, results, cleanup record
```

## Running it

```sh
# 1. freeze the benchmark (writes artifacts/preregistration.json; immutable afterwards)
node cli.js freeze

# 2. lightweight verifier (models already cached under ~/fc-agent/tools/nli-spike/hf-cache)
~/fc-agent/tools/nli-spike/venv/bin/python nli/run_nli.py --devset dev-set.json --out artifacts/nli-output.json

# 3. reasoning fallback (loopback Ollama; requires --opt-in and a running local server)
OLLAMA_MODELS=~/fc-agent/ollama-models ~/fc-agent/tools/ollama/ollama serve &
node cli.js qwen --opt-in            # add --limit 3 for a smoke test
pkill -f "ollama serve"

# 4. recompute all architectures from stored outputs
node cli.js evaluate
```

Offline regression (also wired into the agent suite): `node --test research/claim-reasoning-test/*.test.js`.

## Boundaries

- Runtime data (venv, HF cache, Ollama models) lives outside the repository under `~/fc-agent/`; the repo keeps code, frozen data and results only.
- The historical locked 18 claim-impact cases are neither re-run nor tuned against; thresholds were calibrated on this dev set alone.
- External repositories studied for this spike live under `~/fc-research-external/` and are never executed or vendored (see `EXTERNAL_REPOS_AUDIT.md`).
- No paid API, no cloud model, no fine-tuning.
