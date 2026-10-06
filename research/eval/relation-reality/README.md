# Relation Reality Benchmark v0.2

This experiment answers a narrow question:

> Does a provenance-aware structured SemanticFrame path outperform the existing prose/regex baseline on explicit facts from real primary-source research material?

## Corpus

The benchmark reuses the existing reviewed CoreWeave corpus:

- 3 primary publications
- 32 reviewed Observations
- 4 explicit numeric-predicate Claims
- 128 pairwise Evidence × Claim evaluations

The source set includes a 2025 Form 10-K, Q2 2026 Form 10-Q and Q2 2026 SEC-filed earnings release. Source URLs and available document-byte hashes remain in the benchmark output.

## Gold authority

No LLM writes labels.

The structured oracle uses only:

1. recorded metric identity,
2. canonical unit family,
3. recorded numeric value,
4. explicit Claim comparator and threshold.

That makes this a **structured correctness benchmark**, not a general semantic benchmark.

## Compared systems

- **text baseline** — legacy prose reader + Compatibility + deterministic Relation baseline
- **SemanticFrame runtime** — recorded-field projection + structured Compatibility + deterministic predicate Relation

Baseline runtime failures are recorded as ERROR + null instead of aborting or being silently repaired out of the experiment.

## Measured result

| Runtime | Exact | Directional correct | Unsafe direction | Runtime errors |
| --- | ---: | ---: | ---: | ---: |
| Text baseline | 66 / 128 (51.56%) | 1 / 5 (20%) | 8 | 2 |
| SemanticFrame | 128 / 128 (100%) | 5 / 5 (100%) | 0 | 0 |

Measured result artifact: [results.json](results.json).

CI recomputes both summaries from the source fixtures and requires exact equality with the archived artifact.

## Interpretation boundary

128 / 128 means the structured runtime exactly reproduced this benchmark's explicit structured oracle.

It does **not** mean:

- 100% open-ended financial-language accuracy,
- arbitrary filing understanding,
- general causal reasoning,
- production accuracy,
- external benchmark parity.

Only five pairs in this corpus are directional under the explicit structured oracle. A much larger independently human-labeled semantic Relation benchmark remains necessary.

## Run

~~~bash
node research/eval/relation-reality/cli.js
~~~

For regression tests:

~~~bash
node --test research/semantic-frame-test/*.test.js
~~~
