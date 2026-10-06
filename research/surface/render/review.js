// Human Review Queue (UI-2.0).
// Real mode is honest: no persisted ClaimRevisionProposal write path exists yet.
// Demo mode shows isolated synthetic proposals and preview-only decisions.
import { buildChanges } from '../projection.js';
import {
  badge, checkpoint, escapeHtml, icon, impactTone, panelTitle,
  statusLabel, statusTone, timeInstant, truncate
} from './layout.js';

function stateItem(key,value){
  return `<li class="state-item"><span class="state-key">${escapeHtml(key)}</span><span class="state-value">${value}</span></li>`;
}

function realReview({source}){
  const changes=buildChanges(source);
  const body=`
  <div class="view">
    <div class="workspace">
      <header class="ws-head view-head">
        <p class="eyebrow">${icon('review')}Human authority</p>
        <h1>Review</h1>
        <p class="lead">Proposed belief changes belong here before they can become authoritative Research Memory.</p>
      </header>
      <div class="ws-main">
        <section class="panel quiet">
          <p class="eyebrow">Queue state</p>
          <h2>No persisted review candidates yet.</h2>
          <p class="note">The pairwise Relation runtime can produce human-review candidates offline, but real ClaimRevisionProposal persistence and review mutation are not implemented. This Workbench will not invent a queue to make the product look further along.</p>
        </section>
        <section class="section">
          <div class="section-head"><h2>Authority contract</h2><span class="section-meta">current product boundary</span></div>
          <div class="reasoning-stack">
            <article class="reasoning-item"><div class="reasoning-role">${badge('1','neutral')}</div><div class="reasoning-body"><p class="reasoning-statement">AI or deterministic rules may propose analysis.</p><p class="reasoning-meta">Proposal ≠ truth.</p></div></article>
            <article class="reasoning-item"><div class="reasoning-role">${badge('2','neutral')}</div><div class="reasoning-body"><p class="reasoning-statement">A proposed impact must remain separate from the Claim.</p><p class="reasoning-meta">Relation ≠ Impact.</p></div></article>
            <article class="reasoning-item"><div class="reasoning-role">${badge('3','positive')}</div><div class="reasoning-body"><p class="reasoning-statement">Only explicit human review may authorize a future authoritative revision.</p><p class="reasoning-meta">Human authority above all.</p></div></article>
          </div>
        </section>
        <p class="button-row"><a class="button-link" href="/review?demo=1">Open synthetic review preview</a></p>
        ${checkpoint('Is it obvious that the system cannot silently rewrite a belief?')}
      </div>
      <aside class="ws-context" aria-label="Review capability">
        <section class="panel">${panelTitle('Review state','review')}<ul class="state-list">
          ${stateItem('Real proposals',escapeHtml(changes.proposals))}
          ${stateItem('Review mutation','disabled')}
          ${stateItem('Claim mutation','disabled')}
          ${stateItem('AI authority','none')}
          ${stateItem('Human authority','required')}
        </ul></section>
        <section class="panel receipt">${panelTitle('Next capability','trace')}<div class="receipt-warning">The next product step is not a prettier button. It is a frozen ClaimRevisionProposal + Human Review Receipt contract with provenance and reproducibility.</div></section>
      </aside>
    </div>
  </div>`;
  return {status:200,title:'Human Review',body};
}

function reviewCard(item){
  const claim=item.claim ?? null;
  const proposedStatus=item.suggestedStatus ? statusLabel(item.suggestedStatus) : 'not recorded';
  const evidence=(item.evidence ?? []).map((record)=>`<li class="record"><span>${escapeHtml(truncate(record.statement ?? record.id,180))}</span><span class="meta">${escapeHtml(record.id ?? 'evidence id not recorded')}</span></li>`).join('');
  return `
  <article class="review-card">
    <div class="review-card-head">
      <div>
        <p class="eyebrow">Synthetic proposal · ${escapeHtml(item.caseId ?? 'case id not recorded')}</p>
        <h2>${escapeHtml(truncate(claim?.statement ?? item.claimId ?? 'Claim not available',180))}</h2>
      </div>
      <div class="badge-row">${badge(item.impact ?? 'impact not recorded',impactTone(item.impact))}${badge('PENDING HUMAN REVIEW','caution')}</div>
    </div>
    <p class="note">${escapeHtml(item.reasonSummary ?? 'No proposal rationale recorded.')}</p>
    <div class="review-comparison">
      <div class="review-pane"><span>Current belief</span><strong>${escapeHtml(statusLabel(claim?.status))}</strong><p class="note">revision ${escapeHtml(item.baseRevisionId ?? 'not recorded')}</p></div>
      <div class="review-pane"><span>Proposed state</span><strong>${escapeHtml(proposedStatus)}</strong><p class="note">impact ${escapeHtml(item.impact ?? 'not recorded')} · confidence ${escapeHtml(item.suggestedConfidenceDirection ?? 'not recorded')}</p></div>
    </div>
    ${evidence?`<div class="section"><div class="section-head"><h2>New Evidence</h2><span class="section-meta">${escapeHtml(item.evidence.length)} record${item.evidence.length===1?'':'s'}</span></div><ul class="record-list">${evidence}</ul></div>`:''}
    <div class="review-actions" role="group" aria-label="Review preview only" data-preview-note="Preview only — no proposal or Research Memory record was changed.">
      <button type="button" class="btn" data-preview-button aria-pressed="false">Reject</button>
      <button type="button" class="btn" data-preview-button aria-pressed="false">Needs Evidence</button>
      <button type="button" class="btn btn-primary" data-preview-button aria-pressed="false">Accept</button>
    </div>
    <p class="note preview-note" hidden></p>
    <p class="meta">proposal ${escapeHtml(item.proposalId ?? 'not recorded')} · created ${timeInstant(item.proposalCreatedAt)} · authoritative revision written: no</p>
  </article>`;
}

function demoReview({demoData}){
  const cases=demoData?.cases ?? [];
  const candidates=demoData?.whatChanged?.candidates ?? [];
  const investigations=demoData?.whatChanged?.investigations ?? [];
  const body=`
  <div class="view">
    <div class="view-head">
      <p class="eyebrow">${icon('review')}Synthetic authority preview</p>
      <h1>Review Queue</h1>
      <p class="lead">Locked synthetic proposal examples only. Buttons preview the human-authority UX and never write a review, proposal or Claim revision.</p>
    </div>
    <div class="count-row">
      <span class="count-chip"><strong>${escapeHtml(cases.length)}</strong><span>proposal examples</span></span>
      <span class="count-chip"><strong>${escapeHtml(candidates.length)}</strong><span>pairwise candidates</span></span>
      <span class="count-chip"><strong>${escapeHtml(investigations.length)}</strong><span>investigations</span></span>
    </div>
    <div class="review-list section">${cases.map(reviewCard).join('') || '<p class="note strong">No synthetic proposal cases are available.</p>'}</div>
    <p class="button-row"><a class="button-link secondary" href="/review">Return to real Review</a><a class="button-link secondary" href="/timeline?demo=1">Open synthetic Timeline</a></p>
    ${checkpoint('Can a reviewer see the current belief, proposed change, evidence and authority boundary before choosing?')}
  </div>`;
  return {status:200,title:'Review Queue Preview',body};
}

export function reviewView(context){
  return context.demo ? demoReview(context) : realReview(context);
}
