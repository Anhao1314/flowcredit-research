// Research Timeline (UI-2.0). Real mode renders persisted Research Memory
// events only. Demo mode renders isolated synthetic proposal chronology.
import { buildChanges } from '../projection.js';
import {
  badge, checkpoint, escapeHtml, icon, impactTone, panelTitle,
  relationTone, statusLabel, statusTone, timeInstant, truncate, withDemo
} from './layout.js';

function eventTime(value) {
  if (!value) return { sort:'', day:'—', time:'—' };
  const parsed=new Date(value);
  if(Number.isNaN(parsed.getTime())) return {sort:String(value),day:String(value),time:''};
  const iso=parsed.toISOString();
  return {sort:iso,day:iso.slice(5,10),time:`${iso.slice(11,16)} UTC`};
}

function timelineEvent({kind,title,statement,meta,href,at,demo}) {
  const time=eventTime(at);
  return {sort:time.sort,html:`<article class="timeline-event is-${escapeHtml(kind)}">
    <div class="timeline-time"><strong>${escapeHtml(time.day)}</strong><br>${escapeHtml(time.time)}</div>
    <span class="timeline-dot" aria-hidden="true"></span>
    <div class="timeline-card">
      <h3>${escapeHtml(title)}</h3>
      ${statement?`<p>${href?`<a href="${escapeHtml(withDemo(href,demo))}">${escapeHtml(truncate(statement,190))}</a>`:escapeHtml(truncate(statement,190))}</p>`:''}
      ${meta?`<p class="meta">${meta}</p>`:''}
    </div>
  </article>`};
}

function realTimeline({source,demo}) {
  const events=[];
  for(const revision of source.revisions()){
    const claim=revision.claim ?? {};
    events.push(timelineEvent({
      kind:'belief',
      title:revision.version>1?'Belief revision recorded':'Belief entered Research Memory',
      statement:claim.statement ?? revision.claimId,
      href:`/claim/${encodeURIComponent(revision.claimId)}`,
      at:revision.createdAt ?? revision.effectiveAt,
      meta:`revision v${escapeHtml(revision.version)} · ${escapeHtml(statusLabel(claim.status))} · effective ${timeInstant(revision.effectiveAt)}`,
      demo
    }));
  }
  for(const evidence of source.evidenceList()){
    events.push(timelineEvent({
      kind:'evidence',
      title:'Evidence recorded',
      statement:evidence.statement ?? evidence.id,
      href:`/evidence/${encodeURIComponent(evidence.id)}`,
      at:evidence.createdAt,
      meta:`${escapeHtml(evidence.category ?? 'category not recorded')} · observed ${escapeHtml(evidence.observedAt ?? 'not recorded')}`,
      demo
    }));
  }
  for(const review of source.reviews()){
    events.push(timelineEvent({
      kind:'review',
      title:'Evidence admission review recorded',
      statement:review.snapshot?.candidate?.quotedText ?? review.candidateId ?? review.id,
      href:review.evidenceId?`/evidence/${encodeURIComponent(review.evidenceId)}`:null,
      at:review.recordedAt ?? review.createdAt,
      meta:`${escapeHtml(review.decision ?? 'decision not recorded')} · ${escapeHtml(review.reviewerType ?? 'reviewer not recorded')} · ${escapeHtml(review.reasonCode ?? 'reason not recorded')}`,
      demo
    }));
  }
  for(const correction of source.corrections()){
    events.push(timelineEvent({
      kind:'review',title:'Evidence correction recorded',
      statement:correction.reason ?? correction.id,
      href:correction.replacementEvidenceId?`/evidence/${encodeURIComponent(correction.replacementEvidenceId)}`:null,
      at:correction.createdAt ?? correction.recordedAt,
      meta:`supersedes ${escapeHtml(correction.supersedesEvidenceId ?? 'not recorded')}`,
      demo
    }));
  }
  events.sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));
  const changes=buildChanges(source);
  const body=`
  <div class="view">
    <div class="workspace">
      <header class="ws-head view-head">
        <p class="eyebrow">${icon('timeline')}Research history</p>
        <h1>Timeline</h1>
        <p class="lead">What Research Memory actually recorded, in time order. Evidence arrival, admission reviews and Belief revisions remain separate events.</p>
      </header>
      <div class="ws-main">
        <div class="timeline">${events.map((event)=>event.html).join('') || '<p class="note strong">No recorded research events.</p>'}</div>
        ${checkpoint('Can you distinguish when a fact arrived from when a belief changed?')}
      </div>
      <aside class="ws-context" aria-label="Timeline state">
        <section class="panel">${panelTitle('Recorded state','timeline')}<ul class="state-list">
          <li class="state-item"><span class="state-key">Beliefs</span><span class="state-value">${escapeHtml(changes.claimCount)}</span></li>
          <li class="state-item"><span class="state-key">Revision records</span><span class="state-value">${escapeHtml(changes.revisionCount)}</span></li>
          <li class="state-item"><span class="state-key">Evidence</span><span class="state-value">${escapeHtml(changes.evidenceCount)}</span></li>
          <li class="state-item"><span class="state-key">Real proposals</span><span class="state-value">${escapeHtml(changes.proposals)}</span></li>
        </ul></section>
        <section class="panel receipt">${panelTitle('As-of integrity','trace')}<div class="receipt-warning">This timeline does not reconstruct a historical snapshot yet. It shows recorded event time honestly and does not imply that later Evidence was known earlier.</div></section>
      </aside>
    </div>
  </div>`;
  return {status:200,title:'Research Timeline',body};
}

function demoTimeline({demoData}) {
  const cases=demoData?.cases ?? [];
  const events=cases.map((item)=>{
    const at=item.proposalCreatedAt ?? item.asOf;
    return timelineEvent({
      kind:'review',
      title:'Synthetic proposal created',
      statement:item.claim?.statement ?? item.claimId ?? item.caseId,
      at,
      meta:`${badge(item.impact ?? 'impact not recorded',impactTone(item.impact))} ${badge('PENDING HUMAN REVIEW','caution')} · case ${escapeHtml(item.caseId ?? 'not recorded')}`,
      demo:true
    });
  }).sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));
  const receipts=demoData?.whatChanged?.receipts ?? [];
  const body=`
  <div class="view">
    <div class="view-head">
      <p class="eyebrow">${icon('timeline')}Synthetic timeline</p>
      <h1>Timeline preview</h1>
      <p class="lead">Isolated benchmark artifacts only. Nothing below is Research Memory and nothing can mutate an authoritative Claim.</p>
    </div>
    <div class="count-row">
      <span class="count-chip"><strong>${escapeHtml(cases.length)}</strong><span>proposal examples</span></span>
      <span class="count-chip"><strong>${escapeHtml(receipts.length)}</strong><span>pairwise receipts</span></span>
    </div>
    <div class="timeline section">${events.map((event)=>event.html).join('') || '<p class="note">No synthetic timeline cases are available.</p>'}</div>
    <p class="button-row"><a class="button-link" href="/review?demo=1">Open Review preview</a><a class="button-link secondary" href="/timeline">Return to real Timeline</a></p>
  </div>`;
  return {status:200,title:'Timeline Preview',body};
}

export function timelineView(context){
  return context.demo ? demoTimeline(context) : realTimeline(context);
}

// Compatibility export for historical callers.
export const changesView=timelineView;
