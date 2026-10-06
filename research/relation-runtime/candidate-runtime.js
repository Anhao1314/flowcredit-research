// Experimental v0.2A Relation candidate.
//
// This composes the frozen RelationInput + Compatibility gate with the candidate
// deterministic resolver. It is benchmarked side-by-side with the validated
// baseline and is not the default production/development path.
import {candidateReadPair} from './candidate-reading.js';
import {compatibilityAssessment} from '../claim-relation/compatibility.js';
import {relationGate} from '../claim-relation/gate.js';
import {receiptFromEvaluation} from './receipt.js';
import {candidateDeterministicRelation} from './candidate-deterministic.js';

export function evaluateCandidateRelation({relationInput,material,evaluatedAt=relationInput?.asOf}={}){
 const reading=candidateReadPair({claim:material?.claim??{},evidence:material?.evidence??{}});
 const assessment=compatibilityAssessment(relationInput,material,{reading});
 const gate=relationGate({relationInput,assessment});
 if(!gate.mayExecute)return receiptFromEvaluation({relationInput,assessment,gate,evaluatedAt});
 const decision=candidateDeterministicRelation(material,{reading});
 return receiptFromEvaluation({relationInput,assessment,gate,decision,evaluatedAt});
}
