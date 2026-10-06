// Investigation planner for abstained RelationReceipts.
//
// Planning is deterministic and produces a research question, never a conclusion.
import {createHash} from 'node:crypto';

export const INVESTIGATION_VERSION='flowcredit.investigation_plan/dev-v0.2';
const idOf=value=>'INV-'+createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20);

function referent(statement){
 const text=String(statement??'').replace(/[.?!]+$/,'').trim();
 return text||'the current Claim';
}

export function planInvestigation(receipt,material){
 if(receipt?.processingStatus!=='ABSTAINED'||receipt?.relation!=='AMBIGUOUS')return null;
 const reason=receipt.reasonCodes?.[0]??'RELATION_CONTEXT_MISSING';
 let requirement,question;
 if(reason==='RT_SECOND_ORDER_CONTEXT_MISSING'){
  requirement='PRIOR_COMPARABLE_RATE';
  question='Find the previous comparable-period rate needed to test whether: '+referent(material?.claim?.statement);
 }else if(reason==='RT_DETERMINISTIC_WITHHELD'){
  requirement='COMPARABLE_EVIDENCE';
  question='Find comparable evidence with an explicit metric, unit and period for: '+referent(material?.claim?.statement);
 }else{
  requirement='MISSING_RELATION_CONTEXT';
  question='Find the missing context required to safely evaluate: '+referent(material?.claim?.statement);
 }
 const core={
  relationReceiptId:receipt.receiptId,
  evidenceId:receipt.evidenceId,
  claimId:receipt.claimId,
  claimRevisionId:receipt.claimRevisionId,
  asOf:receipt.asOf,
  reasonCode:reason,
  requirement,
  question,
  state:'NEEDS_INVESTIGATION',
  authority:'RESEARCH_QUESTION_ONLY',
  claimMutationAllowed:false
 };
 return Object.freeze({version:INVESTIGATION_VERSION,investigationId:idOf(core),...core});
}
