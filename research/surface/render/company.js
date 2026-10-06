// Subject context view for FlowCredit Research Workbench UI-2.0.
import { buildCompany } from '../projection.js';
import {
  badge, checkpoint, countChip, escapeHtml, icon, linkChip, panelTitle,
  provenanceChip, statusLabel, statusTone, timeDate, timeInstant,
  truncate, withDemo
} from './layout.js';

function stateItem(key,value){
  return `<li class="state-item"><span class="state-key">${escapeHtml(key)}</span><span class="state-value">${value}</span></li>`;
}

export function companyView({source,demo},subjectId){
  const company=buildCompany(source,subjectId);
  if(!company){
    return {status:404,title:'Subject not found',body:`<div class="view"><div class="view-head"><p class="eyebrow">Research scope</p><h1>Subject not found</h1><p class="lead">No Research Memory records exist for <code>${escapeHtml(subjectId)}</code>.</p></div><p><a class="button-link" href="${escapeHtml(withDemo('/',demo))}">Back to Inbox</a></p></div>`};
  }
  const {subject}=company;
  const beliefRows=company.claims.map((belief)=>`
    <li class="row">
      <span class="row-marker" aria-hidden="true">${icon('belief')}</span>
      <div class="row-body">
        <a class="row-title" href="${escapeHtml(withDemo(`/claim/${encodeURIComponent(belief.claimId)}`,demo))}">${escapeHtml(truncate(belief.statement ?? 'Belief statement not recorded',180))}</a>
        <p class="row-meta">${escapeHtml(belief.category ?? 'category not recorded')}<span class="sep">·</span>revision v${escapeHtml(belief.version ?? '?')}<span class="sep">·</span>updated ${timeInstant(belief.updatedAt)}</p>
        <p class="row-chips">${badge(statusLabel(belief.status),statusTone(belief.status))}</p>
      </div>
      <div class="row-side"><span class="meta">${escapeHtml(belief.supportCount)} supporting${belief.counterCount?` · ${escapeHtml(belief.counterCount)} counter`:''}${belief.missingReferences?` · ${escapeHtml(belief.missingReferences)} unresolved`:''}</span></div>
    </li>`).join('');

  const evidenceRows=company.recentEvidence.map((entry)=>`
    <li class="record">
      <a href="${escapeHtml(withDemo(`/evidence/${encodeURIComponent(entry.evidenceId)}`,demo))}">${escapeHtml(truncate(entry.statement ?? entry.evidenceId,190))}</a>
      <span class="meta">${escapeHtml(entry.metric ?? 'metric not recorded')} · page ${escapeHtml(entry.page ?? 'not recorded')} · recorded ${timeInstant(entry.createdAt)}</span>
      <span class="row-chips">${linkChip(entry.linkCount)} ${provenanceChip(entry.reviewed)}</span>
    </li>`).join('');

  const sourceRows=company.sources.map((record)=>`
    <li class="record"><span>${escapeHtml(record.title ?? record.id)}</span><span class="meta">${escapeHtml(record.publisher ?? 'publisher not recorded')} · ${escapeHtml(record.fiscalPeriod ?? 'period not recorded')} · ${timeDate(record.documentDate)} · ${record.isPrimarySource?'primary source':'secondary / unclassified'}</span></li>`).join('');

  const body=`
  <div class="view">
    <div class="workspace">
      <header class="ws-head view-head">
        <p class="back-link"><a href="${escapeHtml(withDemo('/',demo))}">← Back to Inbox</a></p>
        <p class="eyebrow">${icon('source')}Research scope</p>
        <h1>${escapeHtml(subject.displayName)}</h1>
        <p class="lead">The current belief state, recent Evidence and recorded Sources for this research subject.</p>
      </header>

      <div class="ws-main">
        <section class="panel quiet"><div class="count-row">
          ${countChip(subject.claims,'Beliefs')}
          ${countChip(subject.evidence,'Evidence')}
          ${countChip(subject.sources,'Sources')}
          ${countChip(subject.reviewedProvenance,'Deep provenance')}
        </div></section>

        <section class="section">
          <div class="section-head"><h2>Current beliefs</h2><span class="section-meta">${escapeHtml(subject.claims)} recorded</span></div>
          ${beliefRows?`<ul class="rows">${beliefRows}</ul>`:'<p class="note strong">No beliefs recorded.</p>'}
        </section>

        <section class="section">
          <div class="section-head"><h2>Recent Evidence</h2><span class="section-meta">${escapeHtml(company.recentEvidence.length)} shown</span></div>
          ${evidenceRows?`<ul class="record-list">${evidenceRows}</ul>`:'<p class="note strong">No Evidence recorded.</p>'}
        </section>

        <section class="section">
          <div class="section-head"><h2>Sources</h2><span class="section-meta">${escapeHtml(company.sources.length)} recorded</span></div>
          ${sourceRows?`<ul class="record-list">${sourceRows}</ul>`:'<p class="note strong">No Sources recorded.</p>'}
        </section>
        ${checkpoint('Can you understand the research state for this subject without opening raw storage objects?')}
      </div>

      <aside class="ws-context" aria-label="Subject context">
        <section class="panel">${panelTitle('Subject state','source')}<ul class="state-list">
          ${stateItem('Beliefs',escapeHtml(subject.claims))}
          ${stateItem('Evidence',escapeHtml(subject.evidence))}
          ${stateItem('Sources',escapeHtml(subject.sources))}
          ${stateItem('Deep provenance',escapeHtml(subject.reviewedProvenance))}
          ${stateItem('Latest activity',timeInstant(subject.latestEvidenceAt ?? subject.latestRevisionAt))}
        </ul></section>
        <section class="panel">${panelTitle('Open scope','link')}
          <p class="note"><a href="${escapeHtml(withDemo(`/beliefs?subject=${encodeURIComponent(subject.subjectId)}`,demo))}">Beliefs for this subject →</a></p>
          <p class="note"><a href="${escapeHtml(withDemo(`/evidence?subject=${encodeURIComponent(subject.subjectId)}`,demo))}">Evidence for this subject →</a></p>
          <p class="note"><a href="${escapeHtml(withDemo('/timeline',demo))}">Research Timeline →</a></p>
        </section>
      </aside>
    </div>
  </div>`;
  return {status:200,title:`${subject.displayName} · Research Scope`,body,context:subject.displayName};
}
