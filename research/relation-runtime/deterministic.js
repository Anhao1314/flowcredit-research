// Conservative deterministic Relation baseline.
//
// This is the first runtime implementation after the frozen Compatibility gate.
// It deliberately resolves only relations that can be explained by small,
// inspectable rules. Anything else abstains as AMBIGUOUS.
//
// It does not read gold labels, benchmark ids, models, providers or network state.
import {normalize, quantities, referentTokens, readPair} from '../claim-relation/legacy-read.js';

export const DETERMINISTIC_PROVIDER='relation-deterministic/dev-v0.1';

const SCALE=Object.freeze({thousand:1e3,k:1e3,million:1e6,m:1e6,billion:1e9,bn:1e9});
const GENERIC=new Set([
 'greater','less','more','most','least','above','below','over','under','exactly',
 'published','final','reported','statement','table','row','figure','value','number',
 'amount','latest','newest','recent','growth','increase','increased','decrease',
 'decreased','decline','declined','higher','lower','high','low','remains','remain'
]);

function scaled(quantity){
 if(!quantity)return null;
 return quantity.value*(quantity.scale?SCALE[quantity.scale]??1:1);
}

function comparator(statement){
 const text=normalize(statement);
 if(/\b(at least|no less than|not less than)\b/.test(text))return 'ge';
 if(/\b(at most|no more than|not more than)\b/.test(text))return 'le';
 if(/\bexactly\b/.test(text))return 'eq';
 if(/\b(greater than|more than|exceeds|exceeded|above|over)\b/.test(text))return 'gt';
 if(/\b(less than|below|under|fewer than)\b/.test(text))return 'lt';
 return null;
}

function compare(value,threshold,operation){
 if(operation==='gt')return value>threshold;
 if(operation==='ge')return value>=threshold;
 if(operation==='lt')return value<threshold;
 if(operation==='le')return value<=threshold;
 if(operation==='eq')return value===threshold;
 return null;
}

function metricTokens(statement){
 return [...new Set(referentTokens(statement).filter(token=>token.length>=4&&!GENERIC.has(token)))];
}

function sharesMetric(claimStatement,evidenceStatement){
 const claim=metricTokens(claimStatement);
 const evidence=metricTokens(evidenceStatement);
 if(!claim.length||!evidence.length)return false;
 const evidenceSet=new Set(evidence);
 const common=claim.filter(token=>evidenceSet.has(token));
 if(common.some(token=>token.length>=7))return true;
 if(common.length>=2)return true;
 const union=new Set([...claim,...evidence]).size;
 return union>0&&common.length/union>=0.34;
}

function requiresSecondOrder(statement){
 return /\b(accelerat(?:e|ed|ing|ion)|decelerat(?:e|ed|ing|ion))\b/.test(normalize(statement));
}

function directionOf(statement){
 const text=normalize(statement);
 const positive=/\b(grow|grew|growth|increase|increased|increasing|rise|rose|rising|expand|expanded|expansion|higher|high|strengthen|strengthened|improve|improved|improving)\b/.test(text);
 const negative=/\b(decline|declined|declining|decrease|decreased|decreasing|fall|fell|falling|contract|contracted|contraction|lower|low|weaken|weakened|deteriorate|deteriorated|deteriorating)\b/.test(text);
 if(positive&&!negative)return 1;
 if(negative&&!positive)return -1;
 return 0;
}

function result(relation,rule,detail){
 return Object.freeze({relation,rule,detail,provider:DETERMINISTIC_PROVIDER});
}

export function deterministicRelation(material,{reading=null}={}){
 if(!material?.claim?.statement||!material?.evidence?.statement){
  return result('AMBIGUOUS','RT_MATERIAL_INCOMPLETE','claim or evidence statement is missing');
 }

 const claimStatement=String(material.claim.statement);
 const evidenceStatement=String(material.evidence.statement);
 const pair=reading??readPair({claim:material.claim,evidence:material.evidence});

 if(normalize(claimStatement)===normalize(evidenceStatement)){
  return result('SUPPORTS','RT_EXACT_ASSERTION','claim and evidence assertions are textually identical');
 }

 if(!sharesMetric(claimStatement,evidenceStatement)){
  return result('NEUTRAL','RT_NON_BEARING_METRIC','the readable evidence concerns a different metric or proposition');
 }

 const claimQuantities=quantities(claimStatement);
 const evidenceQuantities=quantities(evidenceStatement);
 const operation=comparator(claimStatement);

 if(operation&&claimQuantities.length&&evidenceQuantities.length){
  const threshold=scaled(claimQuantities[0]);
  const value=scaled(evidenceQuantities.at(-1));
  const decided=compare(value,threshold,operation);
  if(decided!==null){
   return result(decided?'SUPPORTS':'COUNTERS','RT_NUMERIC_COMPARATOR',
    String(value)+' '+operation+' '+String(threshold)+' -> '+String(decided));
  }
 }

 // "Growth is accelerating" cannot be resolved from one growth observation.
 // The frozen ADR names this exact shape as a required abstention.
 if(requiresSecondOrder(claimStatement)){
  return result('AMBIGUOUS','RT_SECOND_ORDER_CONTEXT_MISSING','acceleration/deceleration requires a comparison rate or series');
 }

 const claimDirection=directionOf(claimStatement);
 if(claimDirection&&evidenceQuantities.length>=2){
  const first=scaled(evidenceQuantities[0]);
  const last=scaled(evidenceQuantities.at(-1));
  if(first!==last){
   const evidenceDirection=last>first?1:-1;
   return result(evidenceDirection===claimDirection?'SUPPORTS':'COUNTERS','RT_SERIES_DIRECTION',
    'evidence series moved from '+String(first)+' to '+String(last));
  }
 }

 const evidenceDirection=directionOf(evidenceStatement);
 if(claimDirection&&evidenceDirection){
  return result(claimDirection===evidenceDirection?'SUPPORTS':'COUNTERS','RT_EXPLICIT_DIRECTION',
   'claim and evidence contain readable directional language');
 }

 // Compatibility allowed evaluation, but this baseline cannot safely determine
 // a directional result. Abstention is a feature, not an error.
 if(pair.claim&&pair.evidence){
  return result('AMBIGUOUS','RT_DETERMINISTIC_WITHHELD','no conservative deterministic relation rule resolved the pair');
 }
 return result('AMBIGUOUS','RT_READING_UNAVAILABLE','semantic reading unavailable');
}
