// Evidence detail (UI-1.5): recorded fact workspace. Main column = the fact
// and how it was admitted; context column = relationship, source, provenance.
import { buildEvidence, displayName } from '../projection.js';
import {
  backToIndex, badge, checkpoint, escapeHtml, icon, linkChip, panelTitle,
  provenanceChip, railViz, sectionHead, statusLabel, statusTone, termHelp,
  timeDate, timeInstant, timeRange, truncate, withDemo
} from './layout.js';

function metaRow(label, value) {
  return `<li class="record"><span>${escapeHtml(label)}</span><span>${value ?? 'Not recorded'}</span></li>`;
}

export function evidenceView({ source, demo, from = '' }, evidenceId) {
  const record = buildEvidence(source, evidenceId);
  const backHref = backToIndex('/evidence', from, demo);
  if (!record) {
    return {
      status: 404,
      title: 'Evidence not found',
      body: `<div class="view"><p class="eyebrow">Research Memory</p><h1>Evidence not found</h1>
      <p class="lead">No Evidence record exists with id <code>${escapeHtml(evidenceId)}</code> in the current Research Memory.</p>
      <p class="note">Try the <a href="${escapeHtml(backHref)}">Evidence index</a> to browse recorded Evidence.</p></div>`
    };
  }
  const { evidence, source: sourceRecord } = record;

  const referenceRows = record.linkedClaims.map((link) => `
    <li class="record">
      <a href="${escapeHtml(withDemo(`/claim/${encodeURIComponent(link.claimId)}`, demo))}">${escapeHtml(truncate(link.statement ?? link.claimId, 160))}</a>
      <span class="row-chips">
        ${badge(statusLabel(link.status), statusTone(link.status))}
        <span class="meta">${escapeHtml(link.category ?? 'category not recorded')} · ${escapeHtml(link.role)} Evidence · updated ${timeInstant(link.updatedAt)}</span>
        <a class="meta" href="${escapeHtml(withDemo(`/company/${encodeURIComponent(link.subjectId)}`, demo))}">${escapeHtml(link.subjectId)}</a>
      </span>
    </li>`).join('');

  const admissionRows = record.admissions.map((admission) => `
    <tr>
      <td data-label="Decision">${badge(admission.decision ?? 'recorded', admission.decision === 'accepted' ? 'positive' : 'caution')}</td>
      <td data-label="Reviewer">${escapeHtml(admission.reviewerType ?? 'not recorded')}</td>
      <td data-label="Reason code">${escapeHtml(admission.reasonCode ?? 'not recorded')}</td>
      <td data-label="Outcome">${escapeHtml(admission.outcome ?? 'not recorded')}</td>
      <td data-label="Recorded">${timeInstant(admission.recordedAt)}</td>
    </tr>`).join('');
  const excerpts = record.admissions
    .filter((admission) => admission.candidateExcerpt)
    .map((admission) => `
      <figure class="excerpt">
        <blockquote>${escapeHtml(truncate(admission.candidateExcerpt, 700))}</blockquote>
        <figcaption>Verbatim excerpt recorded in the admission review snapshot (candidate ${escapeHtml(admission.candidateId ?? 'unknown')}, page ${escapeHtml(admission.candidatePage ?? 'not recorded')}). This is a persisted review snapshot, not a live SourceSpan join.</figcaption>
      </figure>`).join('');

  const deeperTrace = record.provenanceDepth === 'evidence-admission-source';
  const provenanceSteps = [
    { label: 'Source', meta: sourceRecord ? (sourceRecord.title ?? sourceRecord.id) : 'source record not found', state: sourceRecord ? 'on' : 'off' },
    { label: 'Admission review', meta: record.admissions.length ? `${record.admissions.length} recorded` : 'not recorded for this Evidence', state: record.admissions.length ? 'deep' : 'off' },
    { label: 'Evidence', meta: 'this record', state: 'on' },
    { label: 'SourceSpan', meta: 'sentence / table-cell join not available yet', state: 'off' }
  ];

  // First-fold summary: which Claim references this Evidence, and how deep the
  // recorded trace runs. The full provenance section stays below.
  const firstRelation = record.linkedClaims[0] ?? null;
  const moreRelations = record.linkedClaims.length - 1;
  const relationship = firstRelation
    ? `${linkChip(record.linkedClaims.length)} <a href="${escapeHtml(withDemo(`/claim/${encodeURIComponent(firstRelation.claimId)}`, demo))}">${escapeHtml(truncate(firstRelation.statement ?? firstRelation.claimId, 96))}</a>${moreRelations > 0 ? `<span class="meta"> +${escapeHtml(moreRelations)} more</span>` : ''}`
    : '<span class="note strong">Not currently linked to a Claim.</span>';
  const summarySteps = [
    { label: 'Source', state: sourceRecord ? 'on' : 'off', note: sourceRecord ? '' : 'source record not found' },
    { label: 'Admission review', state: record.admissions.length ? 'on' : 'off', note: record.admissions.length ? '' : 'not recorded' },
    { label: 'Evidence', state: 'on', note: '' },
    { label: 'SourceSpan', state: 'off', note: 'not available yet' }
  ];
  const contextStrip = `
        <div class="context-strip">
          <div class="strip-row">
            <span class="strip-key">Referenced by</span>
            <div class="strip-value">${relationship}</div>
          </div>
          <div class="strip-row">
            <span class="strip-key">Provenance</span>
            <div class="strip-value">
              <ol class="prov-steps" aria-label="Provenance trace steps">${summarySteps.map((step) => `<li class="prov-step is-${escapeHtml(step.state)}"><span class="prov-dot" aria-hidden="true"></span>${escapeHtml(step.label)}${step.note ? `<span class="prov-note">${escapeHtml(step.note)}</span>` : '<span class="sr-only"> available</span>'}</li>`).join('')}</ol>
              ${provenanceChip(deeperTrace)}
            </div>
          </div>
        </div>`;

  const body = `
  <div class="view">
    <div class="workspace">
      <div class="ws-head">
        <p class="back-link"><a href="${escapeHtml(backHref)}">Back to Evidence</a></p>
        <p class="eyebrow">${icon('evidence')}Evidence · ${escapeHtml(displayName(evidence.subjectId))}</p>
        <h1>${escapeHtml(truncate(evidence.statement ?? evidence.id, 180))}</h1>
        <p class="badge-row">
          ${badge(evidence.category ?? 'category not recorded', 'neutral')}
          ${badge(`page ${evidence.page ?? 'not recorded'}`, 'neutral')}
          ${evidence.verificationLevel ? badge(evidence.verificationLevel, 'positive') : ''}
          ${record.superseded ? badge('superseded by correction', 'caution') : ''}
        </p>
        ${contextStrip}
      </div>

      <div class="ws-main">
        <section>
          ${sectionHead('Recorded fact')}
          <ul class="record-list meta-grid">
            ${metaRow('Metric', escapeHtml(evidence.metric))}
            ${metaRow('Raw value', escapeHtml(`${evidence.rawValue ?? 'not recorded'} ${evidence.rawUnit ?? ''}`.trim()))}
            ${metaRow('Normalized value', escapeHtml(`${evidence.normalizedValue ?? 'not recorded'} ${evidence.unit ?? ''}`.trim()))}
            ${metaRow('Period', timeRange(evidence.periodStart, evidence.periodEnd))}
            ${metaRow('Observed at', timeDate(evidence.observedAt))}
            ${metaRow('Scope', escapeHtml(evidence.scope))}
            ${metaRow('Section', escapeHtml(evidence.section))}
            ${metaRow('Location', escapeHtml(evidence.location))}
            ${metaRow('Confidence', escapeHtml(evidence.confidence))}
          </ul>
        </section>

        <section>
          ${sectionHead('Admission review')}
          ${termHelp('Admission review', 'A record of how a piece of Evidence entered Research Memory.')}
          ${admissionRows
    ? `<table class="table stack"><caption class="table-caption">Admission review records for this Evidence</caption><thead><tr><th scope="col">Decision</th><th scope="col">Reviewer</th><th scope="col">Reason code</th><th scope="col">Outcome</th><th scope="col">Recorded</th></tr></thead><tbody>${admissionRows}</tbody></table>${excerpts}`
    : '<p class="note">No admission review recorded for this Evidence record.</p>'}
        </section>

        <details class="technical">
          <summary>Technical details</summary>
          <ul class="record-list">
            <li class="record"><span>Evidence id</span><code>${escapeHtml(evidence.id)}</code></li>
            <li class="record"><span>Content hash</span><code>${escapeHtml(evidence.contentHash ?? 'not recorded')}</code></li>
            <li class="record"><span>Source content hash</span><code>${escapeHtml(evidence.provenance?.sourceContentHash ?? 'not recorded')}</code></li>
            <li class="record"><span>Provenance method</span><code>${escapeHtml(evidence.provenance?.method ?? 'not recorded')}</code></li>
            <li class="record"><span>Source id</span><code>${escapeHtml(evidence.sourceId ?? 'not recorded')}</code></li>
            <li class="record"><span>Subject</span><code>${escapeHtml(evidence.subjectId)}</code></li>
          </ul>
        </details>

        ${checkpoint('Can you trust where this fact came from?')}
      </div>

      <aside class="ws-context" aria-label="Evidence context">
        <section class="panel">
          ${panelTitle('Referenced by Claims', 'link')}
          ${referenceRows ? `<ul class="record-list">${referenceRows}</ul>`
    : `<p class="note strong">Not currently linked to a Claim.</p>
      <p class="note">This Evidence remains in Research Memory without an active Claim relationship.</p>
      <p class="note"><a href="${escapeHtml(withDemo('/evidence?link=unlinked', demo))}">Browse Evidence not linked to a Claim</a></p>`}
        </section>

        <section class="panel">
          ${panelTitle('Source', 'source')}
          ${sourceRecord ? `<ul class="record-list meta-grid">
            ${metaRow('Title', escapeHtml(sourceRecord.title))}
            ${metaRow('Publisher', escapeHtml(sourceRecord.publisher))}
            ${metaRow('Document date', timeDate(sourceRecord.documentDate))}
            ${metaRow('Fiscal period', escapeHtml(sourceRecord.fiscalPeriod))}
            ${metaRow('Source type', escapeHtml(sourceRecord.sourceType))}
            ${metaRow('Primary source', sourceRecord.isPrimarySource ? 'Yes' : 'No')}
            ${metaRow('Source id', `<code>${escapeHtml(sourceRecord.id)}</code>`)}
          </ul>
          <p class="meta">Source URL (recorded): <code class="wrap">${escapeHtml(sourceRecord.url ?? 'not recorded')}</code></p>`
    : '<p class="note">Source record not found in the current Research Memory.</p>'}
        </section>

        <section class="panel">
          ${panelTitle('Provenance depth', 'trace')}
          ${railViz(provenanceSteps)}
          <p class="note strong">Provenance depth available: ${escapeHtml(record.provenanceDepth === 'evidence-admission-source' ? 'Evidence → Admission → Source' : 'Evidence → Source')}</p>
          <p class="note">Deeper SourceSpan join (sentence / table cell): not available in current product projection.</p>
          ${termHelp('Provenance', 'The trace from a research record back toward its source.')}
        </section>
      </aside>
    </div>
  </div>`;
  return { status: 200, title: 'Evidence', body, context: displayName(evidence.subjectId) };
}
