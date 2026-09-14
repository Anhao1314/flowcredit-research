// Claims index (UI-1.5): dense research-object rows. Each Claim reads as an
// object with identity, state, and a real evidence-coverage meter.
import { buildClaimsIndex, displayName } from '../projection.js';
import { serializeIndexQuery } from '../query.js';
import {
  badge, checkpoint, escapeHtml, filterBar, icon, pagination, sentenceCase,
  statusLabel, statusTone, termHelp, tickStrip, timeInstant, truncate, withDemo, withReturnTo
} from './layout.js';

function filtersFor(query) {
  return {
    q: query.q,
    category: query.category,
    status: query.status,
    subject: query.subject,
    sort: query.sort === 'recent' ? '' : query.sort
  };
}

function coverageMeter(supportCount, counterCount) {
  if (!supportCount && !counterCount) return '<span class="meta">No linked Evidence</span>';
  const support = Math.min(supportCount, 10);
  const counter = Math.min(counterCount, 10);
  const overflow = supportCount > 10 || counterCount > 10 ? '<span class="tick-gap" aria-hidden="true"></span>' : '';
  return `<span class="row-meter">
    <span class="count-marks">
      ${support ? tickStrip({ on: support, total: support }) : ''}
      ${counter ? tickStrip({ on: counter, total: counter, onClass: 'is-counter' }) : ''}${overflow}
    </span>
    <span class="meta">${escapeHtml(supportCount)} supporting${counterCount ? ` · ${escapeHtml(counterCount)} counter` : ''}</span>
  </span>`;
}

export function claimsView({ source, demo, query }) {
  const index = buildClaimsIndex(source, query);
  const contextQuery = serializeIndexQuery('/claims', query, false);
  const from = contextQuery ? `/claims${serializeIndexQuery('/claims', query, demo)}` : '';
  const rows = index.rows.map((row) => `
    <li class="row">
      <span class="row-marker" aria-hidden="true">${icon('claim')}</span>
      <div class="row-body">
        <a class="row-title" href="${escapeHtml(withReturnTo(`/claim/${encodeURIComponent(row.claimId)}`, { from, demo }))}">${escapeHtml(truncate(row.statement ?? 'Claim statement not recorded', 160))}</a>
        <p class="row-meta">${escapeHtml(row.category ?? 'category not recorded')}<span class="sep">·</span>revision v${escapeHtml(row.version ?? '?')}<span class="sep">·</span>updated ${timeInstant(row.updatedAt)}</p>
        <p class="row-chips">
          ${badge(statusLabel(row.status), statusTone(row.status))}
          <span class="row-subject">${escapeHtml(row.subjectName)}</span>
        </p>
      </div>
      <div class="row-side">
        ${coverageMeter(row.supportCount, row.counterCount)}
      </div>
    </li>`).join('');

  const noClaims = index.total === 0;
  const noMatches = !noClaims && index.pagination.total === 0;
  const emptyState = noClaims
    ? '<p class="note strong empty-state">No research beliefs recorded yet.</p>'
    : noMatches
      ? `<p class="note strong empty-state">No Claims match these filters.</p>
      <p><a class="button-link" href="${escapeHtml(withDemo('/claims', demo))}">Clear filters</a></p>`
      : '';

  const summary = index.filtersActive && !noMatches
    ? `All recorded research beliefs · ${index.pagination.total} of ${index.total} match the current filters`
    : `All recorded research beliefs · ${index.total} recorded`;

  const body = `
  <div class="view">
    <div class="view-head">
      <h1>Claims</h1>
      <p class="lead">${escapeHtml(summary)}.</p>
      ${termHelp('Claim', 'A recorded research belief about the company, with a status and supporting Evidence.')}
    </div>
    ${filterBar({
      action: '/claims',
      demo,
      search: { name: 'q', value: query.q, label: 'Search Claims', placeholder: 'Search recorded text…' },
      selects: [
        { name: 'category', label: 'Category', allLabel: 'All categories', value: query.category, options: index.categories.map((category) => ({ value: category, label: category })) },
        { name: 'status', label: 'Status', allLabel: 'All statuses', value: query.status, options: index.statuses.map((status) => ({ value: status, label: sentenceCase(status) })) },
        { name: 'sort', label: 'Sort', allLabel: 'Sort: newest first', value: query.sort === 'recent' ? '' : query.sort, options: [
          { value: 'oldest', label: 'Sort: oldest first' },
          { value: 'category', label: 'Sort: category' },
          { value: 'status', label: 'Sort: status' }
        ] }
      ],
      hidden: [{ name: 'subject', value: query.subject }]
    })}
    <p class="filter-help">Evidence coverage is the number of linked Evidence records — not Claim confidence.</p>
    ${emptyState}
    ${rows ? `<ul class="rows">${rows}</ul>` : ''}
    ${pagination({ base: '/claims', filters: filtersFor(query), pagination: index.pagination, demo })}
    ${checkpoint('Can you find the belief you need?')}
  </div>`;
  return { status: 200, title: 'Claims', body, context: query.subject ? displayName(query.subject) : 'All subjects' };
}
