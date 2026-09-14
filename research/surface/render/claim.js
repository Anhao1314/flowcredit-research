// Claim detail (UI-1.5): evidence-centric workspace. The Claim header carries
// identity; the main column is the Evidence itself; the context column holds
// recorded Claim state and the revision rail.
import { buildClaim } from '../projection.js';
import {
  badge, checkpoint, escapeHtml, icon, lineageLane, panelTitle, railViz,
  backToIndex, sectionHead, statusLabel, statusTone, termHelp, tickStrip,
  timeInstant, truncate, withDemo
} from './layout.js';

function admissionLine(admission) {
  if (!admission) return '<span class="meta">No admission review recorded for this Evidence record.</span>';
  return `<span class="meta">Admission review: ${escapeHtml(admission.decision ?? 'recorded')} · ${escapeHtml(admission.reviewerType ?? 'reviewer not recorded')} · ${escapeHtml(admission.reasonCode ?? 'reason not recorded')} · recorded ${timeInstant(admission.recordedAt)}</span>`;
}

function evidenceRow(item, demo, role) {
  return `<li class="row">
      <span class="row-marker" aria-hidden="true">${icon('evidence')}</span>
      <div class="row-body">
        <a class="row-title" href="${escapeHtml(withDemo(`/evidence/${encodeURIComponent(item.evidenceId)}`, demo))}">${escapeHtml(truncate(item.statement ?? item.evidenceId, 200))}</a>
        <p class="row-meta">${escapeHtml(item.metric ?? 'metric not recorded')}<span class="sep">·</span>page ${escapeHtml(item.page ?? 'not recorded')}<span class="sep">·</span>${escapeHtml(item.sourceTitle ?? 'source not recorded')}<span class="sep">·</span>recorded ${timeInstant(item.createdAt)}</p>
        ${admissionLine(item.admission)}
        ${role === 'counter' ? `<p class="row-chips">${badge('counter evidence', 'caution')}</p>` : ''}
      </div>
    </li>`;
}

function stateItem(key, value) {
  return `<li class="state-item"><span class="state-key">${escapeHtml(key)}</span><span class="state-value">${value}</span></li>`;
}

function coverageTicks(supportCount, counterCount) {
  const support = Math.min(supportCount, 10);
  const counter = Math.min(counterCount, 10);
  const overflow = supportCount > 10 || counterCount > 10 ? '<span class="tick-gap" aria-hidden="true"></span>' : '';
  if (!support && !counter) return '';
  return `<span class="count-marks">${support ? tickStrip({ on: support, total: support }) : ''}${counter ? tickStrip({ on: counter, total: counter, onClass: 'is-counter' }) : ''}${overflow}</span>`;
}

export function claimView({ source, demo, from = '' }, claimId) {
  const claim = buildClaim(source, claimId);
  const backHref = backToIndex('/claims', from, demo);
  if (!claim) {
    return {
      status: 404,
      title: 'Claim not found',
      body: `<div class="view"><p class="eyebrow">Research Memory</p><h1>Claim not found</h1>
      <p class="lead">No Claim exists with id <code>${escapeHtml(claimId)}</code> in the current Research Memory.</p>
      <p class="note">Try the <a href="${escapeHtml(backHref)}">Claims index</a> to browse recorded Claims.</p></div>`
    };
  }
  const current = claim.claim ?? {};
  const subjectHref = withDemo(`/company/${encodeURIComponent(claim.subjectId)}`, demo);
  const supports = claim.provenance.length;
  const counters = claim.counterProvenance.length;
  const currentVersion = claim.current?.version ?? null;

  const supportingRows = claim.provenance.map((item) => evidenceRow(item, demo, 'supporting')).join('');
  const counterRows = claim.counterProvenance.map((item) => evidenceRow(item, demo, 'counter')).join('');

  const historyRows = claim.revisions.map((revision) => `
    <tr>
      <td data-label="Revision">v${escapeHtml(revision.version)}</td>
      <td data-label="Status">${badge(statusLabel(revision.claim?.status), statusTone(revision.claim?.status))}</td>
      <td data-label="Confidence">${escapeHtml(revision.claim?.confidence ?? 'not recorded')}</td>
      <td data-label="Reason">${escapeHtml(revision.revisionReason ?? 'not recorded')}</td>
      <td data-label="Effective">${timeInstant(revision.effectiveAt)}</td>
      <td data-label="Recorded">${timeInstant(revision.createdAt)}</td>
    </tr>`).join('');

  const revisionSteps = claim.revisions.slice(-4).map((revision) => ({
    label: `v${revision.version} · ${statusLabel(revision.claim?.status)}`,
    meta: `effective ${revision.effectiveAt ? revision.effectiveAt.slice(0, 10) : 'not recorded'}`,
    state: revision.version === currentVersion ? 'on' : 'off'
  }));

  const sourceCount = new Set([...claim.provenance, ...claim.counterProvenance].map((item) => item.sourceTitle).filter(Boolean)).size;
  const lineage = lineageLane([
    { iconName: 'source', label: sourceCount === 1 ? 'Source' : 'Sources', count: sourceCount },
    { iconName: 'evidence', label: 'Evidence', count: supports + counters },
    { iconName: 'claim', label: 'Claim', count: null, current: true },
    { iconName: 'change', label: 'No belief changes yet', count: null }
  ]);

  const unresolved = claim.supporting.missing.length + claim.counter.missing.length;
  const body = `
  <div class="view">
    <div class="workspace">
      <div class="ws-head">
        <p class="back-link"><a href="${escapeHtml(backHref)}">Back to Claims</a></p>
        <p class="eyebrow">${icon('claim')}Claim · <a href="${escapeHtml(subjectHref)}">${escapeHtml(claim.subjectId)}</a> (${escapeHtml(claim.subjectName)})</p>
        <h1>${escapeHtml(current.statement ?? 'Claim statement not recorded')}</h1>
        <p class="badge-row">
          ${badge(statusLabel(current.status), statusTone(current.status))}
          ${badge(`revision v${currentVersion ?? '?'}`, 'neutral')}
          ${current.category ? badge(current.category, 'neutral') : ''}
          ${supports ? badge(`${supports} supporting Evidence`, 'neutral') : ''}
          ${counters ? badge(`${counters} counter Evidence`, 'caution') : ''}
          ${current.confidence !== undefined && current.confidence !== null ? badge(`confidence ${current.confidence}`, 'neutral') : ''}
        </p>
        ${lineage}
      </div>

      <div class="ws-main">
        <section>
          ${sectionHead('Evidence behind it', `${supports + counters} linked`)}
          ${termHelp('Evidence', 'A verified factual record extracted from a source document.')}
          ${supportingRows ? `<ul class="rows">${supportingRows}</ul>` : '<p class="note">No supporting Evidence records are linked to this Claim.</p>'}
          ${counterRows ? `<h3 class="section-block-label">Counter evidence</h3><ul class="rows">${counterRows}</ul>` : ''}
          ${unresolved ? `<p class="note">${escapeHtml(unresolved)} linked Evidence reference(s) could not be resolved in the current Research Memory.</p>` : ''}
          <p class="note">Coverage describes linked evidence volume, not Claim truth or confidence. Explanation source: recorded revision method and linked Evidence records only. No generated explanation is produced by this surface.</p>
        </section>

        <section>
          ${sectionHead('Revision history')}
          <table class="table stack">
            <caption class="table-caption">Recorded revisions of this Claim</caption>
            <thead><tr><th scope="col">Revision</th><th scope="col">Status</th><th scope="col">Confidence</th><th scope="col">Reason</th><th scope="col">Effective</th><th scope="col">Recorded</th></tr></thead>
            <tbody>${historyRows}</tbody>
          </table>
        </section>

        <details class="technical">
          <summary>Technical details</summary>
          <ul class="record-list">
            <li class="record"><span>Claim id</span><code>${escapeHtml(claim.identity.id)}</code></li>
            <li class="record"><span>Subject</span><code>${escapeHtml(claim.subjectId)}</code></li>
            <li class="record"><span>Current revision</span><code>${escapeHtml(claim.current ? `${claim.current.id}` : 'not recorded')}</code></li>
            <li class="record"><span>Revision reason</span><code>${escapeHtml(claim.current?.revisionReason ?? 'not recorded')}</code></li>
            <li class="record"><span>Linked Evidence ids</span><code>${escapeHtml([...(current.supportingEvidenceIds ?? []), ...(current.counterEvidenceIds ?? [])].join(', ') || 'none recorded')}</code></li>
            <li class="record"><span>Recorded method</span><span>${escapeHtml(current.method ?? 'not recorded')}</span></li>
          </ul>
        </details>

        ${checkpoint('Can you understand why this belief exists?')}
      </div>

      <aside class="ws-context" aria-label="Claim state">
        <section class="panel">
          ${panelTitle('Claim state', 'claim')}
          <ul class="state-list">
            ${stateItem('Status', badge(statusLabel(current.status), statusTone(current.status)))}
            ${stateItem('Category', escapeHtml(current.category ?? 'not recorded'))}
            ${stateItem('Revision', `v${escapeHtml(currentVersion ?? '?')}`)}
            ${stateItem('Evidence count', `${escapeHtml(supports)} supporting · ${escapeHtml(counters)} counter`)}
            ${stateItem('Subject', `<a href="${escapeHtml(subjectHref)}">${escapeHtml(claim.subjectName)}</a>`)}
            ${stateItem('Last updated', timeInstant(current.updatedAt ?? claim.current?.createdAt))}
          </ul>
        </section>

        <section class="panel">
          ${panelTitle('Evidence coverage', 'link')}
          ${coverageTicks(supports, counters) || '<p class="meta">No linked Evidence records.</p>'}
          <p class="strip-legend"><span>${escapeHtml(supports)} supporting</span><span>${escapeHtml(counters)} counter</span></p>
          <p class="note">Linked Evidence volume — not Claim confidence.</p>
        </section>

        ${revisionSteps.length ? `<section class="panel">
          ${panelTitle('Revision rail', 'trace')}
          ${railViz(revisionSteps)}
        </section>` : ''}
      </aside>
    </div>
  </div>`;
  return { status: 200, title: 'Claim', body, context: claim.subjectName };
}
