// Belief Workbench (UI-2.0). The persisted domain object is still Claim.
// This view makes belief state, evidence roles, provenance and revision time legible
// without pretending that recorded links are persisted RelationReceipts.
import { buildClaim } from '../projection.js';
import {
  badge, backToIndex, checkpoint, escapeHtml, icon, panelTitle, railViz,
  statusLabel, statusTone, timeInstant, truncate, withDemo
} from './layout.js';

function stateItem(key, value) {
  return `<li class="state-item"><span class="state-key">${escapeHtml(key)}</span><span class="state-value">${value}</span></li>`;
}

function reasoningItem(item, demo, role) {
  const tone = role === 'supporting' ? 'positive' : 'caution';
  const label = role === 'supporting' ? 'SUPPORTS' : 'COUNTERS';
  return `<article class="reasoning-item">
    <div class="reasoning-role">${badge(label,tone)}</div>
    <div class="reasoning-body">
      <a class="reasoning-statement" href="${escapeHtml(withDemo(`/evidence/${encodeURIComponent(item.evidenceId)}`,demo))}">${escapeHtml(truncate(item.statement ?? item.evidenceId,260))}</a>
      <p class="reasoning-meta">${escapeHtml(item.sourceTitle ?? 'source not recorded')}<span class="sep">·</span>page ${escapeHtml(item.page ?? 'not recorded')}<span class="sep">·</span>recorded ${timeInstant(item.createdAt)}</p>
      <p class="reasoning-note"><strong>Recorded role:</strong> ${label}. This is the Claim revision's persisted Evidence link role, not a persisted pairwise RelationReceipt.</p>
    </div>
  </article>`;
}

export function claimView({ source, demo, from = '' }, claimId) {
  const belief = buildClaim(source, claimId);
  const backHref = backToIndex('/beliefs', from, demo);
  if (!belief) {
    return {
      status:404,
      title:'Belief not found',
      body:`<div class="view"><div class="view-head"><p class="eyebrow">Belief memory</p><h1>Belief not found</h1><p class="lead">No recorded Claim exists with id <code>${escapeHtml(claimId)}</code>.</p></div><p><a class="button-link" href="${escapeHtml(backHref)}">Back to Beliefs</a></p></div>`
    };
  }

  const currentClaim = belief.claim ?? {};
  const currentVersion = belief.current?.version ?? null;
  const supports = belief.provenance.length;
  const counters = belief.counterProvenance.length;
  const unresolved = belief.supporting.missing.length + belief.counter.missing.length;
  const subjectHref = withDemo(`/company/${encodeURIComponent(belief.subjectId)}`,demo);
  const reasoning = [
    ...belief.provenance.map((item)=>reasoningItem(item,demo,'supporting')),
    ...belief.counterProvenance.map((item)=>reasoningItem(item,demo,'counter'))
  ].join('');

  const revisionRail = belief.revisions.map((revision) => `<div class="revision-node${revision.version===currentVersion?' is-current':''}">
    <strong>v${escapeHtml(revision.version)}</strong>
    <span>${escapeHtml(statusLabel(revision.claim?.status))}</span>
    <span>${timeInstant(revision.effectiveAt)}</span>
  </div>`).join('');

  const provenanceSteps = [
    {label:'Recorded Claim',meta:`v${currentVersion ?? '?'}`,state:'on'},
    {label:'Evidence links',meta:`${supports} supporting · ${counters} counter`,state:(supports+counters)?'on':'off'},
    {label:'RelationReceipt',meta:'not persisted for real Research Memory',state:'off'},
    {label:'Human review',meta:'required before authoritative change',state:'off'}
  ];

  const body=`
  <div class="view belief-view">
    <div class="workspace">
      <header class="ws-head">
        <p class="back-link"><a href="${escapeHtml(backHref)}">← Back to Beliefs</a></p>
        <p class="eyebrow">${icon('belief')}Belief Workbench · <a href="${escapeHtml(subjectHref)}">${escapeHtml(belief.subjectName)}</a></p>
        <div class="belief-hero">
          <div class="belief-hero-main">
            <h1 class="belief-statement">${escapeHtml(currentClaim.statement ?? 'Belief statement not recorded')}</h1>
            <p class="badge-row">
              ${badge(statusLabel(currentClaim.status),statusTone(currentClaim.status))}
              ${badge(`revision v${currentVersion ?? '?'}`,'neutral')}
              ${currentClaim.category?badge(currentClaim.category,'neutral'):''}
              ${supports?badge(`${supports} supporting`,'positive'):''}
              ${counters?badge(`${counters} counter`,'caution'):''}
            </p>
          </div>
        </div>
      </header>

      <div class="ws-main">
        <section>
          <div class="section-head"><h2>Reasoning</h2><span class="section-meta">${escapeHtml(supports+counters)} linked Evidence</span></div>
          ${reasoning ? `<div class="reasoning-stack">${reasoning}</div>` : '<p class="note strong">No Evidence is linked to this belief.</p>'}
          ${unresolved ? `<div class="reasoning-note"><strong>Unresolved references:</strong> ${escapeHtml(unresolved)} Evidence id(s) recorded on the Claim could not be resolved in the current Research Memory.</div>` : ''}
          <p class="note">The Workbench does not upgrade an Evidence link into a RelationReceipt. Pairwise Relation remains a separate runtime result and must preserve its own provenance, as-of and reproducibility.</p>
        </section>

        <section class="section">
          <div class="section-head"><h2>Belief history</h2><span class="section-meta">${escapeHtml(belief.revisions.length)} revision record${belief.revisions.length===1?'':'s'}</span></div>
          <div class="revision-timeline">${revisionRail}</div>
          <p class="note">Effective time and recorded time remain distinct. This surface shows persisted history only and never rewrites an earlier revision.</p>
        </section>

        <details class="technical">
          <summary>Technical record</summary>
          <ul class="record-list meta-grid">
            <li class="record"><span>Claim id</span><code>${escapeHtml(belief.identity.id)}</code></li>
            <li class="record"><span>Current revision</span><code>${escapeHtml(belief.current?.id ?? 'not recorded')}</code></li>
            <li class="record"><span>Revision reason</span><span>${escapeHtml(belief.current?.revisionReason ?? 'not recorded')}</span></li>
            <li class="record"><span>Recorded method</span><span>${escapeHtml(currentClaim.method ?? 'not recorded')}</span></li>
            <li class="record"><span>Supporting Evidence ids</span><code class="wrap">${escapeHtml((currentClaim.supportingEvidenceIds ?? []).join(', ') || 'none recorded')}</code></li>
            <li class="record"><span>Counter Evidence ids</span><code class="wrap">${escapeHtml((currentClaim.counterEvidenceIds ?? []).join(', ') || 'none recorded')}</code></li>
          </ul>
        </details>
        ${checkpoint('Can you explain what this belief is based on, what counters it, and what remains unproven?')}
      </div>

      <aside class="ws-context" aria-label="Belief inspector">
        <section class="panel">
          ${panelTitle('Belief state','belief')}
          <ul class="state-list">
            ${stateItem('Status',badge(statusLabel(currentClaim.status),statusTone(currentClaim.status)))}
            ${stateItem('Category',escapeHtml(currentClaim.category ?? 'not recorded'))}
            ${stateItem('Revision',`v${escapeHtml(currentVersion ?? '?')}`)}
            ${stateItem('Supporting',escapeHtml(supports))}
            ${stateItem('Counter',escapeHtml(counters))}
            ${stateItem('Last updated',timeInstant(currentClaim.updatedAt ?? belief.current?.createdAt))}
          </ul>
        </section>

        <section class="panel receipt">
          ${panelTitle('Reasoning integrity','trace')}
          <div class="receipt-warning">No persisted real RelationReceipt exists for this belief yet. Recorded Evidence roles are shown honestly without manufacturing a runtime decision.</div>
          <ul class="state-list">
            ${stateItem('Claim revision',escapeHtml(belief.current?.id ?? 'not recorded'))}
            ${stateItem('Relation runtime','available offline')}
            ${stateItem('Persisted receipt','no')}
            ${stateItem('Human authority','required')}
          </ul>
        </section>

        <section class="panel">
          ${panelTitle('Trace','trace')}
          ${railViz(provenanceSteps)}
        </section>
      </aside>
    </div>
  </div>`;

  return {status:200,title:'Belief Workbench',body,context:belief.subjectName};
}
