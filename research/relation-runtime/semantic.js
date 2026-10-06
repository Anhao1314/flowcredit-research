// Relation resolver over explicit SemanticFrames.
import {assertSemanticFrame} from '../semantic-frame/project.js';

export const SEMANTIC_PROVIDER='relation-semantic/dev-v0.2';

function result(relation,rule,detail){
 return Object.freeze({relation,rule,detail,provider:SEMANTIC_PROVIDER});
}
function compare(value,threshold,operator){
 if(operator==='gt')return value>threshold;
 if(operator==='gte')return value>=threshold;
 if(operator==='lt')return value<threshold;
 if(operator==='lte')return value<=threshold;
 if(operator==='eq')return value===threshold;
 return null;
}

export function semanticRelation({claimFrame,evidenceFrame}){
 assertSemanticFrame(claimFrame);
 assertSemanticFrame(evidenceFrame);

 if(claimFrame.subjectId!==evidenceFrame.subjectId){
  return result('AMBIGUOUS','SEM_SUBJECT_MISMATCH','subject mismatch should normally have been refused by Compatibility');
 }

 if(claimFrame.proposition.metric!==evidenceFrame.proposition.metric){
  return result('NEUTRAL','SEM_METRIC_NON_BEARING',
   'recorded evidence metric '+evidenceFrame.proposition.metric+' does not bear on claim metric '+claimFrame.proposition.metric);
 }

 if(claimFrame.proposition.assertionType!=='QUANTITY_PREDICATE'||evidenceFrame.proposition.assertionType!=='NUMERIC_OBSERVATION'){
  return result('AMBIGUOUS','SEM_VALUE_FORM_UNSUPPORTED','structured predicate/value form is insufficient for deterministic relation');
 }

 const value=evidenceFrame.proposition.objectValue;
 const threshold=claimFrame.proposition.objectValue;
 const operator=claimFrame.proposition.comparator;
 const decision=compare(value,threshold,operator);
 if(decision===null)return result('AMBIGUOUS','SEM_COMPARATOR_UNSUPPORTED','unsupported structured comparator '+String(operator));
 return result(decision?'SUPPORTS':'COUNTERS','SEM_STRUCTURED_PREDICATE',
  String(value)+' '+operator+' '+String(threshold)+' -> '+String(decision));
}
