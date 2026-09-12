# FlowCredit Public Deployment Checklist

Target release: `external-alpha-v0.1`

Status: **Deployed and publicly verified.** The deterministic External Alpha API is live over HTTPS at `https://flowcredit-api.onrender.com` (Render Web Service). The public checks below were refreshed on 2026-09-13 against the deployed host; items that need the production API key are marked so they are not mistaken for credentialed verification.

> Historical baseline (2026-09-10): this checklist originally read "Git release frozen and published; no public cloud service or HTTPS endpoint has been created", with every cloud item unchecked. That was accurate before the first deployment. It is kept here as the starting point of the sequence below; the infrastructure items were completed afterwards.

## Git Baseline

- [x] Release commit `d57c4446b99d793f0ec80a321be4fd73fe8ac9d9` exists on `main`.
- [x] Annotated tag `external-alpha-v0.1` exists and points to the verified release commit.

Deploy the frozen tag, not a later documentation-only `main` commit. Do not move, delete, or recreate the release tag.

## Cloud and Runtime

- [x] Public cloud Docker Web Service created — Render Web Service, serving release `external-alpha-v0.1.1`.
- [x] HTTPS active on the platform-generated host — verified 2026-09-13 (TLS terminates at the platform edge; the application now also sends `Strict-Transport-Security`).
- [ ] Exact tagged Docker release deployed — the host reports `external-alpha-v0.1.1`; compare the deployed image digest with the release tag before the Finch contract test.
- [ ] `HOST=0.0.0.0`, `PORT`, `AUTH_ENABLED=true`, managed `FLOWCREDIT_API_KEY`, `INVOCATION_TIMEOUT_MS`, `RATE_LIMIT_*`, `TRUST_PROXY` and `IDEMPOTENCY_*` configured — these live in the platform dashboard. External probes confirm the API is reachable and unauthenticated writes return 401, but the individual values are not observable from outside; re-read them before any redeploy.

DeepSeek is optional for the first deterministic External Alpha. `DEEPSEEK_API_KEY` may remain unset; `/health` reports `llm.enabled=false` on the current deployment.

## Public Contract

Probed 2026-09-13 against `https://flowcredit-api.onrender.com`:

- [x] `GET /health` publicly returns HTTP 200 JSON without a redirect.
- [x] `GET /ready` returns HTTP 200.
- [x] `GET /api/v1` returns HTTP 200.
- [x] Unauthenticated `POST /api/v1/assess` returns HTTP 401 with the canonical error envelope.
- [x] Invalid Bearer token returns HTTP 401.
- [x] `GET /fc/ai/v0.3/schema` returns the Draft 2020-12 intake schema (10,214 bytes).
- [ ] Valid representative assessment returns HTTP 200 — requires the production API key.
- [ ] Output Schema passes Draft 2020-12 validation on a live response — requires the production API key.
- [ ] Encoded response is no more than 65,536 bytes — the same build returned 4,932 bytes locally; confirm once with a live credentialed call.
- [ ] `inputFingerprint` and `assessmentFingerprint` are present — confirmed locally against the same build; confirm once with a live credentialed call.
- [ ] Same idempotency key and same payload replays the original logical response — requires the production API key.
- [ ] Same idempotency key with changed payload returns HTTP 409 `IDEMPOTENCY_CONFLICT` — requires the production API key.

## Security and Logs

- [x] No populated `.env` file, private key or API-key-like value exists in the repository — asserted by `npm run verify:release` (secret and release-artifact audit).
- [ ] No API key is present in the built image or in any exported command history — the Dockerfile copies only `package.json`, `package-lock.json`, `config`, `contracts`, `scripts` and `src`; confirm the image contents before publishing.
- [ ] Container port is reachable only through the platform gateway or trusted private network.
- [ ] Public logs contain only request ID, status, duration, hashes and error category — the logger writes an allowlisted field set; confirm against real platform logs.
- [ ] Logs do not contain `FLOWCREDIT_API_KEY`, Authorization values, `DEEPSEEK_API_KEY`, complete financial payloads, raw evidence or private keys.

## Finch Handoff

- [ ] Submission Invocation URL replaced with `https://<REAL_PUBLIC_HOST>/api/v1/assess`.
- [ ] Submission Health URL replaced with `https://<REAL_PUBLIC_HOST>/health`.
- [ ] Public smoke test rerun against the real HTTPS host.
- [ ] `npm run verify:finch-submission` passes after URL replacement.
- [ ] Pricing selected.
- [ ] Finch Publisher submission completed.
