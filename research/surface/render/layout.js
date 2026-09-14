// Shared SSR layout, escaping and UI helpers (UI-1.5 workspace shell).
// All persisted strings pass through escapeHtml before reaching the page.
// No inline styles are emitted: every visual state is a class (CSP-safe).
import { sanitizeReturnTo, toQueryString } from '../query.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// Same-origin links keep demo mode when the current page is a demo page.
// Idempotent: a href that already carries demo=1 is returned unchanged.
export function withDemo(href, demo = false) {
  if (!demo) return href;
  try {
    const parsed = new URL(href, 'http://127.0.0.1');
    if (parsed.searchParams.get('demo') === '1') return href;
    parsed.searchParams.set('demo', '1');
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return href;
  }
}

// Detail links carry the index context they came from (`from=<index url>`),
// so the detail page can offer a return to the same search/filter/sort/page.
export function withReturnTo(href, { from = '', demo = false } = {}) {
  const params = [];
  if (from) params.push(`from=${encodeURIComponent(from)}`);
  if (demo) params.push('demo=1');
  if (!params.length) return href;
  return `${href}${href.includes('?') ? '&' : '?'}${params.join('&')}`;
}

// Detail back link: return to the captured index context when it is a safe,
// same-origin URL for this index; otherwise fall back to the plain index.
export function backToIndex(index, from, demo = false) {
  const safe = sanitizeReturnTo(from);
  if (safe && (safe === index || safe.startsWith(`${index}?`))) return withDemo(safe, demo);
  return withDemo(index, demo);
}

// Date-type values (period start/end, observedAt, documentDate): YYYY-MM-DD.
export function timeDate(value) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(String(value));
  const iso = parsed.toISOString().slice(0, 10);
  return `<time datetime="${iso}">${iso}</time>`;
}

// Instant-type values (createdAt, recordedAt, effectiveAt, updatedAt): date + HH:MM UTC.
export function timeInstant(value) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(String(value));
  const iso = parsed.toISOString();
  const display = `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
  return `<time datetime="${iso}">${display}</time>`;
}

export function timeRange(start, end) {
  if (!start && !end) return 'Not recorded';
  if (!start) return timeDate(end);
  if (!end) return timeDate(start);
  return `${timeDate(start)} → ${timeDate(end)}`;
}

export function truncate(value, length = 220) {
  const text = String(value ?? '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function sentenceCase(value) {
  const text = String(value ?? '').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function statusLabel(status) {
  return status ? sentenceCase(status) : 'Status not recorded';
}

// ---------------------------------------------------------------- icons
// A small local stroke-icon set (8 shapes). Decorative by default; the
// nearby text always carries the meaning, so all icons are aria-hidden.
const ICONS = {
  inbox: '<path d="M2.6 3.2h10.8v9.6H2.6z"/><path d="M2.6 9.3h2.9l.9 1.7h3.2l.9-1.7h2.9"/>',
  claim: '<path d="M8 2.4 13.6 8 8 13.6 2.4 8z"/>',
  evidence: '<path d="M4.2 2.6h4.8l2.8 2.8v8H4.2z"/><path d="M9 2.6v2.8h2.8"/><path d="M6.1 8.2h3.8M6.1 10.4h3.8"/>',
  change: '<circle cx="3.4" cy="8" r="1.5"/><path d="M4.9 8h4.6"/><path d="M7.1 5.6 9.5 8l-2.4 2.4"/>',
  source: '<path d="M3.2 13.4V5.6L8 2.6l4.8 3v7.8z"/><path d="M6.6 13.4v-3.2h2.8v3.2"/>',
  link: '<path d="m6.7 9.3 2.6-2.6"/><path d="M6.2 8.1 4.9 9.4a1.9 1.9 0 0 0 2.7 2.7l1.3-1.3"/><path d="M9.8 7.9l1.3-1.3a1.9 1.9 0 0 0-2.7-2.7L7.1 5.2"/>',
  trace: '<circle cx="8" cy="3.4" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="8" cy="12.6" r="1.3"/><path d="M8 4.7v2M8 9.3v2"/>'
};

export function icon(name) {
  const paths = ICONS[name];
  if (!paths) return '';
  return `<svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// ---------------------------------------------------------------- chips
export function badge(text, tone = 'neutral') {
  return `<span class="badge tone-${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

export function linkChip(linkCount, { compact = false } = {}) {
  if (!linkCount) return `<span class="chip tone-caution">${icon('link')}Not linked to a Claim</span>`;
  if (compact) return `<span class="chip">${icon('link')}Linked · ${escapeHtml(linkCount)} Claim${linkCount === 1 ? '' : 's'}</span>`;
  return `<span class="chip">${icon('link')}Linked to ${escapeHtml(linkCount)} Claim${linkCount === 1 ? '' : 's'}</span>`;
}

// Provenance depth as a labelled chip: deeper trace vs partial trace.
export function provenanceChip(reviewed, { compact = false } = {}) {
  return reviewed
    ? `<span class="chip">${icon('trace')}${compact ? 'Deep trace' : 'Deep provenance'}</span>`
    : `<span class="chip">${icon('trace')}${compact ? 'Partial trace' : 'Partial provenance'}</span>`;
}

const STATUS_TONES = {
  supported: 'positive',
  partially_supported: 'caution',
  disputed: 'attention',
  unverified: 'neutral',
  stale: 'neutral'
};

const IMPACT_TONES = {
  confirm: 'neutral',
  strengthen: 'positive',
  weaken: 'caution',
  contradict: 'attention',
  no_material_effect: 'neutral',
  insufficient_evidence: 'neutral'
};

const RELATION_TONES = {
  supports: 'positive',
  counters: 'caution',
  context: 'neutral',
  unclear: 'neutral'
};

export function statusTone(status) { return STATUS_TONES[status] ?? 'neutral'; }
export function impactTone(impact) { return IMPACT_TONES[impact] ?? 'neutral'; }
export function relationTone(relation) { return RELATION_TONES[relation] ?? 'neutral'; }

export function countChip(value, label) {
  return `<span class="count-chip"><strong>${escapeHtml(value)}</strong> ${escapeHtml(label)}</span>`;
}

// ---------------------------------------------------------------- sections
export function sectionHead(title, meta = '') {
  return `<div class="section-head"><h2>${escapeHtml(title)}</h2>${meta ? `<span class="section-meta">${meta}</span>` : ''}</div>`;
}

export function panelTitle(text, iconName = '') {
  return `<h2 class="panel-title">${iconName ? icon(iconName) : ''}${escapeHtml(text)}</h2>`;
}

// Segmented corpus strip: one tick per recorded object, first `on` filled.
// The strip itself is aria-hidden; the legend text carries the numbers.
export function tickStrip({ on = 0, total = 0, onClass = 'is-on' }) {
  const count = Math.min(Math.max(total, 0), 80);
  const filled = Math.min(Math.max(on, 0), count);
  let ticks = '';
  for (let index = 0; index < count; index += 1) {
    ticks += index < filled ? `<span class="tick ${onClass}"></span>` : '<span class="tick"></span>';
  }
  return `<span class="tick-strip" aria-hidden="true">${ticks}</span>`;
}

// Provenance rail: each step is a node on a vertical line. Solid nodes are
// available trace steps; hollow nodes are stated as not available yet.
export function railViz(steps) {
  const items = steps.map((step) => {
    const state = step.state ?? 'off';
    return `<li class="rail-step is-${escapeHtml(state)}">
      <span class="rail-track"><span class="rail-node"></span></span>
      <span class="rail-step-label">${escapeHtml(step.label)}${step.meta ? `<span class="meta">${escapeHtml(step.meta)}</span>` : ''}</span>
    </li>`;
  }).join('');
  return `<ul class="rail-viz">${items}</ul>`;
}

// The product's information chain as a compact lane: Source → Evidence →
// Claim → Change. Counts come from real records; arrows are decorative.
export function lineageLane(steps) {
  const parts = steps.map((step) => `<span class="lineage-step${step.current ? ' is-current' : ''}">${step.iconName ? icon(step.iconName) : ''}${escapeHtml(step.label)}${step.count !== undefined && step.count !== null ? ` <span class="count">${escapeHtml(step.count)}</span>` : ''}</span>`);
  return `<div class="lineage" aria-label="Research lineage">${parts.join('<span class="lineage-arrow" aria-hidden="true">→</span>')}</div>`;
}

export function checkpoint(question) {
  return `<section class="checkpoint"><p class="checkpoint-label">Experience checkpoint</p><p>${escapeHtml(question)}</p></section>`;
}

// Inline terminology disclosure. <summary> is the term itself.
export function termHelp(term, definition) {
  return `<details class="term"><summary>${escapeHtml(term)}</summary><p>${escapeHtml(definition)}</p></details>`;
}

// ---------------------------------------------------------------- forms
// GET filter bar: no JS, SSR only, demo mode preserved through hidden input.
export function filterBar({ action, demo = false, search = null, selects = [], hidden = [] }) {
  const fields = [];
  for (const entry of hidden) {
    if (entry.value === null || entry.value === undefined || entry.value === '') continue;
    fields.push(`<input type="hidden" name="${escapeHtml(entry.name)}" value="${escapeHtml(entry.value)}">`);
  }
  if (demo) fields.push('<input type="hidden" name="demo" value="1">');
  if (search) {
    fields.push(`<div class="filter-field filter-grow">
      <label class="sr-only" for="filter-q">${escapeHtml(search.label ?? 'Search recorded text')}</label>
      <input class="filter-input" id="filter-q" type="search" name="${escapeHtml(search.name)}" value="${escapeHtml(search.value ?? '')}" placeholder="${escapeHtml(search.placeholder ?? 'Search recorded text…')}" autocomplete="off" spellcheck="false">
    </div>`);
  }
  for (const select of selects) {
    const options = [`<option value=""${select.value ? '' : ' selected'}>${escapeHtml(select.allLabel)}</option>`];
    for (const option of select.options) {
      options.push(`<option value="${escapeHtml(option.value)}"${option.value === select.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`);
    }
    fields.push(`<div class="filter-field">
      <label class="sr-only" for="filter-${escapeHtml(select.name)}">${escapeHtml(select.label)}</label>
      <select class="filter-select" id="filter-${escapeHtml(select.name)}" name="${escapeHtml(select.name)}"${select.label ? ` aria-label="${escapeHtml(select.label)}"` : ''}>${options.join('')}</select>
    </div>`);
  }
  fields.push(`<div class="filter-actions">
    <button class="btn" type="submit">Apply</button>
    <a class="filter-clear" href="${escapeHtml(action)}${demo ? '?demo=1' : ''}">Clear</a>
  </div>`);
  return `<form class="command-bar" method="get" action="${escapeHtml(action)}">${fields.join('')}</form>
${search ? '<p class="filter-help">Deterministic search · matches recorded text exactly — not AI</p>' : ''}`;
}

function pageHref(base, filters, targetPage, demo) {
  const query = toQueryString({ ...filters, page: targetPage });
  const suffix = demo ? (query ? `${query}&demo=1` : 'demo=1') : query;
  if (!suffix) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${suffix}`;
}

// Pagination: GET links, prev/next + page numbers (≤7 pages or a window).
export function pagination({ base, filters = {}, pagination: data, demo = false, label = 'Pagination' }) {
  if (!data || data.total === 0) return '';
  const summary = `<p class="pagination-summary">Showing ${data.start}–${data.end} of ${data.total}</p>`;
  if (data.pages <= 1) return summary;
  const previous = data.page > 1
    ? `<a class="page-btn" rel="prev" href="${escapeHtml(pageHref(base, filters, data.page - 1, demo))}">← Previous</a>`
    : '<span class="page-btn is-disabled" aria-disabled="true">← Previous</span>';
  const next = data.page < data.pages
    ? `<a class="page-btn" rel="next" href="${escapeHtml(pageHref(base, filters, data.page + 1, demo))}">Next →</a>`
    : '<span class="page-btn is-disabled" aria-disabled="true">Next →</span>';
  const numbers = [];
  if (data.pages <= 7) {
    for (let page = 1; page <= data.pages; page += 1) numbers.push(page);
  } else {
    const window = [1, data.page - 1, data.page, data.page + 1, data.pages]
      .filter((page) => page >= 1 && page <= data.pages)
      .filter((page, index, list) => list.indexOf(page) === index)
      .sort((a, b) => a - b);
    for (const page of window) {
      if (numbers.length && page - numbers[numbers.length - 1] > 1) numbers.push('gap');
      numbers.push(page);
    }
  }
  const pageItems = numbers.map((entry) => {
    if (entry === 'gap') return '<span class="page-ellipsis" aria-hidden="true">…</span>';
    if (entry === data.page) return `<span class="page-number is-current" aria-current="page">${entry}</span>`;
    return `<a class="page-number" href="${escapeHtml(pageHref(base, filters, entry, demo))}">${entry}</a>`;
  }).join('');
  return `${summary}
  <nav class="pagination" aria-label="${escapeHtml(label)}">
    ${previous}
    <span class="page-numbers">${pageItems}</span>
    ${next}
  </nav>`;
}

// ---------------------------------------------------------------- shell
// Detail pages highlight their index section: exact pages use
// aria-current="page", section matches (claim detail → Claims) use
// aria-current="true".
const SECTION_TARGETS = { claim: 'claims' };

const NAV_ICONS = { inbox: 'inbox', claims: 'claim', evidence: 'evidence', changes: 'change' };

function navLink({ href, label, key, current, demo }) {
  const target = withDemo(href, demo);
  const isExact = key === current;
  const isSection = SECTION_TARGETS[current] === key;
  const currentAttr = isExact ? ' aria-current="page"' : isSection ? ' aria-current="true"' : '';
  return `<a class="rail-link${isExact || isSection ? ' is-current' : ''}" href="${escapeHtml(target)}"${currentAttr}>${icon(NAV_ICONS[key])}<span>${escapeHtml(label)}</span></a>`;
}

export function demoBanner() {
  return `<div class="demo-banner" role="note">
    <strong>Demo mode</strong>
    <span>Synthetic proposal examples — not Research Memory.</span>
  </div>`;
}

// The workspace shell: topbar (brand, work scope, state badges), left rail
// with the workspace navigation, the main work zone, and a status rail.
export function page({ title, current, demo = false, body, dataLabel, demoLabel, context = 'All subjects' }) {
  const nav = [
    navLink({ href: '/', label: 'Research Inbox', key: 'inbox', current, demo }),
    navLink({ href: '/claims', label: 'Claims', key: 'claims', current, demo }),
    navLink({ href: '/evidence', label: 'Evidence', key: 'evidence', current, demo }),
    navLink({ href: '/changes', label: 'What Changed', key: 'changes', current, demo })
  ].join('');
  const badges = [
    badge('LOCAL', 'neutral'),
    badge('READ ONLY', 'positive'),
    badge('AI OFF', 'neutral'),
    demo ? badge('DEMO', 'caution') : ''
  ].join('');
  const demoSource = demo ? ` · Demo source: ${escapeHtml(demoLabel ?? '')}` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · FlowCredit Research Memory</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/assets/surface.css">
<script defer src="/assets/surface.js"></script>
</head>
<body${demo ? ' class="is-demo"' : ''}>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="topbar">
  <a class="brand" href="${escapeHtml(withDemo('/', demo))}">
    <span class="brand-mark" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 32 32" focusable="false"><path d="M9 23V15M16 23V9M23 23V18" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/></svg></span>
    <span class="brand-text"><span class="brand-name">FlowCredit</span><span class="brand-sub">Research Memory</span></span>
  </a>
  <span class="topbar-context" title="Current work scope">${escapeHtml(context)}</span>
  <div class="state-badges">${badges}</div>
</header>
${demo ? demoBanner() : ''}
<div class="shell">
  <aside class="rail">
    <nav class="rail-nav" aria-label="Surface navigation">${nav}</nav>
    <div class="rail-foot">
      <p class="rail-label">Data source</p>
      <p class="rail-data">${escapeHtml(dataLabel)}${demoSource ? `<br>Demo: ${escapeHtml(demoLabel ?? '')}` : ''}</p>
    </div>
  </aside>
  <div class="workzone">
    <main class="page" id="main" tabindex="-1">
${body}
    </main>
  </div>
</div>
<footer class="statusbar">
  <div class="statusbar-inner">
    <span><strong class="status-strong">AI runtime OFF</strong></span>
    <span>Data source: ${escapeHtml(dataLabel)}${demoSource}</span>
    <span>Times shown in UTC.</span>
    <span>Development-only research surface. Read-only. Local loopback. Not a production frontend.</span>
    <span>Research-state changes are not investment recommendations.</span>
  </div>
</footer>
</body>
</html>
`;
}

export function messageBody({ heading, lead, lines = [] }) {
  return `<div class="view">
  <p class="eyebrow">Research Memory</p>
  <h1>${escapeHtml(heading)}</h1>
  ${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ''}
  ${lines.length ? `<ul class="message-lines">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}
</div>`;
}
