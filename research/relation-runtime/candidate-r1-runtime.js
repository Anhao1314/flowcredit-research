// Experimental v0.2B-R1 Relation candidate.
//
// This composes the frozen RelationInput + Compatibility gate with the candidate
// deterministic resolver. It is benchmarked side-by-side with the validated
// baseline and is not the default production/development path.
import {candidateReadPair} from './candidate-reading.js';
import {compatibilityAssessment} from '../claim-relation/compatibility.js';
import {relationGate} from '../claim-relation/gate.js';
import {receiptFromEvaluation} from './receipt.js';
import {candidateR1DeterministicRelation} from './candidate-r1-deterministic.js';

export function evaluateCandidateR1Relation({relationInput,material,evaluatedAt=relationInput?.asOf}={}){
 const reading=candidateReadPair({claim:material?.claim??{},evidence:material?.evidence??{}});
 const assessment=compatibilityAssessment(relationInput,material,{reading});
 const gate=relationGate({relationInput,assessment});
 if(!gate.mayExecute)return receiptFromEvaluation({relationInput,assessment,gate,evaluatedAt});
 const decision=candidateR1DeterministicRelation(material,{reading});
 return receiptFromEvaluation({relationInput,assessment,gate,decision,evaluatedAt});
}
