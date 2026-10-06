# Relation Reality Benchmark v0.2

This experiment answers a narrow question:

> Does a provenance-aware structured SemanticFrame path outperform the existing prose/regex baseline on explicit facts from real primary-source research material?

## Corpus

The benchmark reuses the existing reviewed CoreWeave corpus:

- 3 primary publications
- 32 reviewed Observations
- 4 explicit numeric predicate Claims
- 128 pairwise Evidence × Claim evaluations

The documents include a 2025 10-K, Q2 2026 10-Q and Q2 2026 SEC-filed earnings release. Source URLs and available byte hashes stay attached to the benchmark output.

## Gold authority

No LLM writes labels.

The structured oracle uses only:

1. recorded metric identity,
2. canonical unit family,
3. recorded numeric value,
4. explicit Claim comparator and threshold.

That makes this a **structured correctness benchmark**, not a general semantic benchmark. It is deliberately honest about the distinction.

## Compared systems

- **text baseline** — current legacy prose reader + Compatibility + deterministic Relation baseline
- **semantic runtime** — explicit SemanticFrame + structured Compatibility + deterministic predicate Relation

## Run

```bash
node research/eval/relation-reality/cli.js
```

The regression suite recomputes the experiment from source fixtures. A committed result artifact is added only after CI has produced and verified the measured numbers.
