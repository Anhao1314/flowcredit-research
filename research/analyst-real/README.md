# Real Model Validation v0.6

This module measures the existing v0.5 Analyst using direct, faithful Gold Chunks. It does not change prompt v1, validator, retrieval, Memory, Admission, UI or public API. See [delivery](../../docs/research-evidence-analyst-real-validation-v0.6.md).

Offline tests: `node --test research/analyst-real-test/*.test.js`.

Explicit real evaluation:

```
node research/analyst-real/cli.js analyst-real-eval coreweave --real true --provider deepseek
node research/analyst-real/cli.js analyst-case GOLD-01
node research/analyst-real/cli.js analyst-failures REAL-1234567890
```

Optional paired flags: `--index PATH --memory PATH --results DIRECTORY`. Runtime and result writes must stay outside the repository. Existing formal CoreWeave Memory is opened read-only; the provider never receives Memory or Claims. Credentials come from `DEEPSEEK_API_KEY` or the established private external credential config. Missing credentials return `REAL_MODEL_BENCHMARK_BLOCKED`. No mock substitution. Generic hosts can inject any pure v0.5 provider; only the built-in connector is DeepSeek.

The adapter requests native JSON Schema by default. The [official Responses endpoint](https://api-docs.deepseek.com/api/create-response/) documents schema formatting; actual conformance remains tested by the unchanged local parser. Development protocol probes observed fenced JSON and a wrong root shape despite successful responses. `FC_REAL_STRUCTURED_MODE=strict_json_text` is an explicit development alternative, not automatic repair. Neither mode strips Markdown, repairs JSON, or substitutes empty arrays. Prompt v1 stays pinned. Model snapshot/fingerprint and provider-reported cost are nullable. No prices are hardcoded.

Full run raw output and input snapshots are private external artifacts. Committed summaries omit raw output and source quote bodies, retain output/quote hashes, proposal fields, validation findings, separate Gold comparison, case IDs, receipts, tokens and latency. Source-only diagnostic anchors are public filing excerpts, not sensitive provider payloads. Gold accuracy does not adjudicate legitimate facts outside the locked reference set; unknown records and table mapping limitations are explicit. Negative false-positive rate uses schema-valid negative cases; invalid cases do not count as abstentions.

The offline harness can use explicitly labelled test-only cases. It never reports them as a real evaluation. Normal CI does not contact a model.
