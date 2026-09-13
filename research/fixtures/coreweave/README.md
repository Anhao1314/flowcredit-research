# CoreWeave reviewed corpus

This fixture contains reviewed factual observations, not investment recommendations or an exhaustive issuer analysis.

| Publication | Identity | Date | Retrieval/hash |
|---|---|---|---|
| [Official annual PDF containing 2025 10-K](https://s205.q4cdn.com/133937190/files/doc_financials/2025/ar/2025-Annual-Report.pdf) | 0001769628-26-000104 | Embedded filing 2026-03-02, FY2025 | 3,412,597 PDF bytes; original SHA-256 recorded |
| [IR-linked Q2 2026 10-Q](https://d18rn0p25nwr6d.cloudfront.net/CIK-0001769628/9f708637-612f-4da7-bef2-4a4b667f9d64.pdf) | 0001769628-26-000366 | Signed 2026-08-11, June 30 quarter | 1,167,386 PDF bytes; original SHA-256 recorded |
| [Q2 earnings release, SEC Exhibit 99.1](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000362/coreweave2q26earningspress.htm) | 0001769628-26-000362-ex99.1 | 2026-08-11 | Reviewed web text; direct bytes returned HTTP 403; original hash explicitly unavailable |

Annual PDF discovered via [official annual reports](https://investors.coreweave.com/annual-reports/default.aspx); quarterly PDF via [official IR overview](https://investors.coreweave.com/overview/). The release is also linked from [company IR](https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Second-Quarter-2026-Results/default.aspx). These are three publications by the same issuer, not three independent verification domains.

The annual checksum covers the full IR PDF including its wrapper, **not** the SEC HTML filing. Its documentDate identifies the embedded 10-K; the wrapper publication date is not asserted. Quarterly documentDate is the signature date. Evidence `page` is one-based PDF page; `location` identifies the printed filing page, table and period. HTML release evidence has null page and an explicit section/table locator. Reviewed numeric table facts and our own factual paraphrases are retained; full documents are not committed.

`observations.json` records raw USD millions/billions and exact period/scope/metric. Extraction performs only declared unit scaling or identity conversion. Quarter/year amounts are never prorated. Anonymous A/B/C labels do not establish persistent identities or map Q2 customer A to Microsoft. Backlog (~104 billion USD) and unsatisfied RPO (103.7 billion USD) are separate disclosed measures. Cash PP&E/software purchases are cash-flow outflows, not automatically management-defined total CapEx. Gross margin/leverage/valuation/industry context are not extracted in this small corpus; numeric guidance is not present in the selected release (which points to the call). No missing fact is invented.

`claims.json` declares four numerical predicates and a 365-day stale window. They express observed concentration, operating margin, cash flow and annual growth only; confidence is extraction confidence, not investment conviction. All generated Source/Evidence/Claim/Mapping records are available through `coverage.js coreweave --json`.

To update: review primary documents, record actual retrieval time and byte checksum (or explicit failure), preserve locators and raw units, update explicit predicates only with justification, then run Research and all existing gates. The CLI itself makes no network calls and has no implicit “latest” fetch.
