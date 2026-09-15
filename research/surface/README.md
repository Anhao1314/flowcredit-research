# FlowCredit Local Research Surface (UI-1.5)

A development-only, read-only, loopback-only web surface that renders the real
Research Memory (Claims, Evidence, Sources, provenance) through server-side
HTML. It exists so the project owner can experience the current information
architecture before any production frontend work is considered.

UI-1.5 is a visual-architecture pass only: it changes composition and styling
(workspace shell, dense rows, context panels, lineage lanes) without touching
any product semantics, data source, route contract, query behavior, or demo
isolation rule.

It is **not** a production frontend. It does not deploy, does not call any
model, does not fetch from the network in the browser, and never writes.

## Public demo (offline, synthetic, AI OFF)

For a fully reproducible public demo that needs no private Research Memory, no model runtime and no network, build the deterministic fixture and start the surface in public-demo mode. The subject (`Northstar Compute`), sources and figures are entirely synthetic.

```bash
# 1) Build a small deterministic Research Memory SQLite outside the repository
node research/surface/fixtures/public-demo/build.js /tmp/flowcredit-demo.sqlite

# 2) Serve it read-only with the PUBLIC DEMO / READ ONLY / AI OFF labels
FC_SURFACE_MEMORY_DB=/tmp/flowcredit-demo.sqlite \
FC_SURFACE_PUBLIC_DEMO=1 \
node research/surface/server.js
# open http://127.0.0.1:4317/
```

The builder is deterministic: re-running it emits the same Claims, Evidence, Sources, ids and timestamps (identical logical records and authority digest). Rendered pages never show the on-disk path or any machine-local path — only `Synthetic demo data`. The `?demo=1` locked What Changed preview is separate and is not required for the public demo.

## Run (real local Research Memory)

```bash
node research/surface/server.js
# optional port
node research/surface/server.js --port 4317
```

Then open:

```text
http://127.0.0.1:4317
```

Startup prints:

```text
FlowCredit Research Surface
http://127.0.0.1:4317
AI runtime: OFF
Mode: REAL
```

The server binds `127.0.0.1` only. Do not expose it beyond loopback.

## Routes

| Route | Page |
|---|---|
| `GET /` | Research Inbox (attention workspace) |
| `GET /claims` | Claims index (all recorded beliefs) |
| `GET /claim/:claimId` | Claim detail (belief, evidence, revision history, provenance) |
| `GET /evidence` | Evidence index (all recorded facts) |
| `GET /evidence/:evidenceId` | Evidence detail (fact, referenced-by Claims, source, admission review, provenance depth) |
| `GET /company/:subjectId` | Company context view (Claims, Evidence, Sources) |
| `GET /changes` | What Changed (honest real-mode state) |
| `GET /changes?demo=1` | Synthetic Claim Proposal preview (demo only) |
| `GET /favicon.svg` | Local favicon (also served at `/favicon.ico`) |

`GET` and `HEAD` only; any other method returns `405`.

## Index queries (deterministic GET, no JS)

```text
/claims?q=&category=&status=&subject=&sort=recent|oldest|category|status&page=1
/evidence?q=&source=<sourceId>&subject=&link=linked|unlinked&review=reviewed|unreviewed&sort=recent|oldest|category|page&page=1
```

- Search is a deterministic, case-insensitive substring match over recorded
  text (statements, categories, metrics, sections, locations, source titles,
  periods, raw/normalized values). It never searches hashes and never calls a
  model. An exact Evidence id match is honored as a secondary path.
- Filters are whitelisted; invalid values fall back to defaults instead of
  erroring. Filter options come from recorded data only.
- Pagination: page size 25 (Claims) / 20 (Evidence); `page` is clamped to the
  last page. Page links are plain `GET` links and reset to page 1 when filters
  change. `?demo=1` is preserved through filters and pagination.
- Claim/Evidence lists never show canonical ids in the row; ids move to each
  detail page's "Technical details" disclosure.

### Index return context (UI-1.6)

Detail links opened from a filtered index carry that index URL forward:

```text
/evidence?link=linked&sort=page
  → /evidence/EVID-…?from=%2Fevidence%3Flink%3Dlinked%26sort%3Dpage
  → "Back to Evidence" → /evidence?link=linked&sort=page
```

- `from` is validated by `sanitizeReturnTo()` in `query.js`: same-origin
  relative path, `/evidence` or `/claims` only, and the query is re-parsed and
  re-serialized from whitelisted values. External hosts, protocol-relative
  URLs, `javascript:`/`data:` values and path traversal are dropped, and the
  back link falls back to the plain index.
- The context is a navigation hint only — no storage, no session, no server
  state. An index URL with default filters adds no `from`, and a Claims page
  never returns to an Evidence URL (or the reverse).

## Attention layer (Inbox)

The Inbox leads with needs-attention blocks computed live from Research Memory
(never hard-coded): Evidence not yet linked to a Claim, Claims with thin
evidence coverage, recently recorded Evidence, plus a small "Research
completeness" summary (deeper admission provenance vs partial provenance,
latest activity). These are research workflow signals; they do not express
risk, quality or investment views.

## Workspace shell (UI-1.5)

```text
topbar        brand · current work scope · LOCAL / READ ONLY / AI OFF[/DEMO]
───────────────────────────────────────────────────────────────────────
left rail     Research Inbox · Claims · Evidence · What Changed
              (current item marked with aria-current + accent rail mark)
main zone     the page itself, max 1280px, no centered-article column
context zone  quiet side panels with real research state where useful
───────────────────────────────────────────────────────────────────────
status rail   AI OFF · data source · UTC · read-only development notes
```

- Desktop uses a persistent left rail; ≤899px the rail becomes a compact
  horizontal nav under the topbar (nothing hidden, no horizontal overflow).
- Detail pages (Claim / Evidence) use a main column + context column on
  desktop and stack on mobile. List pages use the full workspace width.
- The lineage lane `Source → Evidence → Claim → Change` appears on Claim
  detail; Evidence detail carries a provenance rail
  (`● Source → ● Admission review → ● Evidence → ○ SourceSpan`), where solid
  nodes are available trace steps and hollow nodes are stated as not
  available. Every visual state has adjacent text.
- The claim evidence-coverage meter is a count of linked Evidence records
  (one mark per record), labelled "not Claim confidence". Corpus strips in
  the Inbox show real linked/unlinked and deeper/partial provenance counts.
- Tokens (surfaces, hairlines, ink, one accent, support/counter/attention
  semantics) live at the top of `public/surface.css`. No inline styles are
  emitted anywhere, so the strict CSP is unchanged.

## Time display

Dates (`YYYY-MM-DD`) and instants (`YYYY-MM-DD HH:MM UTC`) are shown in UTC,
wrapped in `<time>` elements. There is no other time format on the surface.

## Demo mode

`?demo=1` renders 1–3 synthetic cases from the v0.12 locked benchmark
(never from Research Memory). Demo pages carry a persistent banner
(`Synthetic proposal examples — not Research Memory.`) and every case is
labelled with a single `Demo` badge plus its case id in the metadata.
Review buttons are UX previews only: they start `aria-pressed="false"`, write
nothing, persist nothing and reset on refresh.

## Data sources

| Purpose | Default | Override |
|---|---|---|
| Real Research Memory (SQLite, read-only) | `~/fc-agent/research-memory/v0.4-recovery-final.sqlite`, else `v0.2-coreweave.sqlite` | `FC_SURFACE_MEMORY_DB` |
| Demo locked cases | `~/fc-agent/research-claim-revision/locked` | `FC_SURFACE_DEMO_DIR` |

If the locked runtime is absent, demo mode falls back to the frozen artifact
`research/eval/claim-revision/pending-example.json`. If no Research Memory file
can be opened, pages render a friendly read-only notice instead of failing.

## Guarantees

- Read-only: SQLite opened with `readOnly: true` + `PRAGMA query_only=ON`;
  proposal stores are opened read-only as well. Verified by the no-mutation
  test (stores stay byte-identical across all routes).
- Loopback only (`127.0.0.1`), no file paths taken from the URL, no shell.
- Restrictive headers: `Content-Security-Policy: default-src 'none'` with only
  local directives (`style-src 'self'`, `script-src 'self'`, `img-src 'self'
  data:`, `form-action 'self'` so the server-rendered filter GET forms work),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `no-store`.
- All persisted strings are HTML-escaped before rendering.
- Zero client fetch: pages are server-rendered; browser JS only sets initial
  `aria-pressed` states and toggles local demo previews (no storage, no network).
- Zero dependencies, zero build, system font stack, no remote assets.
- AI runtime is never started and never imported. Ollama stays off.

## Tests

```bash
node --test research/surface-test/*.test.js
```

The same tests run under the repository release gate through
`agent/test/surface.test.js` (thin importer). Real-data assertions skip
automatically when the runtime Research Memory is not present.

## Known limitations (UI-1.5)

- No real ClaimRevisionProposal exists for real data yet; `/changes` states this.
- No `Needs Review` backend state exists; it is a demo-only preview control.
- Evidence → Admission → Source is the deepest available trace; sentence /
  table-cell SourceSpan joins are not exposed.
- One real company (coreweave) is under research.
- Review mutation is disabled in this surface (read-only / preview only).
- Search is deterministic substring matching — no semantic or AI search.
- No LLM-Wiki, no generated summaries, no open questions.
