import {parseTableValue,parseTablePeriod} from '../evidence-support/support.js';
import {rowConcept,unitFamilies} from './domain.js';
import {namedLiteralMismatch} from './extraction.js';
import {assertIntent} from './contract.js';
export function timeMatches(intent,period){return period?.status==='known'&&period.end===intent.timeScope.end&&(intent.timeScope.kind==='period'?period.start===intent.timeScope.start:period.start===null);}
export function precheck(intent,support){
 assertIntent(intent);
 if(support.type!=='table')return {status:'eligible',reason:'Text semantic match requires bounded interpretation'};
 const concept=rowConcept(support),period=parseTablePeriod(support),numeric=parseTableValue(support);
 if(concept&&concept!==intent.targetMetricOrConcept)return {status:'TARGET_MISMATCH',reason:'Known table row/header concept mismatch',concept};
 if(intent.dimension.kind!=='none'&&support.rowLabel.trim().toLowerCase()!==intent.dimension.value.toLowerCase())return {status:'TARGET_MISMATCH',reason:'Explicit requested row dimension mismatch'};
 if(period.status==='known'&&!timeMatches(intent,period))return {status:'TARGET_MISMATCH',reason:'Verified header period conflicts with intent',period};
 if(numeric.status!=='known'||period.status!=='known')return {status:'PARSER_ERROR',reason:'Frozen table parser cannot establish value/unit/period',numeric,period};
 if(numeric.unit!==unitFamilies[intent.targetMetricOrConcept])return {status:'TARGET_MISMATCH',reason:'Explicit table unit family conflicts with requested measure'};
 return {status:'eligible',reason:concept?'Exact known row/header metadata':'Unknown row semantics require model proposal',concept};
}
export function checkTarget(intent,support,bound,validated){
 assertIntent(intent);
 if(bound.targetMatch==='not_supported')return {valid:false,failure:'TARGET_MISMATCH'};
 if(bound.targetMatch==='ambiguous')return {valid:false,failure:'SUPPORT_AMBIGUOUS'};
 const fact=bound.fact;
 if(fact.metricOrCategory!==intent.targetCategory)return {valid:false,failure:'CATEGORY_ERROR'};
 if(fact.metric!==intent.targetMetricOrConcept||fact.actualOrGuidance!==intent.actualOrGuidance||fact.explicitOrDerived!==intent.explicitOrDerived)return {valid:false,failure:'TARGET_MISMATCH'};
 if(validated.status!=='validated')return {valid:false,failure:validated.findings.includes('DETERMINISTIC_PARSE_UNSUPPORTED')?'PARSER_ERROR':'VALIDATOR_REJECT'};
 if(!timeMatches(intent,validated.parse.period)||validated.parse.numeric.unit!==unitFamilies[intent.targetMetricOrConcept])return {valid:false,failure:'TARGET_MISMATCH'};
 if(namedLiteralMismatch(support,intent,fact))return {valid:false,failure:'TARGET_MISMATCH'};
 const before=precheck(intent,support);if(before.status!=='eligible')return {valid:false,failure:before.status};
 return {valid:true,failure:null};
}
