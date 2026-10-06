# v0.2C Source Audit — Dataset Locked, Not Evaluated

Status: `DATASET_LOCKED_NOT_EVALUATED`

This document records source selection and dataset construction facts only. It contains **no R2 predictions or score**.

## Selected primary filings

| Issuer | Sector role | Form | Period end | SEC accession |
| --- | --- | --- | --- | --- |
| Costco Wholesale Corporation | Retail | 10-K | 2025-08-31 | 0000909832-25-000101 |
| JPMorgan Chase & Co. | Banking / financial services | 10-K | 2025-12-31 | 0001628280-26-008131 |
| Salesforce, Inc. | Enterprise SaaS | 10-K | 2026-01-31 | 0001108524-26-000060 |
| Caterpillar Inc. | Industrial machinery | 10-K | 2025-12-31 | 0000018230-26-000008 |

All sources are primary SEC filings and all four issuers are excluded from prior FlowCredit relation benchmarks.

## Construction rules followed

- exactly 8 cases per issuer;
- exactly 32 cases total;
- bucket allocation exactly matches the pre-frozen v0.2C protocol;
- evidence text is a concise paraphrase or arithmetic summary of filing facts;
- all arithmetic summaries are derived only from values present in the cited filing;
- each case retains a source locator and a human annotation basis;
- labels were assigned before any R2 execution on this dataset.

## Frozen bucket counts

| Bucket | Cases |
| --- | ---: |
| numeric_or_trend | 8 |
| hard_negative | 4 |
| second_order | 4 |
| causal_attribution | 4 |
| scope_or_metric_binding | 4 |
| insufficient_context | 4 |
| mixed_hard | 4 |
| **Total** | **32** |

## Lock

Dataset:

`research/benchmark/data/real-sec-fresh-blind-v0.2c.json`

Dataset Git blob SHA:

`5602c516d3333f1fde665738fc8385bcd7b8a6d0`

Protocol Git blob SHA:

`868dcd2322d68fbe9af56347a5b8257c0d6bc7d1`

The next permitted step is integrity validation only. R2 evaluation happens only after the lock is merged.
