// Beliefs index for FlowCredit Research Workbench UI-2.0.
// The persisted domain object remains Claim; the product language is Belief.
import { buildClaimsIndex, displayName } from '../projection.js';
import { serializeIndexQuery } from '../query.js';
import {
  badge, checkpoint, escapeHtml, filterBar, icon, pagination, sentenceCase,
  statusLabel, statusTone, tickStrip, timeInstant, truncate, withDemo, withReturnTo
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
  return `<span class="row-meter"><span class="count-marks">
    ${support ? tickStrip({ on: support, total: support }) : ''}
    ${counter ? tickStrip({ on: counter, total: counter, onClass: 'is-counter' }) : ''}
  </span><span class="meta">${escapeHtml(supportCount)} supporting${counterCount ? ` · ${escapeHtml(counterCount)} counter` : ''}</span></span>`;
}

export function claimsView({ source, demo, query }) {
  const index = buildClaimsIndex(source, query);
  const contextQuery = serializeIndexQuery('/beliefs', query, false);
  const from = contextQuery ? `/beliefs${serializeIndexQuery('/beliefs', query, demo)}` : '';
  const rows = index.rows.map((row) => `
    <li class="row">
      <span class="row-marker" aria-hidden="true">${icon('belief')}</span>
      <div class="row-body">
        <a class="row-title" href="${escapeHtml(withReturnTo(`/claim/${encodeURIComponent(row.claimId)}`, { from, demo }))}">${escapeHtml(truncate(row.statement ?? 'Belief statement not recorded', 175))}</a>
        <p class="row-meta">${escapeHtml(row.category ?? 'category not recorded')}<span class="sep">·</span>revision v${escapeHtml(row.version ?? '?')}<span class="sep">·</span>updated ${timeInstant(row.updatedAt)}</p>
        <p class="row-chips">${badge(statusLabel(row.status), statusTone(row.status))}<span class="row-subject">${escapeHtml(row.subjectName)}</span></p>
      </div>
      <div class="row-side">${coverageMeter(row.supportCount, row.counterCount)}</div>
    </li>`).join('');

  const noBeliefs = index.total === 0;
  const noMatches = !noBeliefs && index.pagination.total === 0;
  const emptyState = noBeliefs
    ? '<p class="note strong empty-state">No research beliefs recorded yet.</p>'
    : noMatches
      ? `<p class="note strong empty-state">No beliefs match these filters.</p><p><a class="button-link" href="${escapeHtml(withDemo('/beliefs', demo))}">Clear filters</a></p>`
      : '';
  const summary = index.filtersActive && !noMatches
    ? `${index.pagination.total} of ${index.total} recorded beliefs match the current view`
    : `${index.total} recorded beliefs`;

  const body = `
  <div class="view">
    <div class="view-head">
      <p class="eyebrow">${icon('belief')}Belief memory</p>
      <h1>Beliefs</h1>
      <p class="lead">What the research system currently believes, with the Evidence volume behind each recorded Claim. Coverage is not confidence.</p>
    </div>
    ${filterBar({
      action: '/beliefs',
      demo,
      search: { name: 'q', value: query.q, label: 'Search beliefs', placeholder: 'Search belief statements…' },
      selects: [
        { name: 'category', label: 'Category', allLabel: 'All categories', value: query.category, options: index.categories.map((category) => ({ value: category, label: category })) },
        { name: 'status', label: 'Status', allLabel: 'All statuses', value: query.status, options: index.statuses.map((status) => ({ value: status, label: sentenceCase(status) })) },
        { name: 'sort', label: 'Sort', allLabel: 'Newest first', value: query.sort === 'recent' ? '' : query.sort, options: [
          { value: 'oldest', label: 'Oldest first' },
          { value: 'category', label: 'Category' },
          { value: 'status', label: 'Status' }
        ] }
      ],
      hidden: [{ name: 'subject', value: query.subject }]
    })}
    <p class="filter-help">${escapeHtml(summary)} · domain object: Claim · product view: Belief</p>
    ${emptyState}
    ${rows ? `<ul class="rows">${rows}</ul>` : ''}
    ${pagination({ base: '/beliefs', filters: filtersFor(query), pagination: index.pagination, demo })}
    ${checkpoint('Can you find the belief you need without knowing its internal Claim id?')}
  </div>`;
  return { status: 200, title: 'Beliefs', body, context: query.subject ? displayName(query.subject) : 'All subjects' };
}
