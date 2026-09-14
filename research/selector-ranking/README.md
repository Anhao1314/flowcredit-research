# Selector ranking v0.11.2

Independent research experiment; no frozen retrieval/grounding/validation/Claim code changes.

Read [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md), [DELIVERY.md](DELIVERY.md), and
[the phase documentation](../../docs/evidence-selector-ranking-v0.11.2.md).

- `audit.js`: verifies historical selection counts and offline K=8 ranking metrics.
- `contract.js`: dynamic ranked-handle contract with exact resolution and max three.
- `layer.js`: retrieval / old multi-select / ranked selection, then ordered bounded conversion.
- `cli.js dev --opt-in`: A/B/C on answer-free precise development labels; completed cases resume.
- `security.js --opt-in`: minimal table/narrative hostile-source tests.
- `cli.js locked --opt-in`: only the registered policy on locked 16, drift-checked resume.
- `report.js`: renders the finished artifact into the phase document and A–U delivery report.

All inference uses the existing local provider. Runtime databases and logs live outside the
repository under `~/fc-agent/research-selector-ranking`; portable artifacts live in
`research/eval/selector-ranking`. No remote inference or embedding calls. Do not modify the
registered gate/prompt or re-run a fresh locked session. The existing run resumes completed
cases and can assemble results without repeated model calls.

Start the existing local runtime in a separate terminal before explicitly resuming:

```bash
OLLAMA_NO_CLOUD=1 OLLAMA_MODELS="$HOME/fc-agent/ollama-models" "$HOME/fc-agent/tools/ollama/ollama" serve
```

This benchmark's runtime was stopped after completion to release memory. Completed
locked cases and receipts remain available; assembling `report.js` needs no runtime.
