# Evidence Analyst Contract Stabilization v0.7

Two separate pure calls replace full-schema model generation. Pass1 discovers `{quote,factKind}`. Trusted code assigns source/subject identity, hashes and lineage and rejects inexact/broad/instruction-like spans. Pass2 receives only verified quote/hash, coarse kind, span ID and minimal source metadata; it returns category/metric and raw literal value/unit/period strings. Conservative deterministic parsing constructs the unchanged v0.5 EvidenceProposal. The unchanged validator and promotion boundary remain mandatory. No Admission/Memory write capability exists.

```
node --test research/analyst-staged-test/*.test.js
node research/analyst-staged/cli.js staged-dev coreweave --real true
node research/analyst-staged/cli.js staged-eval coreweave --real true --provider deepseek
```

Real calls are explicit opt-in and require the same configured DeepSeek path/model as v0.6. Optional paired `--index`, `--memory`, `--results` flags; runtime outputs must be external. Full immutable spans/facts/runs and raw responses live only outside Git in private runtime files. Sanitized summaries omit raw output and source quotes but retain hashes, parser results, status/reasons and metadata. Existing formal Memory is opened read-only and Claims/revisions payload hashes checked before/after.

Schemas and taxonomies are internal v0.7 contracts; no public API or v0.5 schema version changes. Prompts are separate `evidence-span/v1`, `fact-interpretation/v1`; original `evidence-analyst/v1` remains unchanged. Native structure is requested through the existing adapter. The only optional wrapper normalization is a single complete literal JSON fence with no external content or nested fence, followed by strict schema validation. Raw output/hash and wrapper decision are retained. No missing fields, root objects, commentary or semantic values are repaired.

Numeric precision uses decimal coefficients and explicit scale, with unsupported precision/overflow rejected. Currency and scale must bind to the numeric literal in the quote, not be inferred from category or unrelated amounts. Period parsing supports explicit month-end annual/three/six-month windows and as-of dates. Q labels without an explicit calendar remain unknown; explicit calendar Q labels remain subject to original validator's explicit-date requirements. FY alone and month-only dates remain unknown; fiscal calendar/end day is never invented. General table extraction is out of scope; original12 multi-column table Gold cases remain in16-case full-correct denominator and are classified as mapping limitations.

See [pre-code audit](REPOSITORY_AUDIT.md), [registered gate](../eval/evidence-analyst-staged/phase-gate.json), [delivery](../../docs/evidence-analyst-contract-stabilization-v0.7.md).
