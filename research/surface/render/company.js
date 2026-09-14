// Company context page (UI-1.5): subject scope with clear paths into the
// Claims and Evidence indexes, adapted to the workspace shell.
import { buildCompany } from '../projection.js';
import {
  badge, checkpoint, countChip, escapeHtml, icon, linkChip, panelTitle,
  provenanceChip, sectionHead, statusLabel, statusTone, timeDate, timeInstant,
  truncate, withDemo
} from './layout.js';

function stateItem(key, value) {
  return `<li class="state-item"><span class="state-key">${escapeHtml(key)}</span><span class="state-value">${value}</span></li>`;
}

export function companyView({ source, demo }, subjectId) {
  const company = buildCompany(source, subjectId);
  if (!company) {
    return {
      status: 404,
      title: 'Company not found',
      body: `<div class="view"><p class="eyebrow">Research Memory</p><h1>Company not found</h1>
      <p class="lead">No Research Memory records exist for subject <code>${escapeHtml(subjectId)}</code>.</p>
      <p class="note">Try the <a href="${escapeHtml(withDemo('/', demo))}">Research Inbox</a> to see the companies currently under research.</p></div>`
    };
  }
  const { subject } = company;
  const chips = [
    countChip(subject.claims, 'Claims'),
    countChip(subject.evidence, 'Evidence'),
    countChip(subject.sources, 'Sources')
  ];
  if (subject.reviewedProvenance) chips.push(countChip(subject.reviewedProvenance, 'Evidence with admission review'));

  const claimsHref = withDemo(`/claims?subject=${encodeURIComponent(subject.subjectId)}`, demo);
  const evidenceHref = withDemo(`/evidence?subject=${encodeURIComponent(subject.subjectId)}`, demo);

  const claimRows = company.claims.map((claim) => `
    <li class="row">
      <span class="row-marker" aria-hidden="true">${icon('claim')}</span>
      <div class="row-body">
        <a class="row-title" href="${escapeHtml(withDemo(`/claim/${encodeURIComponent(claim.claimId)}`, demo))}">${escapeHtml(truncate(claim.statement ?? 'Claim statement not recorded', 170))}</a>
        <p class="row-meta">${escapeHtml(claim.category ?? 'category not recorded')}<span class="sep">·</span>revision v${escapeHtml(claim.version ?? '?')}<span class="sep">·</span>updated ${timeInstant(claim.updatedAt)}</p>
        <p class="row-chips">
          ${badge(statusLabel(claim.status), statusTone(claim.status))}
          ${claim.confidence !== null && claim.confidence !== undefined ? badge(`confidence ${claim.confidence}`, 'neutral') : ''}
        </p>
      </div>
      <div class="row-side">
        <span class="meta">${escapeHtml(claim.supportCount)} supporting Evidence record${claim.supportCount === 1 ? '' : 's'}${claim.counterCount ? ` · ${escapeHtml(claim.counterCount)} counter Evidence` : ''}${claim.missingReferences ? ` · ${escapeHtml(claim.missingReferences)} unresolved reference(s)` : ''}</span>
      </div>
    </li>`).join('');

  const evidenceList = company.recentEvidence.map((entry) => `
    <li class="record">
      <a href="${escapeHtml(withDemo(`/evidence/${encodeURIComponent(entry.evidenceId)}`, demo))}">${escapeHtml(truncate(entry.statement ?? entry.evidenceId, 180))}</a>
      <span class="meta">${escapeHtml(entry.metric ?? 'metric not recorded')} · page ${escapeHtml(entry.page ?? 'not recorded')} · recorded ${timeInstant(entry.createdAt)}</span>
      <span class="row-chips">${linkChip(entry.linkCount)} ${provenanceChip(entry.reviewed)}</span>
    </li>`).join('');

  const sourceList = company.sources.map((record) => `
    <li class="record">
      <span>${escapeHtml(record.title ?? record.id)}</span>
      <span class="meta">${escapeHtml(record.publisher ?? 'publisher not recorded')} · ${escapeHtml(record.fiscalPeriod ?? 'period not recorded')} · document date ${timeDate(record.documentDate)} · ${escapeHtml(record.sourceType ?? 'type not recorded')}${record.isPrimarySource ? ' · primary source' : ''}</span>
    </li>`).join('');

  const body = `
  <div class="view">
    <div class="workspace">
      <div class="ws-head">
        <p class="back-link"><a href="${escapeHtml(withDemo('/', demo))}">Back to Research Inbox</a></p>
        <p class="eyebrow">${icon('source')}Company · ${escapeHtml(subject.subjectId)}</p>
        <h1>${escapeHtml(subject.displayName)}</h1>
        <p class="lead">Research Memory view of every recorded object scoped to this subject.</p>
      </div>

      <div class="ws-main">
        <section class="panel quiet">
          <div class="count-row">${chips.join('')}</div>
        </section>
        <section>
          ${sectionHead('Current Research Claims', `${subject.claims} recorded`)}
          <ul class="rows">${claimRows}</ul>
          <p class="note">Knowledge-map organization is not implemented yet. Claims are shown individually exactly as recorded in Research Memory.</p>
        </section>
        <section>
          ${sectionHead('Recent Evidence', `${company.recentEvidence.length} most recent`)}
          <ul class="record-list">${evidenceList}</ul>
        </section>
        <section>
          ${sectionHead('Sources', `${company.sources.length} recorded`)}
          <ul class="record-list">${sourceList}</ul>
        </section>
        ${checkpoint('Can you understand the current research state?')}
      </div>

      <aside class="ws-context" aria-label="Subject scope">
        <section class="panel">
          ${panelTitle('Subject state', 'source')}
          <ul class="state-list">
            ${stateItem('Claims', escapeHtml(subject.claims))}
            ${stateItem('Evidence', escapeHtml(subject.evidence))}
            ${stateItem('Sources', escapeHtml(subject.sources))}
            ${stateItem('Evidence with admission review', escapeHtml(subject.reviewedProvenance))}
            ${stateItem('Latest activity', timeInstant(subject.latestEvidenceAt ?? subject.latestRevisionAt))}
          </ul>
        </section>
        <section class="panel">
          ${panelTitle('Scoped indexes', 'link')}
          <p class="note"><a href="${escapeHtml(claimsHref)}">View all Claims</a></p>
          <p class="note"><a href="${escapeHtml(evidenceHref)}">View all Evidence</a></p>
        </section>
      </aside>
    </div>
  </div>`;
  return { status: 200, title: `${subject.displayName} · Company`, body, context: subject.displayName };
}
