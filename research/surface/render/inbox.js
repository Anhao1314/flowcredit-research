// Research Inbox (UI-1.5): attention-first workspace. Primary zone answers
// "what deserves attention"; the context column reports real research state.
import { buildChanges, buildInbox } from '../projection.js';
import {
  checkpoint, escapeHtml, icon, panelTitle, tickStrip, timeInstant, truncate, withDemo
} from './layout.js';

function recordRow({ href, statement, meta, demo }) {
  return `<li class="record">
      <a href="${escapeHtml(withDemo(href, demo))}">${escapeHtml(statement)}</a>
      ${meta ? `<span class="meta">${meta}</span>` : ''}
    </li>`;
}

function attentionHead(title, count) {
  return `<div class="attention-head">
        <h3 class="attention-title">${escapeHtml(title)}</h3>
        <span class="attention-count">${escapeHtml(count)}</span>
      </div>`;
}

function attentionTile({ href, number, label, hint, tone, demo }) {
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

  const blocks = [];
  const tiles = [];

  if (attention.unlinked.count > 0) {
    const examples = attention.unlinked.examples.map((row) => recordRow({
      href: `/evidence/${encodeURIComponent(row.evidenceId)}`,
      statement: truncate(row.statement ?? row.evidenceId, 160),
      meta: `${escapeHtml(row.metric ?? 'metric not recorded')} · page ${escapeHtml(row.page ?? 'not recorded')}`,
      demo
    })).join('');
    tiles.push(attentionTile({
      href: '/evidence?link=unlinked',
      number: attention.unlinked.count,
      label: 'Evidence not linked to a Claim',
      hint: 'Admitted to Research Memory; no Claim uses them yet.',
      tone: 'is-attention',
      demo
    }));
    blocks.push(`<li class="attention-block">
      ${attentionHead('Evidence not yet linked to a Claim', attention.unlinked.count)}
      <p class="note">Admitted to Research Memory; no Claim uses them yet.</p>
      <ul class="record-list">${examples}</ul>
      <p class="attention-cta"><a href="${escapeHtml(withDemo('/evidence?link=unlinked', demo))}">Review Evidence</a></p>
    </li>`);
  }

  if (attention.thinSupport.count > 0) {
    const claims = attention.thinSupport.claims.map((claim) => recordRow({
      href: `/claim/${encodeURIComponent(claim.claimId)}`,
      statement: truncate(claim.statement ?? claim.claimId, 160),
      meta: `${escapeHtml(claim.supportCount)} supporting Evidence`,
      demo
    })).join('');
    tiles.push(attentionTile({
      href: '/claims',
      number: `${attention.thinSupport.count} of ${attention.thinSupport.total}`,
      label: 'Claims with thin evidence coverage',
      hint: 'Each listed Claim is supported by at most one linked Evidence record.',
      tone: 'is-counter',
      demo
    }));
    blocks.push(`<li class="attention-block">
      ${attentionHead('Claims with thin evidence coverage', `${attention.thinSupport.count} of ${attention.thinSupport.total}`)}
      <p class="note">Each listed Claim is supported by at most one linked Evidence record. Coverage describes linked evidence volume, not Claim truth or confidence.</p>
      <ul class="record-list">${claims}</ul>
      <p class="attention-cta"><a href="${escapeHtml(withDemo('/claims', demo))}">View all Claims</a></p>
    </li>`);
  }

  if (attention.zeroSupport.count > 0) {
    const claims = attention.zeroSupport.claims.map((claim) => recordRow({
      href: `/claim/${encodeURIComponent(claim.claimId)}`,
      statement: truncate(claim.statement ?? claim.claimId, 160),
      meta: 'No supporting Evidence linked',
      demo
    })).join('');
    blocks.push(`<li class="attention-block">
      ${attentionHead('Claims with no supporting Evidence', attention.zeroSupport.count)}
      <p class="note">These Claims are recorded beliefs without a linked supporting Evidence record yet.</p>
      <ul class="record-list">${claims}</ul>
      <p class="attention-cta"><a href="${escapeHtml(withDemo('/claims', demo))}">View all Claims</a></p>
    </li>`);
  }

  if (attention.recent.items.length > 0) {
    const recent = attention.recent.items.map((row) => recordRow({
      href: `/evidence/${encodeURIComponent(row.evidenceId)}`,
      statement: truncate(row.statement ?? row.evidenceId, 160),
      meta: `recorded ${timeInstant(row.createdAt)}`,
      demo
    })).join('');
    blocks.push(`<li class="attention-block">
      ${attentionHead('Recently recorded Evidence', `${attention.recent.items.length} shown`)}
      <p class="note">The most recently recorded Evidence records in Research Memory.</p>
      <ul class="record-list">${recent}</ul>
      <p class="attention-cta"><a href="${escapeHtml(withDemo('/evidence', demo))}">View recent Evidence</a></p>
    </li>`);
  }

  const subjectLinks = inbox.subjects.map((subject) => `<a href="${escapeHtml(withDemo(`/company/${encodeURIComponent(subject.subjectId)}`, demo))}">${escapeHtml(subject.displayName)}</a>`).join(', ');
  const inventory = `Research Memory: ${escapeHtml(totals.subjects)} ${totals.subjects === 1 ? 'company' : 'companies'} under research — ${subjectLinks || 'none recorded'} · ${escapeHtml(totals.claims)} Claims · ${escapeHtml(totals.evidence)} Evidence · ${escapeHtml(totals.sources)} Sources · ${escapeHtml(totals.reviews)} admission review records`;

  const completeness = `<a href="${escapeHtml(withDemo('/evidence?review=reviewed', demo))}">${escapeHtml(attention.reviewed.count)} Evidence with deeper admission provenance</a> · ${escapeHtml(attention.partialProvenance.count)} with partial provenance.`;

  const revisionNote = inbox.revisionsAllVersionOne
    ? `${escapeHtml(totals.revisions)} revision records, all at v1`
    : `${escapeHtml(totals.revisions)} revision records`;

  const body = `
  <div class="view">
    <div class="workspace">
      <div class="ws-head view-head">
        <h1>Research Inbox</h1>
        <p class="lead">What deserves attention in what we currently believe.</p>
      </div>

      <div class="ws-main">
        <section aria-label="Needs attention">
          <div class="section-head"><h2>Needs attention</h2><span class="section-meta">${escapeHtml(totals.evidence)} Evidence · ${escapeHtml(totals.claims)} Claims</span></div>
          ${tiles.length ? `<div class="attention-grid">${tiles.join('')}</div>` : ''}
          <ul class="attention-list">${blocks.join('')}</ul>
        </section>
        ${checkpoint('Can you understand what deserves attention?')}
      </div>

      <aside class="ws-context" aria-label="Research state">
        <section class="panel">
          ${panelTitle('Research state', 'trace')}
          <ul class="state-list">
            ${stateItem('Claims', escapeHtml(totals.claims))}
            ${stateItem('Evidence', escapeHtml(totals.evidence))}
            ${stateItem('Sources', escapeHtml(totals.sources))}
            ${stateItem('Admission reviews', escapeHtml(totals.reviews))}
            ${stateItem('Claims at revision v1', inbox.revisionsAllVersionOne ? 'All' : escapeHtml(totals.revisions))}
          </ul>
        </section>

        <section class="panel">
          ${panelTitle('Evidence linking', 'link')}
          ${tickStrip({ on: linkedCount, total: totals.evidence })}
          <p class="strip-legend">
            <span><a href="${escapeHtml(withDemo('/evidence?link=linked', demo))}">Linked ${escapeHtml(linkedCount)}</a></span>
            <span><a href="${escapeHtml(withDemo('/evidence?link=unlinked', demo))}">Not yet linked ${escapeHtml(attention.unlinked.count)}</a></span>
          </p>
          <p class="note">How many recorded Evidence records are referenced by a current Claim.</p>
        </section>

        <section class="panel">
          ${panelTitle('Research completeness', 'trace')}
          ${tickStrip({ on: attention.reviewed.count, total: totals.evidence, onClass: 'is-deep' })}
          <p class="strip-legend"><span>Deeper trace ${escapeHtml(attention.reviewed.count)}</span><span>Partial ${escapeHtml(attention.partialProvenance.count)}</span></p>
          <p class="note">${completeness}</p>
          <p class="note">Latest Research Memory activity: ${timeInstant(attention.latestActivityAt)}.</p>
        </section>

        <section class="panel">
          ${panelTitle('Belief changes', 'change')}
          <p class="note">No belief changes recorded yet. ${revisionNote}, and ${escapeHtml(buildChanges(source).proposals)} reviewed Claim proposals. <a href="${escapeHtml(withDemo('/changes', demo))}">What Changed</a> explains when this activates.</p>
        </section>

        <section class="panel quiet">
          ${panelTitle('Inventory', 'source')}
          <p class="meta inventory-line">${inventory}</p>
        </section>
      </aside>
    </div>
  </div>`;
  return { status: 200, title: 'Research Inbox', body, context: inbox.subjects.length === 1 ? inbox.subjects[0].displayName : 'All subjects' };
}
