# Claim-impact provenance maintenance

The locked claim-impact benchmark is bound to two different questions, and they are now answered by two different mechanisms.

## Historical repository snapshot

`research/eval/claim-revision/phase-gate.json` records `frozenHashes` for 432 repository paths taken from commit `bb66cc1` at registration. That record is **byte-immutable**: it is never rewritten to follow later repository edits, and `cli.js:frozenHashes()` remains the function that produced it. Its truth is still checkable, and now more strongly than before: `historicalSnapshot()` replays every recorded path from the git blobs of `bb66cc1`, so the historical claim is verified against the commit itself rather than against today's working tree.

## Active semantic conformance scope

`research/eval/claim-revision/provenance-maintenance.json` declares which current state may drift and which must not.

- **Semantic inputs** — pipeline code, contract and schemas, the model prompt, the locked fixture set, the development run, the phase gate and result artifacts, the research modules the pipeline imports, and the pinned `agent` dependency manifests.
- **Repository presentation and unrelated product code** — everything else, including `README.md`, `.gitignore`, public documentation and test surfaces.

A file is semantic when it is an input of the claim-impact pipeline; test surfaces are excluded by construction because the repository keeps tests in sibling `*-test` directories. No rule uses a repository-wide wildcard.

## What the check does

`conformance.js` recomputes, from the current tree:

1. drift of frozen paths inside the semantic scope — any hit fails conformance;
2. the gate's own content bindings — ten module hashes, prompt hash, locked-set hash, development hash — so a change to pipeline code, the prompt or the fixture set fails even though those files postdate `bb66cc1`;
   Module and prompt bindings hash the file text, exactly as the gate recorded them. The locked set and the development run are hashed as parsed JSON, exactly as `register()` did, so formatting-only edits pass while any content change fails.
3. coverage — the measured import closure of the pipeline must stay inside the declared scope, so a new dependency outside it is a visible gap rather than a silent one;
4. repository drift outside the scope, which is **reported and never blocking**.

`schemaHash` stays asserted by the locked-artifact test, which builds the schemas from `contract.js`.

## Reading the result

```
status = HISTORICAL_GATE_MISMATCH   gate record no longer matches the maintenance record
       | SEMANTIC_DRIFT             a semantic input changed
       | CONTENT_BINDING_MISMATCH   pipeline code, prompt or fixture set changed
       | RESULT_BINDING_MISMATCH    results.json no longer binds the gate
       | SCOPE_COVERAGE_GAP         a dependency sits outside the declared scope
       | CONFORMANT                 semantic inputs intact, repository drift reported
```

Run it from the repository root:

```bash
node --test agent/test/claim-revision-conformance.test.js
```

## Changing the boundary

Widening or narrowing `scopeRules` is a normal, reviewable edit of the maintenance record — that is the point of keeping the scope in one declared place. Changing `phase-gate.json` or `results.json` is not: both are historical artifacts, and re-registering the gate is a separate, explicitly authorized act that also requires regenerating the locked result.
