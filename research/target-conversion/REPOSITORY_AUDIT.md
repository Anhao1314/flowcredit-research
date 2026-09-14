# Target-bound conversion pre-code audit

Baseline c2e4e18 verified clean and complete; pushed to origin/main. Audit is entirely offline. Historical v0.11.2 artifacts and SELECTOR READY decision are unchanged. Qwen and embedding remain off.

## Reachability and losses

Retrieval ceiling 15/16; frozen ranked Top-3 ceiling 14/16; strict conversion 5/16; post-ranking loss 9/14 reachable. Any legal Candidate 11/16; valid-but-wrong-target 6/16. No denominator changes.

|Case|Primary loss|Evidence|
|---|---|---|
|GOLD-01|CATEGORY_ERROR|Geographic revenue labelled generic revenue; value/unit/period correct.|
|GOLD-04|INTERPRETATION_ERROR|Direct cost-of-revenue table cell incorrectly marked derived and revenue; deterministic numeric/period known.|
|GOLD-06|COMPOUND_LITERAL_ERROR|Three/six-month respectively binding is compound; frozen period parser cannot parse the joint phrase and numeric risk_disclosure remains inadmissible.|
|GOLD-08|TARGET_MISMATCH|Early legal revenue amount stops before rank-3 growth percentage in a two-metric/two-period sentence.|
|GOLD-09|INTERPRETATION_ERROR|Explicit geographic revenue marked derived; fallback accepts unrelated geographic assets.|
|GOLD-10|PARSER_ERROR|Numeric literal includes approximately; category revenue_concentration differs from intended customer_concentration.|
|GOLD-12|INTERPRETATION_ERROR|Explicit technology/infrastructure expense mislabelled revenue and derived.|
|GOLD-13|TARGET_MISMATCH|Accounts-receivable percentage at rank 1 stops before rank-3 Q2 customer revenue share.|
|GOLD-14|TARGET_MISMATCH|Accounts-receivable percentage at rank 1 stops before rank-2 Q2 customer revenue share.|

Full 16-case traces including Research target, unchanged Gold expected facts, retrieval/ranking ranks, selected SourceSupport, stored interpretation, parser verdict, validator findings and produced Candidate are in ../eval/target-conversion/historical-traces.json. Gold lives exclusively in evaluator/audit artifacts.

## Table path

12 table cases: 10 reachable, two retrieval/ranking misses. Table identity, row/header/cell/unit context already carry the literal. Most loss is incorrect category, explicit-vs-derived interpretation, wrong period or premature unrelated fallback. A separate target gate can reject known row/concept or time-window mismatches before any model call. Unknown row semantics remain a constrained LLM proposal, never a deterministic guess.

## Text path

Four text cases: RPO succeeds; growth has both absolute and percentage changes and two years; customer concentration copied approximately with the literal; sensitivity combines three/six-month periods and two amounts with respectively. Source sentence boundaries must stay unchanged. Exact local literal/period anchors may help, but the immutable parser and validator remain final authority. The numeric risk-disclosure prohibition makes the sensitivity case a likely remaining validator reject; never coerce risk_disclosure into actual to gain conversion.

## ResearchIntent design constraints

Use existing production category vocabulary and explicit metric/concept plus requested period, geography/customer-label dimension when the research request names it, actual/guidance and explicit/derived constraints. No expected values, span IDs, Evidence IDs, Gold references or normalized answers. Anonymous customer labels are period-local research dimensions, not persistent real-world identities. The old equivalent ranking query is retained without any ranking rerun.

A proposed semantic match is insufficient: enforce category/concept, request dimensions where metadata is explicit, exact support identity, known numeric/unit/period, target time constraints and actual/derived flags before Candidate creation. Bind with a sidecar to avoid altering the frozen Candidate schema. Do not stop at an unrelated legal fact.

## Evaluation protections

Do not replay hidden interpretation at unvisited ranks as if historically observed. Missing outputs remain unavailable. The 9 losses are diagnostic classifications of preserved receipts, not prompt tuning on locked cases. Develop one interpretation prompt on independent synthetic fixtures, freeze it before one real locked interpretation-only run over stored ranks. Historical parser/validator decisions are never rewritten.
