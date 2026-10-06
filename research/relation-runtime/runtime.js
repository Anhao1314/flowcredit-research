// Pairwise Relation runtime baseline.
//
// Composition:
//   RelationInput -> CompatibilityAssessment -> gate -> conservative resolver
//   -> RelationReceipt
//
// No model or network call is reachable from this module.
import {readPair} from '../claim-relation/legacy-read.js';
import {compatibilityAssessment} from '../claim-relation/compatibility.js';
import {relationGate} from '../claim-relation/gate.js';
import {resolveRelationInput} from '../claim-relation/resolve.js';
import {deterministicRelation} from './deterministic.js';
import {eligibilityReceipt,receiptFromEvaluation} from './receipt.js';

export function evaluateRelation({relationInput,material,evaluatedAt=relationInput?.asOf}={}){
 const reading=readPair({claim:material?.claim??{},evidence:material?.evidence??{}});
 const assessment=compatibilityAssessment(relationInput,material,{reading});
 const gate=relationGate({relationInput,assessment});
 if(!gate.mayExecute){
  return receiptFromEvaluation({relationInput,assessment,gate,evaluatedAt});
 }
 const decision=deterministicRelation(material,{reading});
 return receiptFromEvaluation({relationInput,assessment,gate,decision,evaluatedAt});
}

export function evaluateRelationFromMemory(reader,{
 evidenceId,claimId,claimRevisionId,asOf,timeMode='audit',createdAt,projections=null,evaluatedAt=asOf
}={}){
 try{
  const {relationInput,material}=resolveRelationInput(reader,{evidenceId,claimId,claimRevisionId,asOf,timeMode,createdAt,projections});
  return {receipt:evaluateRelation({relationInput,material,evaluatedAt}),relationInput,material};
 }catch(error){
  return {
   receipt:eligibilityReceipt({
    evidenceId,claimId,claimRevisionId,asOf,evaluatedAt,
    code:error?.message??error?.code??'RELATION_INPUT_UNAVAILABLE'
   }),
   relationInput:null,
   material:null
  };
 }
}
