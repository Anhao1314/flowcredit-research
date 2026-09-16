// Gate adapter: answer only "may Relation execute?" for one frozen RelationInput
// plus its CompatibilityAssessment. References:
//   CM-14.7 binding, CM-15.4/CM-37.1-37.3 execution consequence,
//   ADR section 4 / 4.5 processing status and relation legality.
//
// Hard acceptance behaviour (session 2.7B sections 12-13):
//   COMMENSURABLE      -> mayExecute = true
//   NOT_COMMENSURABLE  -> mayExecute = false
//   INDETERMINATE      -> mayExecute = false
//   missing assessment -> fail closed
//   wrong pair binding -> fail closed
// Every refused pair is NOT_EVALUATED with relation = null; no NEUTRAL, AMBIGUOUS,
// SUPPORTS or COUNTERS may be produced here, and no Relation label is emitted.

import {assertCompatibilityAssessment,assertRelationInput,deepFreeze,pairIdentity} from './contract.js';

const sameIdentity=(left,right)=>left.evidenceId===right.evidenceId&&left.claimId===right.claimId&&left.revisionId===right.revisionId&&left.asOf===right.asOf;
const refuse=(stage,code,extra=null)=>deepFreeze({mayExecute:false,processingStatus:'NOT_EVALUATED',relation:null,refusal:deepFreeze(extra?{stage,code,...extra}:{stage,code})});

// Eligibility failure E1-E5 produces no input and no assessment (CM-9.x, CM-15.1.3,
// RI-11.1); the gate reports the refusal without inventing an evaluation.
export function eligibilityRefusal(code){
 return refuse('ELIGIBILITY',String(code));
}

export function relationGate({relationInput=null,assessment=null}={}){
 if(!relationInput)return eligibilityRefusal('RELATION_INPUT_MISSING');
 assertRelationInput(relationInput);
 if(!assessment)return refuse('COMPATIBILITY','ASSESSMENT_MISSING');
 assertCompatibilityAssessment(assessment);
 // CM-14.7: the assessment binds the exact RelationInput by reference and copies no
 // tuple; the identity cross-check is computed from the referenced objects at gate
 // time so a structurally-equal but different pair still fails closed.
 if(assessment.relationInput!==relationInput)return refuse('BINDING','PAIR_BINDING_MISMATCH');
 if(!sameIdentity(pairIdentity(assessment.relationInput),pairIdentity(relationInput)))return refuse('BINDING','PAIR_BINDING_MISMATCH');
 if(assessment.disposition==='COMMENSURABLE')return deepFreeze({mayExecute:true,processingStatus:null,relation:null,refusal:null});
 // CM-37.2/CM-37.3: the pair is refused; the refusal carries its structured reason
 // for a future RelationReceipt and never a Relation label.
 return refuse('COMPATIBILITY',assessment.disposition,{disposition:assessment.disposition,findings:assessment.findings});
}

