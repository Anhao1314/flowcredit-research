// Provenance-aware structured Relation runtime path.
import {relationGate} from '../claim-relation/gate.js';
import {receiptFromEvaluation} from './receipt.js';
import {semanticCompatibilityAssessment} from './semantic-compatibility.js';
import {semanticRelation} from './semantic.js';

export function evaluateProjectedRelation({relationInput,claimFrame,evidenceFrame,evaluatedAt=relationInput?.asOf}={}){
 const assessment=semanticCompatibilityAssessment(relationInput,{claimFrame,evidenceFrame});
 const gate=relationGate({relationInput,assessment});
 if(!gate.mayExecute)return receiptFromEvaluation({relationInput,assessment,gate,evaluatedAt});
 const decision=semanticRelation({claimFrame,evidenceFrame});
 return receiptFromEvaluation({relationInput,assessment,gate,decision,evaluatedAt});
}
