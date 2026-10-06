// Belief detail (UI-2.0B): reasoning-first workbench.
//
// Important semantic boundary:
// - supportingEvidenceIds / counterEvidenceIds are recorded link roles on the
//   current Claim revision.
// - they are NOT persisted pairwise RelationReceipts.
// The inspector makes that absence explicit instead of manufacturing runtime
// outputs that Research Memory does not contain.
import { buildClaim } from '../projection.js';
import {
  badge, checkpoint, escapeHtml, icon, lineageLane, panelTitle, railViz,
  backToIndex, sectionHead, statusLabel, statusTone, termHelp, tickStrip,
  timeInstant, truncate, withDemo
} from './layout.js';

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

function roleTone(role) {
  return role === 'counter' ? 'caution' : 'positive';
}

function roleLabel(role) {
  return role === 'counter' ? 'Recorded counter link' : 'Recorded supporting link';
}

function evidenceMeta(item) {
  const parts = [];
  if (item.metric) parts.push(escapeHtml(item.metric));
  if (item.sourceTitle) parts.push(escapeHtml(item.sourceTitle));
  if (item.page !== null && item.page !== undefined) parts.push(`p.${escapeHtml(item.page)}`);
  if (item.createdAt) parts.push(`recorded ${timeInstant(item.createdAt)}`);
  return parts.join('<span class="sep">·</span>');
}

function admissionSummary(item) {
  if (!item.admission) return '<span class="meta">Admission review not recorded.</span>';
  const review = item.admission;
  return `<span class="meta">Admission ${escapeHtml(review.decision ?? 'recorded')} · ${escapeHtml(review.reviewerType ?? 'reviewer not recorded')} · ${escapeHtml(review.reasonCode ?? 'reason not recorded')} · ${timeInstant(review.recordedAt)}</span>`;
}

function reasoningRow(item, demo, role, index, selected) {
  const inspectorId = `relation-inspector-${index}`;
  return `<li class="reasoning-row">
    <div class="reasoning-row-head">
      ${badge(roleLabel(role), roleTone(role))}
      <span class="meta">${escapeHtml(item.evidenceId)}</span>
    </div>
    <a class="reasoning-statement" href="${escapeHtml(withDemo(`/evidence/${encodeURIComponent(item.evidenceId)}`, demo))}">${escapeHtml(truncate(item.statement ?? item.evidenceId, 220))}</a>
    <p class="row-meta">${evidenceMeta(item)}</p>
    <p class="reasoning-admission">${admissionSummary(item)}</p>
    <button class="reasoning-open" type="button" data-reasoning-target="${inspectorId}" aria-controls="${inspectorId}" aria-pressed="${selected ? 'true' : 'false'}">Inspect reasoning</button>
  </li>`;
}

function unresolvedGroup(supportingMissing, counterMissing) {
  const rows = [
    ...supportingMissing.map((id) => ({ id, role: 'supporting' })),
    ...counterMissing.map((id) => ({ id, role: 'counter' }))
  ];
  if (!rows.length) return '';
  return `<section class="reasoning-group reasoning-unresolved" aria-labelledby="reasoning-unresolved-title">
    <div class="reasoning-group-head">
      <div>
        <p class="eyebrow">Unresolved link records</p>
        <h2 id="reasoning-unresolved-title">Missing Evidence objects</h2>
      </div>
      ${badge(`${rows.length} unresolved`, 'neutral')}
    </div>
    <p class="note">These Evidence ids are recorded on the current Claim revision but cannot be resolved in the current Research Memory. No relation direction is inferred from a missing object.</p>
    <ul class="record-list">
      ${rows.map((row) => `<li class="record"><code>${escapeHtml(row.id)}</code><span class="meta">recorded ${escapeHtml(row.role)} link · Evidence object unavailable</span></li>`).join('')}
    </ul>
  </section>`;
}

function inspectorPanel(item, role, index, selected, current) {
  const id = `relation-inspector-${index}`;
  return `<section class="panel relation-inspector" id="${id}" data-reasoning-panel${selected ? '' : ' hidden'}>
    ${panelTitle('Relation inspector', 'link')}
    <div class="relation-boundary">
      ${badge(roleLabel(role), roleTone(role))}
      ${badge('RelationReceipt not persisted', 'neutral')}
    </div>
    <p class="note strong">Recorded link role ≠ RelationReceipt.</p>
    <p class="note">This Evidence is linked by the current Claim revision as ${escapeHtml(role)}. Research Memory does not yet contain a persisted pairwise RelationReceipt for this real Belief, so the inspector leaves runtime-only fields explicitly unavailable.</p>
    <ul class="state-list relation-fields">
      ${stateItem('Evidence', `<code>${escapeHtml(item.evidenceId)}</code>`)}
      ${stateItem('Claim revision', `<code>${escapeHtml(current?.id ?? 'not recorded')}</code>`)}
      ${stateItem('Recorded link role', badge(role, roleTone(role)))}
      ${stateItem('Revision effective', timeInstant(current?.effectiveAt))}
      ${stateItem('RelationReceipt', '<span class="relation-missing">Not persisted</span>')}
      ${stateItem('as-of', '<span class="relation-missing">Not recorded</span>')}
      ${stateItem('Compatibility', '<span class="relation-missing">Not persisted</span>')}
      ${stateItem('Relation', '<span class="relation-missing">Not persisted</span>')}
      ${stateItem('Reason code', '<span class="relation-missing">Not persisted</span>')}
      ${stateItem('Runtime', '<span class="relation-missing">Not persisted</span>')}
    </ul>
    <div class="relation-provenance">
      <p class="panel-title">${icon('trace')}Available provenance</p>
      <ul class="record-list">
        <li class="record"><span>Source</span><span class="meta">${escapeHtml(item.sourceTitle ?? 'not recorded')}${item.page !== null && item.page !== undefined ? ` · p.${escapeHtml(item.page)}` : ''}</span></li>
        <li class="record"><span>Evidence recorded</span><span class="meta">${timeInstant(item.createdAt)}</span></li>
        <li class="record"><span>Admission review</span><span class="meta">${item.admission ? escapeHtml(item.admission.decision ?? 'recorded') : 'not recorded'}</span></li>
      </ul>
    </div>
  </section>`;
}

export function claimView({ source, demo, from = '' }, claimId) {
  const claim = buildClaim(source, claimId);
  const backHref = backToIndex('/claims', from, demo);
  if (!claim) {
    return {
      status: 404,
      title: 'Belief not found',
      body: `<div class="view"><p class="eyebrow">Research Memory</p><h1>Belief not found</h1>
      <p class="lead">No Claim exists with id <code>${escapeHtml(claimId)}</code> in the current Research Memory.</p>
      <p class="note">Try the <a href="${escapeHtml(backHref)}">Beliefs index</a> to browse recorded research beliefs.</p></div>`
    };
  }

  const current = claim.claim ?? {};
  const subjectHref = withDemo(`/company/${encodeURIComponent(claim.subjectId)}`, demo);
  const supports = claim.provenance.length;
  const counters = claim.counterProvenance.length;
  const currentVersion = claim.current?.version ?? null;

  const reasoningItems = [
    ...claim.provenance.map((item) => ({ item, role: 'supporting' })),
    ...claim.counterProvenance.map((item) => ({ item, role: 'counter' }))
  ];
  const supportingRows = claim.provenance.map((item, index) => reasoningRow(item, demo, 'supporting', index, index === 0)).join('');
  const counterOffset = claim.provenance.length;
  const counterRows = claim.counterProvenance.map((item, index) => reasoningRow(item, demo, 'counter', counterOffset + index, counterOffset + index === 0)).join('');
  const inspectorPanels = reasoningItems.map(({ item, role }, index) => inspectorPanel(item, role, index, index === 0, claim.current)).join('');

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
    { iconName: 'link', label: 'Recorded links', count: supports + counters },
    { iconName: 'claim', label: 'Belief', count: null, current: true },
    { iconName: 'change', label: 'Timeline', count: null }
  ]);

  const body = `
  <div class="view belief-workbench">
    <div class="workspace belief-layout">
      <div class="ws-head belief-head">
        <p class="back-link"><a href="${escapeHtml(backHref)}">Back to Beliefs</a></p>
        <p class="eyebrow">${icon('claim')}Current belief · <a href="${escapeHtml(subjectHref)}">${escapeHtml(claim.subjectName)}</a></p>
        <h1>${escapeHtml(current.statement ?? 'Claim statement not recorded')}</h1>
        <p class="badge-row">
          ${badge(statusLabel(current.status), statusTone(current.status))}
          ${badge(`revision v${currentVersion ?? '?'}`, 'neutral')}
          ${current.category ? badge(current.category, 'neutral') : ''}
          ${supports ? badge(`${supports} supporting link${supports === 1 ? '' : 's'}`, 'positive') : ''}
          ${counters ? badge(`${counters} counter link${counters === 1 ? '' : 's'}`, 'caution') : ''}
        </p>
        <p class="belief-asof">Revision effective ${timeInstant(claim.current?.effectiveAt)} · recorded ${timeInstant(claim.current?.createdAt)}</p>
        ${lineage}
      </div>

      <div class="ws-main">
        <section class="reasoning-intro">
          ${sectionHead('Reasoning', `${supports + counters} resolved Evidence links`)}
          <div class="reasoning-boundary-note">
            <strong>What this page can prove today</strong>
            <span>The current Claim revision records supporting and counter Evidence links. Pairwise RelationReceipts are not persisted for real Research Memory yet, so this page does not invent relation, compatibility, reason-code, runtime or as-of fields.</span>
          </div>
        </section>

        <section class="reasoning-group" aria-labelledby="reasoning-support-title">
          <div class="reasoning-group-head">
            <div><p class="eyebrow">Recorded link role</p><h2 id="reasoning-support-title">Supporting evidence</h2></div>
            ${badge(`${supports} linked`, supports ? 'positive' : 'neutral')}
          </div>
          ${termHelp('Supporting link', 'A current Claim revision references this Evidence in supportingEvidenceIds. This is a recorded link role, not a persisted RelationReceipt.')}
          ${supportingRows ? `<ul class="reasoning-list">${supportingRows}</ul>` : '<p class="note">No supporting Evidence is linked to this Belief.</p>'}
        </section>

        <section class="reasoning-group" aria-labelledby="reasoning-counter-title">
          <div class="reasoning-group-head">
            <div><p class="eyebrow">Recorded link role</p><h2 id="reasoning-counter-title">Counter evidence</h2></div>
            ${badge(`${counters} linked`, counters ? 'caution' : 'neutral')}
          </div>
          ${termHelp('Counter link', 'A current Claim revision references this Evidence in counterEvidenceIds. This is a recorded link role, not a persisted RelationReceipt.')}
          ${counterRows ? `<ul class="reasoning-list">${counterRows}</ul>` : '<p class="note">No counter Evidence is linked to this Belief.</p>'}
        </section>

        ${unresolvedGroup(claim.supporting.missing, claim.counter.missing)}

        <section class="section">
          ${sectionHead('Belief history')}
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
            <li class="record"><span>Current revision</span><code>${escapeHtml(claim.current?.id ?? 'not recorded')}</code></li>
            <li class="record"><span>Revision reason</span><code>${escapeHtml(claim.current?.revisionReason ?? 'not recorded')}</code></li>
            <li class="record"><span>Supporting Evidence ids</span><code>${escapeHtml((current.supportingEvidenceIds ?? []).join(', ') || 'none recorded')}</code></li>
            <li class="record"><span>Counter Evidence ids</span><code>${escapeHtml((current.counterEvidenceIds ?? []).join(', ') || 'none recorded')}</code></li>
            <li class="record"><span>Recorded method</span><span>${escapeHtml(current.method ?? 'not recorded')}</span></li>
          </ul>
        </details>

        ${checkpoint('Can you tell what this Belief says, what supports it, what counters it, and which relation fields are still unavailable?')}
      </div>

      <aside class="ws-context belief-context" aria-label="Belief reasoning inspector">
        <div class="relation-inspector-stack">
          ${inspectorPanels || `<section class="panel relation-inspector relation-empty">
            ${panelTitle('Relation inspector', 'link')}
            <p class="note strong">No resolved Evidence links.</p>
            <p class="note">There is no Evidence object available to inspect for this Belief. No pairwise relation is inferred.</p>
          </section>`}
        </div>

        <section class="panel">
          ${panelTitle('Belief state', 'claim')}
          <ul class="state-list">
            ${stateItem('Status', badge(statusLabel(current.status), statusTone(current.status)))}
            ${stateItem('Category', escapeHtml(current.category ?? 'not recorded'))}
            ${stateItem('Revision', `v${escapeHtml(currentVersion ?? '?')}`)}
            ${stateItem('Evidence links', `${escapeHtml(supports)} supporting · ${escapeHtml(counters)} counter`)}
            ${stateItem('Subject', `<a href="${escapeHtml(subjectHref)}">${escapeHtml(claim.subjectName)}</a>`)}
          </ul>
        </section>

        <section class="panel">
          ${panelTitle('Evidence coverage', 'link')}
          ${coverageTicks(supports, counters) || '<p class="meta">No resolved Evidence links.</p>'}
          <p class="strip-legend"><span>${escapeHtml(supports)} supporting</span><span>${escapeHtml(counters)} counter</span></p>
          <p class="note">Recorded link volume only. Not Claim confidence and not RelationReceipt coverage.</p>
        </section>

        ${revisionSteps.length ? `<section class="panel">
          ${panelTitle('Revision rail', 'trace')}
          ${railViz(revisionSteps)}
        </section>` : ''}
      </aside>
    </div>
  </div>`;
  return { status: 200, title: 'Belief', body, context: claim.subjectName };
}
