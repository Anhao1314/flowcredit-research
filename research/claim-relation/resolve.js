// RelationInput resolver: construct or refuse one frozen RelationInput v1 against
// read-only Research Memory. References: docs/contracts/relation-input-v1.md (RI-*).
//
// Construction eligibility is E1-E5 (RI section 11) and nothing else:
//   E1 accepted Evidence with a still-valid admission binding
//   E2 every availability timestamp <= asOf
//   E3 the requested Claim Revision exists and is visible at asOf
//   E4 a materialized projection that is INVALID refuses the pair
//   E5 exactly one Evidence and one Claim Revision (RI-18.1)
// Refusal is NOT_EVALUATED with relation = null outside the input (RI-11.1): no
// input exists for a refused pair and no Relation label may be produced.
//
// The resolver never repairs, never promotes legacy fields into semantics (RI-9.2,
// RI-25.3) and never resolves a different revision than the one requested.

import {instant} from '../memory/time.js';
import {assertSchema} from '../src/schema.js';
import {assertRelationInput,deepFreeze,fail} from './contract.js';

const max=(...times)=>times.filter(Boolean).map(time=>instant(time)).sort().at(-1);
const sameDay=value=>String(value??'').slice(0,10);

// E4: a projection is only ever the caller's authoritative binding (RI-9.1). The
// resolver binds it and checks legality; it never derives or repairs one.
function projectionState(binding,asOf,side){
 if(binding===null||binding===undefined)return {semantics:{state:'NOT_MATERIALIZED'}};
 if(typeof binding!=='object'||typeof binding.frameRef!=='string'||!binding.frameRef.trim())fail('SEMANTICS_INVALID');
 if(binding.legality==='INVALID')fail('SEMANTICS_INVALID');
 if(binding.legality!=='VALID')fail('SEMANTICS_INVALID');
 if(binding.materializedAt!==undefined&&instant(binding.materializedAt,{query:true})>asOf)fail('FUTURE_PROJECTION');
 return {semantics:{state:'PRESENT',frameRef:binding.frameRef}};
}

export function resolveRelationInput(reader,{evidenceId,claimId,claimRevisionId,asOf,timeMode='audit',createdAt,projections=null}={}){
 if(timeMode!=='audit')fail('TIME_MODE_UNSUPPORTED');
 if(typeof asOf!=='string')fail('FUTURE_ASOF');
 const at=instant(asOf,{query:true});
 const now=instant(createdAt??asOf);
 if(at>now)fail('FUTURE_ASOF');
 // E5 / RI-18.1: an Evidence array is a bundle shape, never a pair input.
 if(Array.isArray(evidenceId)||!evidenceId)fail('EVIDENCE_BOUND');
 if(Array.isArray(claimId)||!claimId||Array.isArray(claimRevisionId)||!claimRevisionId)fail('PAIR_SHAPE_INVALID');
 return reader.transaction(()=>{
  // E1: Accepted Evidence with a valid admission binding.
  const node=reader.getEvidence(evidenceId,{asOf:at});
  if(!node)fail('EVIDENCE_UNAVAILABLE');
  assertSchema('evidence',node.evidence);
  const reviews=reader.reviews().filter(review=>instant(review.recordedAt)<=at&&review.decision==='accepted');
  const review=reviews.filter(item=>item.resultingEvidenceId===evidenceId).at(-1);
  if(!review)fail('EVIDENCE_NOT_ACCEPTED');
  if(review.subjectId!==node.evidence.subjectId||review.snapshot.source?.id!==node.evidence.sourceId||review.snapshot.source?.contentHash!==node.source.source.contentHash||review.validationSnapshot.validationStatus!=='valid')fail('ADMISSION_INVALID');
  // E2: availability and knowledge timestamps resolve at asOf; nothing later.
  const knowledgeAt=max(node.createdAt,node.source.createdAt,review.recordedAt,review.acceptedAt);
  const availableAt=review.availableAt===null||review.availableAt===undefined?null:instant(review.availableAt);
  if(knowledgeAt>at||(availableAt&&availableAt>at)||instant(node.evidence.createdAt)>at||instant(node.source.source.retrievedAt)>at||sameDay(node.source.source.documentDate)>sameDay(at)||String(node.evidence.observedAt)>sameDay(at))fail('FUTURE_EVIDENCE');
  // RI/ADR: evidence replaced by a recorded correction is not an evaluable pair side.
  if(node.corrections.some(correction=>correction.supersedesEvidenceId===evidenceId))fail('SUPERSEDED_EVIDENCE');
  // E3: the requested revision, never a silently resolved latest revision.
  const base=reader.getClaim(claimId,{asOf:at});
  if(!base)fail('CLAIM_MISSING');
  if(base.id!==claimRevisionId)fail('BASE_REVISION_STALE');
  assertSchema('claim',base.claim);
  // E4: projection legality per side; NOT_MATERIALIZED stays legal (RI-10.x).
  const evidenceSide=projectionState(projections?.evidence,at,'evidence');
  const claimSide=projectionState(projections?.claim,at,'claim');
  const relationInput=deepFreeze({evidence:{evidenceId},claim:{claimId,revisionId:claimRevisionId},asOf:at,evidenceSide,claimSide});
  assertRelationInput(relationInput);
  // RI-13.5: material for a consumer of the legacy path is a transport artifact,
  // not pair semantics, and carries no authority flags into the pair (RI-11.2).
  const material=deepFreeze({
   evidenceId,claimId,revisionId:claimRevisionId,asOf:at,
   claim:{statement:base.claim.statement,category:base.claim.category,status:base.claim.status,confidence:base.claim.confidence,method:base.claim.method,version:base.version,effectiveAt:base.effectiveAt,recordedAt:base.createdAt},
   evidence:{statement:node.evidence.statement,category:node.evidence.category,metric:node.evidence.metric,normalizedValue:node.evidence.normalizedValue,unit:node.evidence.unit,periodStart:node.evidence.periodStart,periodEnd:node.evidence.periodEnd,observedAt:node.evidence.observedAt,knowledgeAt,availableAt}
  });
  return Object.freeze({relationInput,material});
 });
}
