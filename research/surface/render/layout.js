// Shared SSR layout and UI primitives for FlowCredit Research Workbench UI-2.0.
// Persisted strings are escaped before rendering. No inline styles are emitted.
import { sanitizeReturnTo, toQueryString } from '../query.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

const HOME_PATH = /(?:\/Users\/|\/home\/|[A-Za-z]:[\\/]Users[\\/])[^\s)]*/g;
export function publicSourceLabel(label) {
  if (label === null || label === undefined) return '';
  return String(label).replace(HOME_PATH, (match) => {
    const base = match.replace(/\\/g, '/').split('/').filter(Boolean).pop();
    return base ? `…/${base}` : 'local runtime fixture';
  });
}

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

export function withReturnTo(href, { from = '', demo = false } = {}) {
  const params = [];
  if (from) params.push(`from=${encodeURIComponent(from)}`);
  if (demo) params.push('demo=1');
  if (!params.length) return href;
  return `${href}${href.includes('?') ? '&' : '?'}${params.join('&')}`;
}

export function backToIndex(index, from, demo = false) {
  const safe = sanitizeReturnTo(from);
  if (safe && (safe === index || safe.startsWith(`${index}?`))) return withDemo(safe, demo);
  return withDemo(index, demo);
}

export function timeDate(value) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(String(value));
  const iso = parsed.toISOString().slice(0, 10);
  return `<time datetime="${iso}">${iso}</time>`;
}

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

const ICONS = {
  inbox: '<path d="M2.6 3.2h10.8v9.6H2.6z"/><path d="M2.6 9.3h2.9l.9 1.7h3.2l.9-1.7h2.9"/>',
  belief: '<path d="M8 2.4 13.6 8 8 13.6 2.4 8z"/><circle cx="8" cy="8" r="1.3"/>',
  claim: '<path d="M8 2.4 13.6 8 8 13.6 2.4 8z"/>',
  evidence: '<path d="M4.2 2.6h4.8l2.8 2.8v8H4.2z"/><path d="M9 2.6v2.8h2.8"/><path d="M6.1 8.2h3.8M6.1 10.4h3.8"/>',
  review: '<path d="M3 3.2h10v9.6H3z"/><path d="m5.5 8 1.5 1.5 3.4-3.7"/>',
  timeline: '<circle cx="8" cy="8" r="5.2"/><path d="M8 5v3.4l2.2 1.3"/>',
  source: '<path d="M3.2 13.4V5.6L8 2.6l4.8 3v7.8z"/><path d="M6.6 13.4v-3.2h2.8v3.2"/>',
  link: '<path d="m6.7 9.3 2.6-2.6"/><path d="M6.2 8.1 4.9 9.4a1.9 1.9 0 0 0 2.7 2.7l1.3-1.3"/><path d="M9.8 7.9l1.3-1.3a1.9 1.9 0 0 0-2.7-2.7L7.1 5.2"/>',
  trace: '<circle cx="8" cy="3.4" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="8" cy="12.6" r="1.3"/><path d="M8 4.7v2M8 9.3v2"/>',
  search: '<circle cx="7" cy="7" r="3.8"/><path d="m10 10 3 3"/>',
  chevron: '<path d="m6 4 4 4-4 4"/>',
  arrow: '<path d="M3 8h9"/><path d="m9 5 3 3-3 3"/>'
};

export function icon(name) {
  const paths = ICONS[name];
  if (!paths) return '';
  return `<svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

export function badge(text, tone = 'neutral') {
  return `<span class="badge tone-${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

export function linkChip(linkCount, { compact = false } = {}) {
  if (!linkCount) return `<span class="chip tone-caution">${icon('link')}Not linked to a Belief</span>`;
  if (compact) return `<span class="chip">${icon('link')}Linked · ${escapeHtml(linkCount)} Belief${linkCount === 1 ? '' : 's'}</span>`;
  return `<span class="chip">${icon('link')}Linked to ${escapeHtml(linkCount)} Belief${linkCount === 1 ? '' : 's'}</span>`;
}

export function provenanceChip(reviewed, { compact = false } = {}) {
  return reviewed
    ? `<span class="chip">${icon('trace')}${compact ? 'Deep trace' : 'Deep provenance'}</span>`
    : `<span class="chip">${icon('trace')}${compact ? 'Partial trace' : 'Partial provenance'}</span>`;
}

const STATUS_TONES = {
  supported: 'positive', partially_supported: 'caution', disputed: 'attention',
  unverified: 'neutral', stale: 'neutral'
};
const IMPACT_TONES = {
  confirm: 'neutral', strengthen: 'positive', weaken: 'caution',
  contradict: 'attention', no_material_effect: 'neutral', insufficient_evidence: 'neutral'
};
const RELATION_TONES = { supports: 'positive', counters: 'caution', context: 'neutral', neutral: 'neutral', ambiguous: 'ambiguous', unclear: 'ambiguous' };

export function statusTone(status) { return STATUS_TONES[status] ?? 'neutral'; }
export function impactTone(impact) { return IMPACT_TONES[impact] ?? 'neutral'; }
export function relationTone(relation) { return RELATION_TONES[String(relation ?? '').toLowerCase()] ?? 'neutral'; }

export function countChip(value, label) {
  return `<span class="count-chip"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></span>`;
}

export function sectionHead(title, meta = '') {
  return `<div class="section-head"><h2>${escapeHtml(title)}</h2>${meta ? `<span class="section-meta">${escapeHtml(meta)}</span>` : ''}</div>`;
}
export function panelTitle(text, iconName = '') {
  return `<h2 class="panel-title">${iconName ? icon(iconName) : ''}${escapeHtml(text)}</h2>`;
}

export function tickStrip({ on = 0, total = 0, onClass = 'is-on' }) {
  const count = Math.min(Math.max(total, 0), 80);
  const filled = Math.min(Math.max(on, 0), count);
  let ticks = '';
  for (let index = 0; index < count; index += 1) ticks += index < filled ? `<span class="tick ${onClass}"></span>` : '<span class="tick"></span>';
  return `<span class="tick-strip" aria-hidden="true">${ticks}</span>`;
}

export function railViz(steps) {
  const items = steps.map((step) => `<li class="rail-step is-${escapeHtml(step.state ?? 'off')}">
    <span class="rail-track"><span class="rail-node"></span></span>
    <span class="rail-step-label">${escapeHtml(step.label)}${step.meta ? `<span class="meta">${escapeHtml(step.meta)}</span>` : ''}</span>
  </li>`).join('');
  return `<ul class="rail-viz">${items}</ul>`;
}

export function lineageLane(steps) {
  return `<div class="lineage" aria-label="Research lineage">${steps.map((step) => `<span class="lineage-step${step.current ? ' is-current' : ''}">${step.iconName ? icon(step.iconName) : ''}${escapeHtml(step.label)}${step.count !== undefined && step.count !== null ? ` <span class="count">${escapeHtml(step.count)}</span>` : ''}</span>`).join('<span class="lineage-arrow" aria-hidden="true">→</span>')}</div>`;
}

export function checkpoint(question) {
  return `<section class="checkpoint" aria-label="Experience checkpoint"><span>UX check</span><p>${escapeHtml(question)}</p></section>`;
}

export function termHelp(term, definition) {
  return `<details class="term"><summary>${escapeHtml(term)}</summary><p>${escapeHtml(definition)}</p></details>`;
}

export function filterBar({ action, demo = false, search = null, selects = [], hidden = [] }) {
  const fields = [];
  for (const entry of hidden) {
    if (entry.value === null || entry.value === undefined || entry.value === '') continue;
    fields.push(`<input type="hidden" name="${escapeHtml(entry.name)}" value="${escapeHtml(entry.value)}">`);
  }
  if (demo) fields.push('<input type="hidden" name="demo" value="1">');
  if (search) fields.push(`<div class="filter-field filter-grow">
    <label class="sr-only" for="filter-q">${escapeHtml(search.label ?? 'Search')}</label>
    <input class="filter-input" id="filter-q" type="search" name="${escapeHtml(search.name)}" value="${escapeHtml(search.value ?? '')}" placeholder="${escapeHtml(search.placeholder ?? 'Search recorded text…')}" autocomplete="off" spellcheck="false">
  </div>`);
  for (const select of selects) {
    const options = [`<option value=""${select.value ? '' : ' selected'}>${escapeHtml(select.allLabel)}</option>`];
    for (const option of select.options) options.push(`<option value="${escapeHtml(option.value)}"${option.value === select.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`);
    fields.push(`<div class="filter-field"><label class="sr-only" for="filter-${escapeHtml(select.name)}">${escapeHtml(select.label)}</label><select class="filter-select" id="filter-${escapeHtml(select.name)}" name="${escapeHtml(select.name)}" aria-label="${escapeHtml(select.label)}">${options.join('')}</select></div>`);
  }
  fields.push(`<div class="filter-actions"><button class="btn" type="submit">Apply</button><a class="filter-clear" href="${escapeHtml(action)}${demo ? '?demo=1' : ''}">Clear</a></div>`);
  return `<form class="command-bar" method="get" action="${escapeHtml(action)}">${fields.join('')}</form>`;
}

function pageHref(base, filters, targetPage, demo) {
  const query = toQueryString({ ...filters, page: targetPage });
  const suffix = demo ? (query ? `${query}&demo=1` : '?demo=1') : query;
  return `${base}${suffix}`;
}

export function pagination({ base, filters, pagination: state, demo = false }) {
  if (state.pages <= 1) return '';
  return `<nav class="pagination" aria-label="Pagination">
    <span>${escapeHtml(state.start)}–${escapeHtml(state.end)} of ${escapeHtml(state.total)}</span>
    <div>
      ${state.page > 1 ? `<a class="btn btn-quiet" href="${escapeHtml(pageHref(base, filters, state.page - 1, demo))}">Previous</a>` : ''}
      <span class="page-indicator">Page ${escapeHtml(state.page)} / ${escapeHtml(state.pages)}</span>
      ${state.page < state.pages ? `<a class="btn btn-quiet" href="${escapeHtml(pageHref(base, filters, state.page + 1, demo))}">Next</a>` : ''}
    </div>
  </nav>`;
}

function navLink({ href, label, key, current, demo, iconName, meta = '' }) {
  const active = current === key || (key === 'beliefs' && current === 'claim') || (key === 'evidence' && current === 'evidence-detail');
  return `<a class="nav-link${active ? ' is-current' : ''}" href="${escapeHtml(withDemo(href, demo))}"${active ? ' aria-current="page"' : ''}>
    <span class="nav-icon">${icon(iconName)}</span><span class="nav-label">${escapeHtml(label)}</span>${meta ? `<span class="nav-meta">${escapeHtml(meta)}</span>` : ''}
  </a>`;
}

function demoBanner() {
  return '<div class="demo-banner"><strong>Synthetic preview</strong><span>Demo records are isolated from Research Memory and never become authoritative.</span></div>';
}

export function page({ title, current, demo = false, publicDemo = false, body, dataLabel, demoLabel, context = 'All subjects' }) {
  const nav = [
    navLink({ href: '/', label: 'Inbox', key: 'inbox', current, demo, iconName: 'inbox' }),
    navLink({ href: '/beliefs', label: 'Beliefs', key: 'beliefs', current, demo, iconName: 'belief' }),
    navLink({ href: '/review', label: 'Review', key: 'review', current, demo, iconName: 'review' }),
    navLink({ href: '/evidence', label: 'Evidence', key: 'evidence', current, demo, iconName: 'evidence' }),
    navLink({ href: '/timeline', label: 'Timeline', key: 'timeline', current, demo, iconName: 'timeline' })
  ].join('');
  const badges = publicDemo
    ? [badge('PUBLIC DEMO', 'public'), badge('READ ONLY', 'positive'), badge('AI OFF', 'neutral')].join('')
    : [badge('LOCAL', 'neutral'), badge('READ ONLY', 'positive'), badge('AI OFF', 'neutral'), demo ? badge('DEMO', 'caution') : ''].join('');
  const bodyClass = [publicDemo ? 'is-public-demo' : '', demo ? 'is-demo' : ''].filter(Boolean).join(' ');
  const demoSource = demo && !publicDemo ? ` · Demo source: ${escapeHtml(demoLabel ?? '')}` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)} · FlowCredit Research</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/assets/surface.css">
<script defer src="/assets/surface.js"></script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="topbar">
  <a class="brand" href="${escapeHtml(withDemo('/', demo))}" aria-label="FlowCredit Research home">
    <span class="brand-mark" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 32 32" focusable="false"><path d="M8 23V15M16 23V8M24 23V18" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg></span>
    <span class="brand-text"><strong>FlowCredit</strong><span>Research Workbench</span></span>
  </a>
  <form class="global-search" action="/beliefs" method="get" role="search">
    ${demo ? '<input type="hidden" name="demo" value="1">' : ''}
    ${icon('search')}<label class="sr-only" for="global-q">Search beliefs</label><input id="global-q" name="q" type="search" placeholder="Search beliefs…" autocomplete="off" spellcheck="false"><kbd>⌘K</kbd>
  </form>
  <div class="state-badges">${badges}</div>
</header>
${demo ? demoBanner() : ''}
<div class="shell">
  <aside class="rail" aria-label="Workbench navigation">
    <div class="scope-card"><span>Research scope</span><strong title="${escapeHtml(context)}">${escapeHtml(context)}</strong></div>
    <nav class="rail-nav" aria-label="Primary navigation">${nav}</nav>
    <div class="rail-foot">
      <span>${publicDemo ? 'Public demo' : 'Data source'}</span>
      <strong>${escapeHtml(dataLabel)}${publicDemo ? '<br>Offline deterministic fixture' : ''}${demoSource ? `<br>${escapeHtml(demoLabel ?? '')}` : ''}</strong>
    </div>
  </aside>
  <div class="workzone">
    <main class="page" id="main" tabindex="-1">${body}</main>
  </div>
</div>
<footer class="statusbar">
  <span><strong>AI runtime OFF</strong> · server-rendered · read-only</span>
  <span>Times in UTC · research-state changes are not investment recommendations.</span>
</footer>
</body>
</html>`;
}

export function messageBody({ heading, lead, lines = [] }) {
  return `<div class="view"><div class="view-head"><p class="eyebrow">Research Workbench</p><h1>${escapeHtml(heading)}</h1>${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ''}</div>${lines.length ? `<ul class="message-lines">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}</div>`;
}
