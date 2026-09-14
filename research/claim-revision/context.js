import {instant} from '../memory/time.js';
import {digest} from '../src/identity.js';
import {assertSchema} from '../src/schema.js';
const fail=code=>{throw Error(code);};
const max=(...times)=>times.filter(Boolean).map(t=>instant(t)).sort().at(-1);
export function prepareContext(reader,{claimId,baseRevisionId,newEvidenceIds,asOf,timeMode='audit',createdAt}){
 if(timeMode!=='audit')fail('TIME_MODE_UNSUPPORTED');
 const at=instant(asOf,{query:true}),now=instant(createdAt);
 if(at>now)fail('FUTURE_ASOF');
 if(!Array.isArray(newEvidenceIds)||newEvidenceIds.length<1||newEvidenceIds.length>4||new Set(newEvidenceIds).size!==newEvidenceIds.length)fail('EVIDENCE_BOUND');
 return reader.transaction(()=>{
  const base=reader.getClaim(claimId,{asOf:at});if(!base)fail('CLAIM_MISSING');
  if(base.id!==baseRevisionId)fail('BASE_REVISION_STALE');assertSchema('claim',base.claim);
  const history=reader.getRecentHistory(claimId,{asOf:at,limit:3});
  const allReviews=reader.reviews().filter(r=>instant(r.recordedAt)<=at&&r.decision==='accepted');
  function node(id,isNew){
   const n=reader.getEvidence(id,{asOf:at});if(!n)fail('EVIDENCE_UNAVAILABLE');assertSchema('evidence',n.evidence);
   if(n.evidence.subjectId!==base.subjectId)fail('WRONG_SUBJECT');
   const review=allReviews.filter(r=>r.resultingEvidenceId===id).at(-1);if(!review)fail('EVIDENCE_NOT_ACCEPTED');
   if(review.subjectId!==base.subjectId||review.snapshot.source?.id!==n.evidence.sourceId||review.snapshot.source?.contentHash!==n.source.source.contentHash||review.validationSnapshot.validationStatus!=='valid')fail('ADMISSION_INVALID');
   const knowledgeAt=max(n.createdAt,n.source.createdAt,review.recordedAt,review.acceptedAt),availableAt=review.availableAt===null?null:instant(review.availableAt);
   if(knowledgeAt>at||availableAt&&availableAt>at||instant(n.evidence.createdAt)>at||instant(n.source.source.retrievedAt)>at||n.source.source.documentDate>at.slice(0,10)||n.evidence.observedAt>at.slice(0,10))fail('FUTURE_EVIDENCE');
   const contextOnly=n.corrections.some(c=>c.supersedesEvidenceId===id);
   if(isNew&&contextOnly)fail('SUPERSEDED_EVIDENCE');
   if(isNew&&n.evidence.category!==base.claim.category)fail('CATEGORY_MISMATCH');
   return {id,node:n,review,knowledgeAt,availableAt,contextOnly,isNew};
  }
  const selected=newEvidenceIds.map(id=>node(id,true));
  const old=[...base.claim.supportingEvidenceIds.slice(0,2),...base.claim.counterEvidenceIds.slice(0,2)];
  for(const id of old)if(!selected.some(n=>n.id===id)){const accepted=allReviews.some(r=>r.resultingEvidenceId===id);if(accepted)selected.push(node(id,false));}
  if(selected.length>8)fail('EVIDENCE_BOUND');
  const handleMap={claim:{C1:claimId},revision:{R1:baseRevisionId},evidence:Object.fromEntries(selected.map((n,i)=>['E'+(i+1),n.id]))};
  const evidence=selected.map((n,i)=>({handle:'E'+(i+1),isNew:n.isNew,contextOnly:n.contextOnly,statement:n.node.evidence.statement,category:n.node.evidence.category,metric:n.node.evidence.metric,normalizedValue:n.node.evidence.normalizedValue,unit:n.node.evidence.unit,periodStart:n.node.evidence.periodStart,periodEnd:n.node.evidence.periodEnd,observedAt:n.node.evidence.observedAt,knowledgeAt:n.knowledgeAt,availableAt:n.availableAt,verificationLevel:n.node.evidence.verificationLevel,correction:n.contextOnly?'Replaced by a recorded correction; historical context only':n.node.corrections.some(c=>c.replacementEvidenceId===n.id)?'Replacement for previously recorded evidence':null}));
  const data={timeMode,asOf:at,claim:{handle:'C1',statement:base.claim.statement,category:base.claim.category,status:base.claim.status,confidence:base.claim.confidence,method:base.claim.method,baseRevisionHandle:'R1',effectiveAt:base.effectiveAt,recordedAt:base.createdAt},history:history.map(r=>({version:r.version,status:r.claim.status,confidence:r.claim.confidence,effectiveAt:r.effectiveAt,reason:r.revisionReason})),evidence};
  // Never send canonical IDs/provenance to a provider, including IDs embedded in data strings.
  const forbidden=[claimId,baseRevisionId,...selected.map(n=>n.id),...selected.map(n=>n.node.evidence.sourceId)];
  const encoded=JSON.stringify(data);if(forbidden.some(id=>id&&encoded.includes(id)))fail('CANONICAL_ID_IN_TEXT');
  const snapshot={base,history,selected,handleMap,data};return {asOf:at,createdAt:now,newEvidenceIds:[...newEvidenceIds],base,selected,handleMap,data,snapshot,snapshotHash:digest(snapshot)};
 });
}
export function currentBase(reader,claimId,at){return reader.getClaim(claimId,{asOf:instant(at,{query:true})});}
