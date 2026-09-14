// What Changed (UI-1.5): a capability board in real mode, a change-flow
// workspace in demo mode. Real mode stays honest about what is not built.
import { buildChanges } from '../projection.js';
import {
  badge, checkpoint, countChip, escapeHtml, icon, impactTone, panelTitle,
  relationTone, sectionHead, statusLabel, statusTone, termHelp, timeInstant,
  truncate, withDemo
} from './layout.js';

function lane({ name, state, note, ready = false }) {
  return `<div class="lane${ready ? ' is-on' : ''}">
    <span class="lane-name">${escapeHtml(name)}</span>
    <span class="lane-state">${escapeHtml(state)}${note ? ` · ${escapeHtml(note)}` : ''}</span>
  </div>`;
}

function realChanges({ source, demo }) {
  const changes = buildChanges(source);
  const version = changes.revisionVersions[0] ?? 1;
  const body = `
  <div class="view">
    <div class="view-head">
      <h1>No real Claim changes yet.</h1>
      <p class="lead">FlowCredit has stored Claims and Evidence, but the Claim reasoning layer has not yet produced an authoritative real proposal.</p>
    </div>

    <section class="panel quiet">
      <div class="count-row">
        ${countChip(changes.claimCount, 'Claims')}
        ${countChip(changes.revisionCount, `revisions${changes.revisionVersions.length === 1 ? ` (all v${changes.revisionVersions[0]})` : ''}`)}
        ${countChip(changes.proposals, 'real Claim revision proposals')}
      </div>
      <p class="note">When Claim reasoning produces a reviewed proposal, this page will show: base revision → new evidence → relation → impact. That pipeline has not produced a real proposal for this data yet.</p>
    </section>

    <section>
      ${sectionHead('Change pipeline', 'recorded capability state')}
      <div class="lanes">
        ${lane({ name: 'New information', state: 'READY', note: `${changes.sourceCount} recorded sources`, ready: true })}
        ${lane({ name: 'Evidence', state: 'READY', note: `${changes.evidenceCount} Evidence records`, ready: true })}
        ${lane({ name: 'Claim relation', state: 'NOT PRODUCTIONIZED', note: 'no relation records for real Claims yet' })}
        ${lane({ name: 'Proposed impact', state: 'NOT READY', note: 'no impact records for real Claims yet' })}
        ${lane({ name: 'ClaimRevisionProposal', state: '0', note: '0 real proposals' })}
        ${lane({ name: 'Human review', state: 'NOT READY', note: 'no real reviews' })}
        ${lane({ name: 'Research Memory', state: 'UNCHANGED', note: `claims remain at revision v${version}` })}
      </div>
      <p class="note">This board reflects what the product can do today. Nothing here is a progress estimate; each state is derived from recorded records.</p>
    </section>

    <section>
      ${sectionHead('Synthetic preview')}
      <p class="note">The v0.12 locked benchmark produced synthetic proposal examples. They can be previewed with an explicit demo switch and are never shown as Research Memory.</p>
      <p class="button-row"><a class="button-link" href="${escapeHtml(withDemo('/changes?demo=1', demo))}">Open demo mode</a> <a class="button-link secondary" href="${escapeHtml(withDemo('/claims', demo))}">Browse Claims</a> <a class="button-link secondary" href="${escapeHtml(withDemo('/evidence', demo))}">Browse Evidence</a></p>
    </section>
    ${checkpoint('Can you understand what changed and why?')}
  </div>`;
  return { status: 200, title: 'What Changed', body };
}

function demoCaseCard(demoCase) {
  const evidenceItems = demoCase.evidence.map((evidence) => `
    <li class="record">
      <span>${escapeHtml(evidence.statement ?? 'Statement not available in this deployment')}</span>
      <span class="meta">${escapeHtml(evidence.id)}${evidence.availableAt ? ` · available ${timeInstant(evidence.availableAt)}` : ''}${evidence.page !== null && evidence.page !== undefined ? ` · page ${escapeHtml(evidence.page)}` : ''}</span>
    </li>`).join('');
  const attributionItems = demoCase.attributions.map((attribution) => `
    <li class="record attribution">
      ${badge(attribution.relation, relationTone(attribution.relation))}
      <blockquote>${escapeHtml(truncate(attribution.quote, 400))}</blockquote>
      ${attribution.evidenceId ? `<span class="meta">${escapeHtml(attribution.evidenceId)}</span>` : ''}
    </li>`).join('');
  const claim = demoCase.claim;
  return `
  <article class="panel demo-case">
    <header class="demo-case-header">
      <div>
        <h2>Synthetic proposal preview</h2>
        <p class="meta">case <code>${escapeHtml(demoCase.caseId)}</code> · ${escapeHtml(demoCase.origin)}</p>
      </div>
      <div class="badge-row">${badge('Demo', 'caution')}</div>
    </header>

    <ol class="flow">
      <li class="flow-step is-key">
        <span class="flow-track"><span class="flow-node">1</span></span>
        <div class="flow-body">
          <h3>Current Claim</h3>
          ${claim ? `<p class="statement">${escapeHtml(claim.statement ?? 'statement not recorded')}</p>
          <p class="badge-row">
            ${badge(statusLabel(claim.status), statusTone(claim.status))}
            ${claim.category ? badge(claim.category, 'neutral') : ''}
            ${claim.confidence !== null && claim.confidence !== undefined ? badge(`confidence ${claim.confidence}`, 'neutral') : ''}
          </p>` : '<p class="note">Synthetic claim record not available in this deployment (locked runtime artifacts not present). The proposal payload fields are shown below.</p>'}
        </div>
      </li>

      <li class="flow-step is-key">
        <span class="flow-track"><span class="flow-node">2</span></span>
        <div class="flow-body">
          <h3>New Evidence</h3>
          <ul class="record-list">${evidenceItems}</ul>
        </div>
      </li>

      <li class="flow-step is-key">
        <span class="flow-track"><span class="flow-node">3</span></span>
        <div class="flow-body">
          <h3>Proposed impact</h3>
          <p class="badge-row">
            ${badge(demoCase.impact ?? 'impact not recorded', impactTone(demoCase.impact))}
            ${demoCase.suggestedStatus ? badge(`suggested status: ${statusLabel(demoCase.suggestedStatus)}`, statusTone(demoCase.suggestedStatus)) : ''}
            ${demoCase.suggestedConfidenceDirection ? badge(`confidence: ${demoCase.suggestedConfidenceDirection}`, 'neutral') : ''}
            ${demoCase.reasonCode ? badge(demoCase.reasonCode, 'neutral') : ''}
          </p>
          ${demoCase.reasonSummary ? `<p class="note">${escapeHtml(demoCase.reasonSummary)}</p>` : ''}
          ${attributionItems ? `<ul class="record-list">${attributionItems}</ul>` : ''}
        </div>
      </li>

      <li class="flow-step">
        <span class="flow-track"><span class="flow-node">4</span></span>
        <div class="flow-body">
          <h3>Review <span class="meta">preview only</span></h3>
          <p class="note">Review state: <strong>pending</strong> (synthetic case). Accept, Reject and Needs Review are UX previews; review mutation is disabled in this surface and nothing is written anywhere.</p>
          <div class="review-actions" role="group" aria-label="Review preview (writes nothing)" data-preview-note="Preview only — review mutation is disabled in this surface. No proposal or research record was changed.">
            <button type="button" class="btn" data-preview-button aria-pressed="false">Accept</button>
            <button type="button" class="btn" data-preview-button aria-pressed="false">Reject</button>
            <button type="button" class="btn" data-preview-button aria-pressed="false">Needs Review</button>
          </div>
          <p class="note preview-note" hidden></p>
        </div>
      </li>
    </ol>

    <footer class="meta">
      proposal ${escapeHtml(demoCase.proposalId ?? 'not recorded')} · base revision ${escapeHtml(demoCase.baseRevisionId ?? 'not recorded')} · created ${timeInstant(demoCase.proposalCreatedAt)}${demoCase.model ? ` · model ${escapeHtml(demoCase.model)}` : ''} · authoritative revision written: no
    </footer>
  </article>`;
}

function demoChanges({ demoData }) {
  const cases = demoData?.cases ?? [];
  const body = `
  <div class="view">
    <div class="view-head">
      <h1>Synthetic Claim Proposal preview</h1>
      <p class="lead">Examples from the v0.12 locked benchmark. They illustrate the intended product shape and are not authoritative research records.</p>
      ${termHelp('ClaimRevisionProposal', 'A proposed change to a Claim, awaiting review. AI-suggested; not part of Research Memory until accepted.')}
    </div>
    ${cases.length ? cases.map(demoCaseCard).join('') : '<p class="note">No synthetic demo cases are available in this deployment.</p>'}
    <p class="note">Demo source: ${escapeHtml(demoData?.label ?? 'not available')}. <a href="/changes">Back to real mode</a></p>
    ${checkpoint('Can you understand what changed and why?')}
  </div>`;
  return { status: 200, title: 'What Changed (Demo)', body };
}

export function changesView(context) {
  return context.demo ? demoChanges(context) : realChanges(context);
}
