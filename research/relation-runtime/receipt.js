// RelationReceipt development schema and constructors.
//
// The frozen ADR requires identity, as-of awareness, legal status/relation
// combinations and analytical-only authority. The concrete receipt shape is
// intentionally versioned as development, not presented as a frozen contract.
import {createHash} from 'node:crypto';
import {deepFreeze,relationLabels} from '../claim-relation/contract.js';

export const RECEIPT_VERSION='flowcredit.relation_receipt/dev-v0.1';

function stableId(prefix,value){
 const hash=createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20);
 return prefix+'-'+hash;
}

function legal(processingStatus,relation){
 if(processingStatus==='RESOLVED')return ['SUPPORTS','COUNTERS','NEUTRAL'].includes(relation);
 if(processingStatus==='ABSTAINED')return relation==='AMBIGUOUS';
 if(processingStatus==='NOT_EVALUATED'||processingStatus==='ERROR')return relation===null;
 return false;
}

function finalize(core){
 if(!legal(core.processingStatus,core.relation))throw new Error('RELATION_RECEIPT_ILLEGAL_STATE');
 if(core.relation!==null&&!relationLabels.includes(core.relation))throw new Error('RELATION_RECEIPT_UNKNOWN_RELATION');
 const receiptId=stableId('REL',core);
 return deepFreeze({version:RECEIPT_VERSION,receiptId,...core});
}

export function receiptFromEvaluation({relationInput,assessment,gate,decision=null,evaluatedAt=relationInput?.asOf}){
 if(!relationInput)throw new Error('RELATION_RECEIPT_INPUT_REQUIRED');
 const identity={
  evidenceId:relationInput.evidence.evidenceId,
  claimId:relationInput.claim.claimId,
  claimRevisionId:relationInput.claim.revisionId,
  asOf:relationInput.asOf
 };

 if(!gate?.mayExecute){
  const code=gate?.refusal?.code??gate?.refusal?.disposition??'RELATION_NOT_PERMITTED';
  return finalize({
   ...identity,
   evaluatedAt,
   processingStatus:'NOT_EVALUATED',
   relation:null,
   route:'compatibility-gate',
   reasonCodes:[String(code)],
   compatibility:assessment?{disposition:assessment.disposition,findings:assessment.findings}:null,
   resolver:null,
   authority:'ANALYTICAL_ONLY'
  });
 }

 if(!decision?.relation)throw new Error('RELATION_DECISION_REQUIRED');
 const processingStatus=decision.relation==='AMBIGUOUS'?'ABSTAINED':'RESOLVED';
 return finalize({
  ...identity,
  evaluatedAt,
  processingStatus,
  relation:decision.relation,
  route:decision.relation==='AMBIGUOUS'?'deterministic-abstention':'deterministic',
  reasonCodes:[String(decision.rule??'RELATION_RULE_UNSPECIFIED')],
  compatibility:{disposition:assessment.disposition,findings:assessment.findings},
  resolver:{
   provider:String(decision.provider??'unknown'),
   rule:String(decision.rule??'RELATION_RULE_UNSPECIFIED'),
   detail:String(decision.detail??'')
  },
  authority:'ANALYTICAL_ONLY'
 });
}

export function eligibilityReceipt({evidenceId,claimId,claimRevisionId,asOf,code,evaluatedAt=asOf}){
 return finalize({
  evidenceId:String(evidenceId??'UNBOUND'),
  claimId:String(claimId??'UNBOUND'),
  claimRevisionId:String(claimRevisionId??'UNBOUND'),
  asOf:asOf??null,
  evaluatedAt:evaluatedAt??null,
  processingStatus:'NOT_EVALUATED',
  relation:null,
  route:'eligibility',
  reasonCodes:[String(code??'RELATION_INPUT_UNAVAILABLE')],
  compatibility:null,
  resolver:null,
  authority:'ANALYTICAL_ONLY'
 });
}
