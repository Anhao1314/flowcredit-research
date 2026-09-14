import {assertContract,promptHash,promptVersion} from './contract.js';
import {digest,stableId} from '../src/identity.js';
import {instant} from '../memory/time.js';
export const forbiddenInvestment=/\b(?:buy|sell|hold|price\s+target|expected\s+return|portfolio\s+(?:weight|allocation)|strong\s+buy|investment\s+recommendation)\b/i;
function fail(code){throw Error(code);}
export function validateOutput(output,context){
 assertContract('output',output);
 if(output.claimHandle!=='C1'||output.baseRevisionHandle!=='R1')fail('UNKNOWN_CLAIM_REFERENCE');
 const seen=new Set(),attributions=[];
 for(const a of output.attributions){
  const id=context.handleMap.evidence[a.evidenceHandle],n=context.selected.find(x=>x.id===id);
  if(!id||!n||seen.has(id))fail('INVALID_EVIDENCE_HANDLE');seen.add(id);
  if(!n.node.evidence.statement.includes(a.quote))fail('UNSUPPORTED_QUOTE');
  if(n.contextOnly&&a.relation!=='context')fail('SUPERSEDED_ATTRIBUTION');
  if(forbiddenInvestment.test(a.quote))fail('FORBIDDEN_INVESTMENT_LANGUAGE');
  attributions.push({evidenceId:id,relation:a.relation,quote:a.quote,contextOnly:n.contextOnly});
 }
 const fresh=attributions.filter(a=>context.newEvidenceIds.includes(a.evidenceId));
 if(!fresh.length)fail('NEW_EVIDENCE_NOT_ATTRIBUTED');
 const has=r=>fresh.some(a=>a.relation===r);
 const stable=['confirm','no_material_effect','insufficient_evidence'].includes(output.impact);
 if(stable&&(output.suggestedStatus!==context.base.claim.status||output.suggestedConfidenceDirection!=='unchanged'))fail('IMPACT_STATE_INCOMPATIBLE');
 if(output.impact==='confirm'&&(!has('supports')||output.reasonCode!=='new_supporting_evidence'))fail('IMPACT_ATTRIBUTION_INCOMPATIBLE');
 if(output.impact==='strengthen'&&(!has('supports')||output.suggestedStatus!=='supported'||output.suggestedConfidenceDirection!=='increase'||!['new_supporting_evidence','metric_improvement','source_correction','period_update'].includes(output.reasonCode)))fail('IMPACT_ATTRIBUTION_INCOMPATIBLE');
 if(['weaken','contradict'].includes(output.impact)&&(!has('counters')||output.suggestedConfidenceDirection!=='decrease'||!['new_counter_evidence','conflicting_evidence','metric_deterioration','source_correction','period_update'].includes(output.reasonCode)))fail('IMPACT_ATTRIBUTION_INCOMPATIBLE');
 if(output.impact==='weaken'&&output.suggestedStatus!=='partially_supported')fail('IMPACT_STATE_INCOMPATIBLE');
 if(output.impact==='contradict'&&!['disputed','unverified'].includes(output.suggestedStatus))fail('IMPACT_STATE_INCOMPATIBLE');
 if(output.impact==='no_material_effect'&&(!has('context')||output.reasonCode!=='no_relevant_change'))fail('IMPACT_ATTRIBUTION_INCOMPATIBLE');
 if(output.impact==='insufficient_evidence'&&(!has('unclear')||output.reasonCode!=='insufficient_support'))fail('IMPACT_ATTRIBUTION_INCOMPATIBLE');
 const oldSupport=context.selected.some(n=>!n.contextOnly&&context.base.claim.supportingEvidenceIds.includes(n.id));
 if(output.suggestedStatus==='disputed'&&!(oldSupport||attributions.some(a=>a.relation==='supports'&&!a.contextOnly)))fail('DISPUTED_WITHOUT_SUPPORT');
 return attributions;
}
export function makeProposal(output,context,modelConfig){
 const attributions=validateOutput(output,context);
 const inputHash=digest({snapshot:context.snapshot,promptVersion,promptHash,modelConfig}),outputHash=digest(output);
 const reasonSummary=attributions.map(a=>`${a.relation}: ${a.quote}`).join('\n');
 const proposal={proposalVersion:'claim-revision-proposal/v0.12',proposalId:stableId('CRP',{inputHash}),subjectId:context.base.subjectId,claimId:context.base.claimId,baseRevisionId:context.base.id,baseRevisionHash:digest(context.base),evidenceIds:attributions.filter(a=>!a.contextOnly).map(a=>a.evidenceId),impact:output.impact,suggestedStatus:output.suggestedStatus,suggestedConfidenceDirection:output.suggestedConfidenceDirection,reasonCode:output.reasonCode,reasonSummary,attributions,modelProvider:modelConfig.provider,modelName:modelConfig.model,modelConfig,promptVersion,promptHash,inputHash,outputHash,asOf:context.asOf,timeMode:'audit',newEvidenceAvailableAt:context.selected.filter(n=>n.isNew).map(n=>({evidenceId:n.id,availableAt:n.availableAt,knowledgeAt:n.knowledgeAt})),baseRevisionEffectiveAt:instant(context.base.effectiveAt),proposalCreatedAt:context.createdAt,handleMap:context.handleMap,inputSnapshot:context.snapshot,modelOutput:output,lifecycle:'pending'};
 return assertContract('proposal',proposal);
}
export function validateProposal(proposal,context){
 assertContract('proposal',proposal);
 const recomputed=makeProposal(proposal.modelOutput,context,proposal.modelConfig);
 if(digest(proposal)!==digest(recomputed))fail('PROPOSAL_BINDING_INVALID');
 return {valid:true,proposalId:proposal.proposalId,authoritativeRevisionWritten:false};
}
