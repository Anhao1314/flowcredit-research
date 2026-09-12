# Development Isolation

This repository (`Anhao1314/flowcredit-v2`) is a **development and testing workspace**. It does not deploy, publish or host anything, and it has no connection to the production surfaces.

## Production surfaces (owned by the other repository)

Both surfaces belong to `Anhao1314/flowcredit` and redeploy automatically on every push to that repository's `main`:

| Surface | URL | Trigger |
| --- | --- | --- |
| Risk API | `https://flowcredit-api.onrender.com` | Push to `Anhao1314/flowcredit` `main` (Render GitHub integration) |
| Static demo | `https://anhao1314.github.io/flowcredit/` | Push to `Anhao1314/flowcredit` `main`, path `/` (GitHub Pages) |

Nothing in this repository is wired to either surface. Development changes here stay here until someone deliberately ports them to the production repository.

## How the boundary is enforced

- **Git remotes** — `origin` is this development repository. The production repository is `upstream` with its push URL disabled, so `git push upstream` fails before any network call is made.
- **Local hook** — `.git/hooks/pre-push` refuses any push whose remote name or URL resolves to the production repository, including direct URL pushes.
- **Repository guard** — `npm run check:isolation` (`agent/scripts/check-dev-isolation.js`) fails when a deployment descriptor, a deploy step, or a write-scoped workflow token appears. It runs in CI on every push.
- **No credentials** — this repository has no Actions secrets and no environments, and workflow tokens default to read-only.
- **GitHub Pages** — not enabled on this repository and it must stay disabled.

## Rules for this repository

1. Do not enable GitHub Pages.
2. Do not add deployment descriptors such as `render.yaml`, `vercel.json`, `netlify.toml`, `fly.toml`, `Procfile`, or Kubernetes/Helm manifests.
3. Do not add deploy steps or third-party deployment actions to workflows.
4. Do not add repository secrets or environments.
5. Do not connect a platform (Render, Vercel, Netlify, Fly, Railway, ...) to this repository.

The Dockerfile, compose file and reverse-proxy example are retained for local and portable testing only. They are exercised by `npm run verify:release` and are not attached to any deployment.

## Verifying the boundary

```bash
git remote -v                                        # origin = flowcredit-v2, upstream push disabled
gh api repos/Anhao1314/flowcredit-v2/pages           # 404 = Pages disabled
gh api repos/Anhao1314/flowcredit-v2/actions/permissions/workflow
gh secret list --repo Anhao1314/flowcredit-v2        # empty
cd agent && npm run check:isolation
```

## Local runtime data

Local runs write logs, sessions and DSH state outside the repository (default `~/fc-agent/runtime`). Set `FC_RUNTIME_ROOT` to a development-only directory if you want those runs kept separate from any other local runtime.
