// Evidence Receipt (UI-2.0): one factual record, where it came from,
// who admitted it, and which beliefs currently reference it.
import { buildEvidence, displayName } from '../projection.js';
import {
  backToIndex, badge, checkpoint, escapeHtml, icon, linkChip, panelTitle,
  provenanceChip, railViz, timeDate, timeInstant, timeRange, truncate, withDemo
} from './layout.js';

function metaRow(label, value) {
  return `<li class="record"><span>${escapeHtml(label)}</span><span>${value ?? 'Not recorded'}</span></li>`;
}

function roleBadge(role) {
  return role === 'counter' ? badge('COUNTERS','caution') : badge('SUPPORTS','positive');
}

export function evidenceView({ source, demo, from = '' }, evidenceId) {
  const record = buildEvidence(source,evidenceId);
  const backHref = backToIndex('/evidence',from,demo);
  if (!record) {
    return {
      status:404,
      title:'Evidence not found',
      body:`<div class="view"><div class="view-head"><p class="eyebrow">Evidence receipt</p><h1>Evidence not found</h1><p class="lead">No Evidence record exists with id <code>${escapeHtml(evidenceId)}</code>.</p></div><p><a class="button-link" href="${escapeHtml(backHref)}">Back to Evidence</a></p></div>`
    };
  }

  const evidence = record.evidence;
  const sourceRecord = record.source;
  const deeperTrace = record.provenanceDepth === 'evidence-admission-source';
  const referenceRows = record.linkedClaims.map((link) => `
    <li class="record">
      <span class="badge-row">${roleBadge(link.role)}</span>
      <a href="${escapeHtml(withDemo(`/claim/${encodeURIComponent(link.claimId)}`,demo))}">${escapeHtml(truncate(link.statement ?? link.claimId,150))}</a>
      <span class="meta">Belief status: ${escapeHtml(link.status ?? 'not recorded')} · updated ${timeInstant(link.updatedAt)}</span>
    </li>`).join('');

  const admissionRows = record.admissions.map((admission) => `
    <tr>
      <td data-label="Decision">${escapeHtml(admission.decision ?? 'not recorded')}</td>
      <td data-label="Reviewer">${escapeHtml(admission.reviewerType ?? 'not recorded')}</td>
      <td data-label="Reason">${escapeHtml(admission.reasonCode ?? 'not recorded')}</td>
      <td data-label="Recorded">${timeInstant(admission.recordedAt)}</td>
    </tr>`).join('');

  const provenanceSteps = [
    {label:'Source',meta:sourceRecord?sourceRecord.title:'source record missing',state:sourceRecord?'on':'off'},
    {label:'Admission review',meta:record.admissions.length?`${record.admissions.length} recorded`:'not recorded',state:record.admissions.length?'on':'off'},
    {label:'Evidence',meta:evidence.id,state:'on'},
    {label:'SourceSpan',meta:'sentence / table-cell join unavailable',state:'off'}
  ];

  const body=`
  <div class="view evidence-receipt">
    <div class="workspace">
      <header class="ws-head">
        <p class="back-link"><a href="${escapeHtml(backHref)}">← Back to Evidence</a></p>
        <p class="eyebrow">${icon('evidence')}Evidence Receipt · ${escapeHtml(displayName(evidence.subjectId))}</p>
        <h1 class="evidence-quote">${escapeHtml(evidence.statement ?? 'Evidence statement not recorded')}</h1>
        <p class="badge-row">
          ${badge(evidence.category ?? 'category not recorded','neutral')}
          ${evidence.verificationLevel?badge(evidence.verificationLevel,'positive'):''}
          ${record.superseded?badge('superseded by correction','caution'):''}
          ${linkChip(record.linkedClaims.length)}
          ${provenanceChip(deeperTrace)}
        </p>
        <div class="context-strip">
          <div class="strip-row"><span class="strip-key">Source</span><div class="strip-value">${sourceRecord?escapeHtml(sourceRecord.title ?? sourceRecord.id):'<span class="note strong">Source record not found.</span>'}</div></div>
          <div class="strip-row"><span class="strip-key">Location</span><div class="strip-value">${escapeHtml(evidence.section ?? 'section not recorded')} · page ${escapeHtml(evidence.page ?? 'not recorded')} · ${escapeHtml(evidence.location ?? 'location not recorded')}</div></div>
          <div class="strip-row"><span class="strip-key">Referenced by</span><div class="strip-value">${record.linkedClaims.length?`${escapeHtml(record.linkedClaims.length)} Belief${record.linkedClaims.length===1?'':'s'}`:'No current Belief'}</div></div>
        </div>
      </header>

      <div class="ws-main">
        <section>
          <div class="section-head"><h2>Recorded fact</h2><span class="section-meta">persisted Evidence</span></div>
          <ul class="record-list meta-grid">
            ${metaRow('Metric',escapeHtml(evidence.metric ?? 'not recorded'))}
            ${metaRow('Raw value',escapeHtml(`${evidence.rawValue ?? 'not recorded'} ${evidence.rawUnit ?? ''}`.trim()))}
            ${metaRow('Normalized value',escapeHtml(`${evidence.normalizedValue ?? 'not recorded'} ${evidence.unit ?? ''}`.trim()))}
            ${metaRow('Period',timeRange(evidence.periodStart,evidence.periodEnd))}
            ${metaRow('Observed at',timeDate(evidence.observedAt))}
            ${metaRow('Scope',escapeHtml(evidence.scope ?? 'not recorded'))}
            ${metaRow('Recorded',timeInstant(evidence.createdAt))}
          </ul>
        </section>

        <section class="section">
          <div class="section-head"><h2>Admission</h2><span class="section-meta">${escapeHtml(record.admissions.length)} review record${record.admissions.length===1?'':'s'}</span></div>
          ${admissionRows?`<table class="table stack"><thead><tr><th scope="col">Decision</th><th scope="col">Reviewer</th><th scope="col">Reason</th><th scope="col">Recorded</th></tr></thead><tbody>${admissionRows}</tbody></table>`:'<p class="note strong">No admission review recorded for this Evidence record.</p>'}
          <p class="note">Admission provenance describes how this Evidence entered Research Memory. It does not make the Evidence true by itself.</p>
        </section>

        <section class="section">
          <div class="section-head"><h2>Used by beliefs</h2><span class="section-meta">${escapeHtml(record.linkedClaims.length)} link${record.linkedClaims.length===1?'':'s'}</span></div>
          ${referenceRows?`<ul class="record-list">${referenceRows}</ul>`:'<p class="note strong">Not currently linked to a Belief.</p><p class="note">The Evidence remains inspectable in Research Memory even when no current Claim references it.</p>'}
        </section>

        <details class="technical">
          <summary>Technical record</summary>
          <ul class="record-list meta-grid">
            ${metaRow('Evidence id',`<code>${escapeHtml(evidence.id)}</code>`)}
            ${metaRow('Content hash',`<code class="wrap">${escapeHtml(evidence.contentHash ?? 'not recorded')}</code>`)}
            ${metaRow('Source content hash',`<code class="wrap">${escapeHtml(evidence.provenance?.sourceContentHash ?? 'not recorded')}</code>`)}
            ${metaRow('Provenance method',`<code>${escapeHtml(evidence.provenance?.method ?? 'not recorded')}</code>`)}
            ${metaRow('Source id',`<code>${escapeHtml(evidence.sourceId ?? 'not recorded')}</code>`)}
          </ul>
        </details>
        ${checkpoint('Can you trace this fact back toward its source without trusting a generated summary?')}
      </div>

      <aside class="ws-context" aria-label="Evidence provenance">
        <section class="panel">
          ${panelTitle('Provenance','trace')}
          ${railViz(provenanceSteps)}
          <p class="note strong">Available depth: ${escapeHtml(deeperTrace?'Evidence → Admission → Source':'Evidence → Source')}</p>
        </section>

        <section class="panel">
          ${panelTitle('Source','source')}
          ${sourceRecord?`<ul class="state-list">
            ${metaRow('Publisher',escapeHtml(sourceRecord.publisher ?? 'not recorded'))}
            ${metaRow('Document date',timeDate(sourceRecord.documentDate))}
            ${metaRow('Fiscal period',escapeHtml(sourceRecord.fiscalPeriod ?? 'not recorded'))}
            ${metaRow('Primary source',sourceRecord.isPrimarySource?'Yes':'No')}
          </ul><p class="meta">Recorded URL: <code class="wrap">${escapeHtml(sourceRecord.url ?? 'not recorded')}</code></p>`:'<p class="note">Source record not found.</p>'}
        </section>

        <section class="panel receipt">
          ${panelTitle('Authority boundary','review')}
          <div class="receipt-warning">Evidence is a factual record. It is not a Claim, Relation, Impact or investment decision.</div>
          <ul class="state-list">
            ${metaRow('Claim mutation','not allowed')}
            ${metaRow('Relation inferred here','no')}
            ${metaRow('Human authority','preserved')}
          </ul>
        </section>
      </aside>
    </div>
  </div>`;

  return {status:200,title:'Evidence Receipt',body,context:displayName(evidence.subjectId)};
}
