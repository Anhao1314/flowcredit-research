# Target-bound evidence conversion v0.11.3

Read [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md) and [DELIVERY.md](DELIVERY.md).
This is an isolated research layer; original Candidate, SourceSupport, Validator,
Grounding, parsers, ranking and retrieval implementations remain frozen.

Development is offline. Do not start Ollama during diagnosis or fixture work.

```bash
node --test research/target-conversion-test/*.test.js
node research/target-conversion/cli.js dev
node research/target-conversion/replay.js
```

After all repository gates pass, register exactly once with `cli.js register`.
Then start the existing local runtime with cloud disabled in a separate terminal:

```bash
OLLAMA_NO_CLOUD=1 OLLAMA_MODELS="$HOME/fc-agent/ollama-models" "$HOME/fc-agent/tools/ollama/ollama" serve
caffeinate -i node research/target-conversion/cli.js locked --opt-in
node research/target-conversion/report.js
```

The registered v0.11.3 run already exists. Do not create a fresh locked run, rewrite
its gate, tune its prompt on Gold or re-run retrieval/ranking. Completed cases
resume from `~/fc-agent/research-target-conversion/locked/run.json`; code, schema,
provider, history and gate drift are rejected. No within-case checkpoint is
claimed. Runtime files/logs/databases stay outside the repository.

Research requests have no answers or support identifiers. Their evaluator-only
link to locked cases lives in the runner; actual ResearchIntent ids and sidecars
use production categories/concepts and period-local request dimensions. Gold
truth only scores completed attempts and never changes fallback or acceptance.

Only `supported` target proposals with validated explicit facts can form a
Candidate. `not_supported`, `ambiguous`, mismatched row/period/category/concept,
unknown parse or Validator rejection fall through ranks 1, 2 and 3 only. Stop
after the first target-bound legal Candidate; no Evidence/Admission/Claim writes.

`report.js` requires only finished artifacts and no model runtime. Ollama is
stopped after the benchmark to release memory.
