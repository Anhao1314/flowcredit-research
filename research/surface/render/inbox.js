// Research Inbox for FlowCredit Research Workbench UI-2.0.
// The inbox is action-first: what deserves attention now, not a database inventory.
import { buildChanges, buildInbox } from '../projection.js';
import {
  checkpoint, escapeHtml, icon, panelTitle, sentenceCase, tickStrip,
  timeInstant, truncate, withDemo
} from './layout.js';

const CATEGORY_ACRONYMS = new Set(['esg','rpo','kpi','cfo','ceo','ai']);
function categoryLabel(category) {
  return sentenceCase(category).split(/\s+/).map((word) => {
    const lower = word.toLowerCase();
    return CATEGORY_ACRONYMS.has(lower) ? lower.toUpperCase() : word;
  }).join(' ');
}

function evidenceMeta(row, { withTime = false } = {}) {
  const parts = [];
  if (row.sourceTitle) parts.push(escapeHtml(truncate(row.sourceTitle, 56)));
  if (row.category) parts.push(escapeHtml(categoryLabel(row.category)));
  if (row.page !== null && row.page !== undefined && row.page !== '') parts.push(`p.${escapeHtml(row.page)}`);
  if (withTime) parts.push(`recorded ${timeInstant(row.createdAt)}`);
  return parts.join('<span class="sep">·</span>');
}

function recordRow({ href, statement, meta, demo }) {
  return `<li class="record"><a href="${escapeHtml(withDemo(href, demo))}">${escapeHtml(statement)}</a>${meta ? `<span class="meta record-meta">${meta}</span>` : ''}</li>`;
}

function tile({ href, number, label, hint, tone = '', demo }) {
  return `<a class="attention-tile${tone ? ` ${tone}` : ''}" href="${escapeHtml(withDemo(href, demo))}">
    <span class="tile-num">${escapeHtml(number)}</span>
    <span class="tile-label">${escapeHtml(label)}</span>
    <span class="tile-hint">${escapeHtml(hint)}</span>
  </a>`;
}

function stateItem(key, value) {
  return `<li class="state-item"><span class="state-key">${escapeHtml(key)}</span><span class="state-value">${value}</span></li>`;
}

export function inboxView({ source, demo }) {
  const inbox = buildInbox(source);
  const attention = inbox.attention;
  const totals = inbox.totals;
  const linkedCount = Math.max(totals.evidence - attention.unlinked.count, 0);
  const changes = buildChanges(source);
  const tiles = [];
  const blocks = [];

  if (attention.unlinked.count) {
    tiles.push(tile({
      href:'/evidence?link=unlinked', number:attention.unlinked.count,
      label:'Evidence waiting for a belief',
      hint:'Recorded facts that no current belief references yet.',
      tone:'is-attention', demo
    }));
    const rows = attention.unlinked.examples.map((row) => recordRow({
      href:`/evidence/${encodeURIComponent(row.evidenceId)}`,
      statement:truncate(row.statement ?? row.evidenceId, 165),
      meta:evidenceMeta(row), demo
    })).join('');
    blocks.push(`<li class="attention-block">
      <div class="attention-head"><h3 class="attention-title">Unlinked Evidence</h3><span class="attention-count">${escapeHtml(attention.unlinked.count)}</span></div>
      <p class="note">These facts are admitted to Research Memory but are not used by any current belief.</p>
      <ul class="record-list">${rows}</ul>
      <p class="attention-cta"><a href="${escapeHtml(withDemo('/evidence?link=unlinked', demo))}">Inspect unlinked Evidence →</a></p>
    </li>`);
  }

  if (attention.thinSupport.count) {
    tiles.push(tile({
      href:'/beliefs', number:`${attention.thinSupport.count} / ${attention.thinSupport.total}`,
      label:'Beliefs with thin support',
      hint:'At most one linked supporting Evidence record.',
      tone:'is-counter', demo
    }));
    const rows = attention.thinSupport.claims.map((claim) => recordRow({
      href:`/claim/${encodeURIComponent(claim.claimId)}`,
      statement:truncate(claim.statement ?? claim.claimId, 165),
      meta:`${escapeHtml(claim.supportCount)} supporting Evidence`, demo
    })).join('');
    blocks.push(`<li class="attention-block">
      <div class="attention-head"><h3 class="attention-title">Beliefs with thin evidence coverage</h3><span class="attention-count">${escapeHtml(attention.thinSupport.count)}</span></div>
      <p class="note">Coverage is evidence volume, not truth or confidence. These beliefs deserve inspection because their recorded support is thin.</p>
      <ul class="record-list">${rows}</ul>
      <p class="attention-cta"><a href="${escapeHtml(withDemo('/beliefs', demo))}">Open Beliefs →</a></p>
    </li>`);
  }

  if (attention.recent.items.length) {
    const rows = attention.recent.items.map((row) => recordRow({
      href:`/evidence/${encodeURIComponent(row.evidenceId)}`,
      statement:truncate(row.statement ?? row.evidenceId, 165),
      meta:evidenceMeta(row,{withTime:true}), demo
    })).join('');
    blocks.push(`<li class="attention-block">
      <div class="attention-head"><h3 class="attention-title">Recently recorded Evidence</h3><span class="attention-count">${escapeHtml(attention.recent.items.length)} shown</span></div>
      <p class="note">Newest facts entering Research Memory. Review whether they should affect a belief.</p>
      <ul class="record-list">${rows}</ul>
      <p class="attention-cta"><a href="${escapeHtml(withDemo('/timeline', demo))}">Open Timeline →</a></p>
    </li>`);
  }

  if (!tiles.length) {
    tiles.push(tile({
      href:'/beliefs', number:'0', label:'Immediate attention items',
      hint:'No unlinked Evidence or thin-support signals are present in this projection.', demo
    }));
  }

  const subjectLinks = inbox.subjects.map((subject) => `<a href="${escapeHtml(withDemo(`/company/${encodeURIComponent(subject.subjectId)}`, demo))}">${escapeHtml(subject.displayName)}</a>`).join(', ');
  const revisionState = inbox.revisionsAllVersionOne ? 'All recorded beliefs remain at v1' : `${totals.revisions} revisions recorded`;
  const body = `
  <div class="view">
    <div class="workspace">
      <div class="ws-head view-head">
        <p class="eyebrow">${icon('inbox')}Attention workspace</p>
        <h1>Research Inbox</h1>
        <p class="lead">What deserves attention in what we currently believe. Start from unresolved evidence and thin beliefs, not from a table of objects.</p>
      </div>

      <div class="ws-main">
        <section aria-labelledby="needs-attention-title">
          <div class="section-head"><h2 id="needs-attention-title">Needs attention</h2><span class="section-meta">${escapeHtml(totals.evidence)} Evidence · ${escapeHtml(totals.claims)} Beliefs</span></div>
          <div class="attention-grid">${tiles.join('')}</div>
          <ul class="attention-list">${blocks.join('')}</ul>
        </section>
        ${checkpoint('Can you tell what to inspect next without first understanding the storage model?')}
      </div>

      <aside class="ws-context" aria-label="Research state">
        <section class="panel">
          ${panelTitle('Research state','trace')}
          <ul class="state-list">
            ${stateItem('Beliefs', escapeHtml(totals.claims))}
            ${stateItem('Evidence', escapeHtml(totals.evidence))}
            ${stateItem('Sources', escapeHtml(totals.sources))}
            ${stateItem('Admission reviews', escapeHtml(totals.reviews))}
            ${stateItem('Real proposals', escapeHtml(changes.proposals))}
            ${stateItem('Latest activity', timeInstant(attention.latestActivityAt))}
          </ul>
        </section>

        <section class="panel">
          ${panelTitle('Evidence linking','link')}
          ${tickStrip({on:linkedCount,total:totals.evidence})}
          <p class="strip-legend"><span>Linked ${escapeHtml(linkedCount)}</span><span>Unlinked ${escapeHtml(attention.unlinked.count)}</span></p>
          <p class="note">Whether an Evidence record is referenced by a current belief. This is not evidence quality.</p>
        </section>

        <section class="panel">
          ${panelTitle('Provenance depth','trace')}
          ${tickStrip({on:attention.reviewed.count,total:totals.evidence,onClass:'is-deep'})}
          <p class="strip-legend"><span>Deeper ${escapeHtml(attention.reviewed.count)}</span><span>Partial ${escapeHtml(attention.partialProvenance.count)}</span></p>
          <p class="note">Deeper trace means an admission review is recorded. SourceSpan-level joins are still unavailable.</p>
        </section>

        <section class="panel quiet">
          ${panelTitle('Scope','source')}
          <p class="meta inventory-line">${escapeHtml(totals.subjects)} subject${totals.subjects===1?'':'s'} under research: ${subjectLinks || 'none recorded'}.</p>
          <p class="note">${escapeHtml(revisionState)}. Human authority remains above every proposed change.</p>
        </section>
      </aside>
    </div>
  </div>`;
  return { status:200, title:'Research Inbox', body, context:inbox.subjects.length===1?inbox.subjects[0].displayName:'All subjects' };
}
