# Pre-code repository audit

Completed before ranking prompt authoring. Baseline d05ca27. Historical decisions and artifacts remain unchanged.

## Historical selection breadth

|Version|Selections|Target hits|Non-target|Precision|Breadth/hit correlation|
|---|---:|---:|---:|---:|---:|
|v0.11|81|12|69|0.1481|0.7815|
|v0.11.1|52|8|44|0.1538|0.6437|

Correlation is descriptive, not causal. Broad outputs mechanically offer more chances to include a target. They do not establish rank improvement. Historical Hit@1 and target rank are unavailable: the contract has no relevance ordering.

v0.11 hits with 6–8 selections: GOLD-02, GOLD-03, GOLD-04, GOLD-09, GOLD-10, GOLD-13, GOLD-14, GOLD-15, GOLD-16.

|Case|Selections|Hit|Non-target|
|---|---:|---:|---:|
|GOLD-01|3|1|2|
|GOLD-02|7|1|6|
|GOLD-03|8|1|7|
|GOLD-04|8|1|7|
|GOLD-05|0|0|0|
|GOLD-06|0|0|0|
|GOLD-07|4|1|3|
|GOLD-08|0|0|0|
|GOLD-09|7|1|6|
|GOLD-10|7|1|6|
|GOLD-11|5|0|5|
|GOLD-12|4|1|3|
|GOLD-13|7|1|6|
|GOLD-14|7|1|6|
|GOLD-15|7|1|6|
|GOLD-16|7|1|6|

v0.11.1 hits with 6–8 selections: GOLD-02, GOLD-03.

|Case|Selections|Hit|Non-target|
|---|---:|---:|---:|
|GOLD-01|0|0|0|
|GOLD-02|7|1|6|
|GOLD-03|7|1|6|
|GOLD-04|5|1|4|
|GOLD-05|0|0|0|
|GOLD-06|0|0|0|
|GOLD-07|4|1|3|
|GOLD-08|2|0|2|
|GOLD-09|5|1|4|
|GOLD-10|3|1|2|
|GOLD-11|5|0|5|
|GOLD-12|2|0|2|
|GOLD-13|3|1|2|
|GOLD-14|3|0|3|
|GOLD-15|3|1|2|
|GOLD-16|3|0|3|

## Frozen retrieval-only baseline

Computed offline from v0.11 retrieval-benchmark.json; ranks outside K=8 become misses (MRR zero). No new retrieval or parameter changes.

dev-coreweave-v0.3: 19 cases; Hit@1=0.8947, Hit@3=1.0000, MRR=0.9474.
dev-coreweave-v0.3-answerfree: 19 cases; Hit@1=0.4737, Hit@3=0.8421, MRR=0.6618.
locked-16: 16 cases; Hit@1=0.0625, Hit@3=0.4375, MRR=0.3075.

Locked target ranks: GOLD-01=6, GOLD-02=3, GOLD-03=2, GOLD-04=5, GOLD-05=2, GOLD-06=6, GOLD-07=7, GOLD-08=1, GOLD-09=3, GOLD-10=2, GOLD-11=None, GOLD-12=7, GOLD-13=6, GOLD-14=8, GOLD-15=7, GOLD-16=2.

## Interface and conversion audit

Read span-selection-v2.txt, span-selection-handles-v3.txt, selection-output-handles.schema.json, handles.js, evidence-support/layer.js, evidence-support/gold.js and both raw selection receipts. The existing selection prompt asks for page facts and supplies no requested question. It cannot be interpreted as a target ranking task. Handles resolve exactly to the frozen candidate order. Existing interpretation, validateFactV2, validateSupportV2 and promote establish Candidate legality; a valid unrelated fact is not target success. Gold expectedSpanIds remain scoring-only.

Development primary set is the existing answer-free retrieval set; legacy dev questions contain literal answers and are reported only as a biased supplementary baseline. Development labels include page-fallback cases, which must be excluded from precise ranking comparisons and explicitly reported. Locked Gold is inspected only for historical audit and offline baseline, never prompt tuning.

Qwen currently has no measured ranking uplift: historical multi-select outputs have no relevance-order contract. A new bounded ordered comparison is necessary.

## Follow-up conversion audit (during implementation)

The historical `evidence-support/eval.js` promotion loop sorts validated proposals by Gold target membership before conversion, and its `validatorFalseAccepts` summary is a literal zero. Historical conversion and that summary therefore do not prove unbiased rank-order conversion or an independently measured false-accept rate. They remain unchanged. v0.11.2 never supplies Gold to selection, interpretation or fallback; Gold only scores completed rank-ordered attempts. Current falseAccept counts any converted Candidate that fails rechecking with the unchanged support/fact validators; target-semantic conversion is a separate stricter Gold measure. A wrong-category or unrelated valid fact is never promoted as Gold target success.
