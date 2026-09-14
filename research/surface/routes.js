// Request routing for the local Research Surface. GET / HEAD only.
// Every render path is read-only; there is no mutation endpoint.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inboxView } from './render/inbox.js';
import { companyView } from './render/company.js';
import { claimView } from './render/claim.js';
import { claimsView } from './render/claims.js';
import { evidenceView } from './render/evidence.js';
import { evidenceIndexView } from './render/evidence-index.js';
import { changesView } from './render/changed.js';
import { messageBody, page } from './render/layout.js';
import { parseClaimsQuery, parseEvidenceQuery } from './query.js';

const ASSETS = {
  '/assets/surface.css': { file: fileURLToPath(new URL('./public/surface.css', import.meta.url)), type: 'text/css; charset=utf-8' },
  '/assets/surface.js': { file: fileURLToPath(new URL('./public/surface.js', import.meta.url)), type: 'text/javascript; charset=utf-8' },
  '/favicon.svg': { file: fileURLToPath(new URL('./public/favicon.svg', import.meta.url)), type: 'image/svg+xml; charset=utf-8' },
  '/favicon.ico': { file: fileURLToPath(new URL('./public/favicon.svg', import.meta.url)), type: 'image/svg+xml; charset=utf-8' }
};

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function send(res, method, status, type, body, extraHeaders = {}) {
  const payload = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...extraHeaders
  });
  if (method === 'HEAD') res.end();
  else res.end(payload);
}

function sendHtml(res, method, status, html) {
  send(res, method, status, 'text/html; charset=utf-8', html);
}

export function createRouter({ getMemory, getDemoData, log = console }) {
  const assetCache = new Map();
  const assetBody = (path) => {
    if (!assetCache.has(path)) assetCache.set(path, readFileSync(ASSETS[path].file, 'utf8'));
    return assetCache.get(path);
  };

  return function handle(req, res) {
    const method = req.method === 'HEAD' ? 'HEAD' : req.method;
    if (method !== 'GET' && method !== 'HEAD') {
      send(res, method, 405, 'text/plain; charset=utf-8', 'Method Not Allowed\n', { Allow: 'GET, HEAD' });
      return;
    }
    let url;
    try {
      url = new URL(req.url, 'http://127.0.0.1');
    } catch {
      send(res, method, 400, 'text/plain; charset=utf-8', 'Bad Request\n');
      return;
    }
    const demo = url.searchParams.get('demo') === '1';
    try {
      const asset = ASSETS[url.pathname];
      if (asset) {
        send(res, method, 200, asset.type, assetBody(url.pathname));
        return;
      }

      const memory = getMemory();
      const demoData = demo ? getDemoData() : null;
      const dataLabel = memory.source ? `${memory.source.fileLabel} (read-only)` : 'unavailable';
      const demoLabel = demoData?.label ?? null;

      if (memory.error) {
        const error = memory.error;
        const html = page({
          title: 'Research Memory unavailable',
          current: 'inbox',
          demo,
          dataLabel,
          demoLabel,
          body: messageBody({
            heading: 'Research Memory unavailable',
            lead: `${error.code ?? 'DATA_UNAVAILABLE'}: the configured Research Memory database could not be opened read-only.`,
            lines: [
              'This surface never creates or repairs data; it only reads existing persisted records.',
              'Point FC_SURFACE_MEMORY_DB at an existing Research Memory SQLite file, then reload this page.',
              'No model runtime is used to render any page of this surface.'
            ]
          })
        });
        sendHtml(res, method, 200, html);
        return;
      }

      const source = memory.source;

      const wrap = (view, current, statusOverride) => {
        const html = page({ title: view.title, current, demo, body: view.body, dataLabel, demoLabel, context: view.context });
        sendHtml(res, method, statusOverride ?? view.status, html);
      };

      if (url.pathname === '/') {
        wrap(inboxView({ source, demo }), 'inbox');
        return;
      }
      if (url.pathname === '/claims') {
        wrap(claimsView({ source, demo, query: parseClaimsQuery(url.searchParams) }), 'claims');
        return;
      }
      if (url.pathname === '/evidence') {
        wrap(evidenceIndexView({ source, demo, query: parseEvidenceQuery(url.searchParams) }), 'evidence');
        return;
      }
      if (url.pathname === '/changes') {
        wrap(changesView({ source, demo, demoData }), 'changes');
        return;
      }
      const detail = url.pathname.match(/^\/(company|claim|evidence)\/(.+)$/);
      if (detail) {
        let id;
        try { id = decodeURIComponent(detail[2]); } catch { id = null; }
        if (!id || !ID_PATTERN.test(id)) {
          const labels = { company: 'Company', claim: 'Claim', evidence: 'Evidence' };
          const html = page({
            title: `${labels[detail[1]]} not found`, current: detail[1], demo, dataLabel, demoLabel,
            body: messageBody({
              heading: `${labels[detail[1]]} not found`,
              lead: 'The requested identifier is not a valid record identifier.',
              lines: ['Identifiers are displayed on the list pages of this surface.']
            })
          });
          sendHtml(res, method, 404, html);
          return;
        }
        const view = detail[1] === 'company' ? companyView({ source, demo }, id)
          : detail[1] === 'claim' ? claimView({ source, demo, from: url.searchParams.get('from') ?? '' }, id)
            : evidenceView({ source, demo, from: url.searchParams.get('from') ?? '' }, id);
        wrap(view, detail[1]);
        return;
      }

      const html = page({
        title: 'Not found', current: 'inbox', demo, dataLabel, demoLabel,
        body: messageBody({
          heading: 'Page not found',
          lead: 'This local surface only serves its own read-only pages.',
          lines: ['Known routes: / , /claims , /evidence , /company/:subjectId , /claim/:claimId , /evidence/:evidenceId , /changes , with optional ?demo=1.']
        })
      });
      sendHtml(res, method, 404, html);
    } catch (error) {
      log.error(`[surface] render error: ${error?.stack ?? error}`);
      try {
        const html = page({
          title: 'Surface error', current: 'inbox', demo, dataLabel: 'unavailable', demoLabel: null,
          body: messageBody({
            heading: 'Something went wrong rendering this page',
            lead: 'The surface stayed read-only. Nothing was written.',
            lines: ['Retry the page. If the problem persists, check the server log in the terminal that started the surface.']
          })
        });
        sendHtml(res, method, 500, html);
      } catch {
        res.destroy();
      }
    }
  };
}
