// Evidence index (UI-1.5): high-density research browser over all recorded
// Evidence. Dense rows with a stable metadata rhythm for fast scanning.
import { buildEvidenceIndex, displayName } from '../projection.js';
import { serializeIndexQuery } from '../query.js';
import {
  checkpoint, escapeHtml, filterBar, icon, linkChip, pagination,
  provenanceChip, termHelp, timeDate, timeRange, truncate, withDemo, withReturnTo
} from './layout.js';

function filtersFor(query) {
  return {
    q: query.q,
    source: query.source,
    link: query.link,
    review: query.review,
    subject: query.subject,
    sort: query.sort === 'recent' ? '' : query.sort
  };
}

// One consolidated metadata rhythm per row (at most three items):
// source · period · metric (page is the fallback when no metric is recorded).
// Missing values are omitted rather than padded with placeholders.
function metaLine(row) {
  const parts = [escapeHtml(truncate(row.sourceTitle ?? 'source not recorded', 64))];
  const when = row.periodStart || row.periodEnd ? timeRange(row.periodStart, row.periodEnd) : timeDate(row.observedAt);
  if (when !== 'Not recorded') parts.push(when);
  if (row.metric) parts.push(escapeHtml(truncate(row.metric, 48)));
  else if (row.page) parts.push(`page ${escapeHtml(row.page)}`);
  return parts.join('<span class="sep">·</span>');
}

export function evidenceIndexView({ source, demo, query }) {
  const index = buildEvidenceIndex(source, query);
  const contextQuery = serializeIndexQuery('/evidence', query, false);
  const from = contextQuery ? `/evidence${serializeIndexQuery('/evidence', query, demo)}` : '';
  const rows = index.rows.map((row) => `
    <li class="row row-dense">
      <span class="row-marker" aria-hidden="true">${icon('evidence')}</span>
      <div class="row-body">
        <a class="row-title" href="${escapeHtml(withReturnTo(`/evidence/${encodeURIComponent(row.evidenceId)}`, { from, demo }))}">${escapeHtml(truncate(row.statement ?? 'Evidence statement not recorded', 200))}</a>
        <p class="row-meta">${metaLine(row)}</p>
      </div>
      <div class="row-side">
        ${linkChip(row.linkCount, { compact: true })}
        ${provenanceChip(row.reviewed, { compact: true })}
      </div>
    </li>`).join('');

  const noEvidence = index.total === 0;
  const noMatches = !noEvidence && index.pagination.total === 0;
  const emptyState = noEvidence
    ? '<p class="note strong empty-state">No Evidence records recorded yet.</p>'
    : noMatches
      ? `<p class="note strong empty-state">No Evidence records match these filters.</p>
      <p><a class="button-link" href="${escapeHtml(withDemo('/evidence', demo))}">Clear filters</a></p>`
      : '';

  const summary = index.filtersActive && !noMatches
    ? `All recorded facts · ${index.pagination.total} of ${index.total} match the current filters`
    : `All recorded facts · ${index.total} records`;

  const body = `
  <div class="view">
    <div class="view-head">
      <h1>Evidence</h1>
      <p class="lead">${escapeHtml(summary)}.</p>
      ${termHelp('Evidence', 'A verified factual record extracted from a source document.')}
    </div>
    ${filterBar({
      action: '/evidence',
      demo,
      search: { name: 'q', value: query.q, label: 'Search Evidence', placeholder: 'Search recorded text…' },
      selects: [
        { name: 'source', label: 'Source', allLabel: 'All sources', value: query.source, options: index.sources.map((record) => ({ value: record.id, label: truncate(record.title, 60) })) },
        { name: 'link', label: 'Claim link', allLabel: 'Link: any', value: query.link, options: [
          { value: 'linked', label: 'Linked to a Claim' },
          { value: 'unlinked', label: 'Not linked to a Claim' }
        ] },
        { name: 'review', label: 'Admission review', allLabel: 'Review: any', value: query.review, options: [
          { value: 'reviewed', label: 'Has admission review' },
          { value: 'unreviewed', label: 'No admission review' }
        ] },
        { name: 'sort', label: 'Sort', allLabel: 'Sort: newest recorded', value: query.sort === 'recent' ? '' : query.sort, options: [
          { value: 'oldest', label: 'Sort: oldest first' },
          { value: 'category', label: 'Sort: category' },
          { value: 'page', label: 'Sort: page' }
        ] }
      ],
      hidden: [{ name: 'subject', value: query.subject }]
    })}
    ${emptyState}
    ${rows ? `<ul class="rows">${rows}</ul>` : ''}
    ${pagination({ base: '/evidence', filters: filtersFor(query), pagination: index.pagination, demo })}
    ${checkpoint('Can you locate any recorded fact you remember?')}
  </div>`;
  return { status: 200, title: 'Evidence', body, context: query.subject ? displayName(query.subject) : 'All subjects' };
}
