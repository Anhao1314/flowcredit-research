// Conservative deterministic Relation baseline.
//
// This is the first runtime implementation after the frozen Compatibility gate.
// It deliberately resolves only relations that can be explained by small,
// inspectable rules. Anything else abstains as AMBIGUOUS.
//
// It does not read gold labels, benchmark ids, models, providers or network state.
import {normalize, quantities, referentTokens, readPair} from '../claim-relation/legacy-read.js';

export const DETERMINISTIC_PROVIDER='relation-candidate/v0.2a';

const SCALE=Object.freeze({thousand:1e3,k:1e3,million:1e6,m:1e6,billion:1e9,bn:1e9});
const GENERIC=new Set([
 'greater','less','more','most','least','above','below','over','under','exactly',
 'published','final','reported','statement','table','row','figure','value','number',
 'amount','latest','newest','recent','growth','increase','increased','decrease',
 'decreased','decline','declined','higher','lower','high','low','remains','remain',
 'sales','revenue','gross','margin','net','income','operating','earnings','share','shares',
 'percentage','grew','grow','accelerating','decelerating','faster','slower','shifted','toward',
 'away','primary','driver','driven','caused','because','contributed','contributor','investment'
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

const METRIC_FAMILIES=Object.freeze([
 ['gross_margin',/\bgross[- ]?margin\b/],
 ['operating_income',/\boperating income\b/],
 ['net_income',/\bnet income\b/],
 ['eps',/\b(?:diluted )?earnings per share\b|\beps\b/],
 ['sales',/\bnet sales\b|\brevenue\b/],
 ['cash',/\bcash(?: balance)?\b/],
 ['headcount',/\bheadcount\b|\bemployees?\b/]
]);

function metricFamily(statement){
 const text=normalize(statement);
 return METRIC_FAMILIES.find(([,pattern])=>pattern.test(text))?.[0]??null;
}

function metricTokens(statement){
 return [...new Set(referentTokens(statement).filter(token=>token.length>=4&&!GENERIC.has(token)))];
}

function sharesMetric(claimStatement,evidenceStatement){
 const claimFamily=metricFamily(claimStatement),evidenceFamily=metricFamily(evidenceStatement);
 if(claimFamily&&evidenceFamily&&claimFamily!==evidenceFamily)return false;
 const claim=metricTokens(claimStatement);
 const evidence=metricTokens(evidenceStatement);
 if(!claim.length&&!evidence.length)return Boolean(claimFamily&&evidenceFamily&&claimFamily===evidenceFamily);
 if(!claim.length||!evidence.length)return Boolean(claimFamily&&evidenceFamily&&claimFamily===evidenceFamily);
 const evidenceSet=new Set(evidence);
 const common=claim.filter(token=>evidenceSet.has(token));
 if(common.length>=2)return true;
 const union=new Set([...claim,...evidence]).size;
 if(common.length===1&&union<=2)return true;
 return union>0&&common.length/union>=0.5;
}

function requiresSecondOrder(statement){
 return /\b(accelerat(?:e|ed|ing|ion)|decelerat(?:e|ed|ing|ion)|faster|slower)\b/.test(normalize(statement));
}

function orderedRateSeries(statement){
 const text=normalize(statement),rows=[];
 const valueThenYear=/(\d+(?:\.\d+)?)\s*(?:percent|%)\s+in\s+((?:19|20)\d{2})/g;
 let match;
 while((match=valueThenYear.exec(text))!==null)rows.push({year:Number(match[2]),value:Number(match[1])});
 if(rows.length<2){
  const yearThenValue=/\b((?:19|20)\d{2})\b[^.;]{0,70}?(\d+(?:\.\d+)?)\s*(?:percent|%)/g;
  while((match=yearThenValue.exec(text))!==null)rows.push({year:Number(match[1]),value:Number(match[2])});
 }
 const unique=new Map(rows.map(row=>[row.year,row]));
 return [...unique.values()].sort((a,b)=>a.year-b.year);
}

function causalClaim(statement){
 return /\b(caus(?:e|ed|es)|primary driver|driv(?:e|en|ing)|due to|contribut(?:e|ed|es|or)|pressur(?:e|ed|ing)|attribut(?:e|ed|able))\b/.test(normalize(statement));
}
function causalEvidence(statement){
 return /\b(caus(?:e|ed|es|ed by)|driven by|due to|because(?: of)?|contribut(?:e|ed|es|or)|attribut(?:e|ed|able)|impact of)\b/.test(normalize(statement));
}
function causalClause(statement){
 return normalize(statement).split(/\bwhile\b|[.;]/).find(part=>causalEvidence(part))??'';
}
function causalDecision(claimStatement,evidenceStatement){
 if(!causalClaim(claimStatement))return null;
 if(!causalEvidence(evidenceStatement))return result('NEUTRAL','RT_CAUSAL_LINK_ABSENT','evidence mentions related facts but states no causal link');
 const clause=causalClause(evidenceStatement);
 if(/\b(total|consolidated)\b/.test(normalize(claimStatement))&&!/\b(total|consolidated)\b/.test(clause)){
  return result('AMBIGUOUS','RT_CAUSAL_SCOPE_MISSING','causal evidence is stated for a narrower scope than the claim');
 }
 const claimTokens=metricTokens(claimStatement),evidenceTokens=metricTokens(clause);
 const common=claimTokens.filter(token=>evidenceTokens.includes(token));
 if(common.length<1)return result('AMBIGUOUS','RT_CAUSAL_DRIVER_UNBOUND','causal wording is present but the claim driver is not safely bound');
 return result('SUPPORTS','RT_EXPLICIT_CAUSAL_ATTRIBUTION','evidence explicitly attributes the relevant outcome to the claimed driver');
}

function mixShiftDecision(claimStatement,evidenceStatement){
 const claim=normalize(claimStatement);
 const match=claim.match(/\bmix\s+shift(?:ed|s|ing)?\s+(toward|away from)\s+([a-z0-9-]+)/);
 if(!match)return null;
 const direction=match[1],target=match[2];
 const clauses=normalize(evidenceStatement).split(/\bwhile\b|[.;]/);
 let targetRate=null,totalRate=null;
 for(const clause of clauses){
  const rate=quantities(clause).find(item=>item.family==='percent'||/percent|%/.test(item.literal??''));
  if(!rate)continue;
  if(clause.includes(target))targetRate=rate.value;
  if(/\btotal\b/.test(clause))totalRate=rate.value;
 }
 if(targetRate===null||totalRate===null)return result('AMBIGUOUS','RT_MIX_COMPARISON_MISSING','mix claim requires target and total comparable growth rates');
 const toward=targetRate>totalRate;
 const supports=direction==='toward'?toward:!toward;
 return result(supports?'SUPPORTS':'COUNTERS','RT_MIX_SHARE_INFERENCE','target growth '+targetRate+' vs total growth '+totalRate);
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

export function candidateDeterministicRelation(material,{reading=null}={}){
 if(!material?.claim?.statement||!material?.evidence?.statement){
  return result('AMBIGUOUS','RT_MATERIAL_INCOMPLETE','claim or evidence statement is missing');
 }

 const claimStatement=String(material.claim.statement);
 const evidenceStatement=String(material.evidence.statement);
 const pair=reading??readPair({claim:material.claim,evidence:material.evidence});

 if(normalize(claimStatement)===normalize(evidenceStatement)){
  return result('SUPPORTS','RT_EXACT_ASSERTION','claim and evidence assertions are textually identical');
 }

 const mixDecision=mixShiftDecision(claimStatement,evidenceStatement);
 if(mixDecision)return mixDecision;

 if(!sharesMetric(claimStatement,evidenceStatement)){
  return result('NEUTRAL','RT_NON_BEARING_METRIC','the readable evidence concerns a different metric or proposition');
 }

 const causal=causalDecision(claimStatement,evidenceStatement);
 if(causal)return causal;

 const claimQuantities=quantities(claimStatement);
 const evidenceQuantities=quantities(evidenceStatement);
 const chronologicalRates=orderedRateSeries(evidenceStatement);
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

 // Second-order direction such as acceleration requires at least two comparable
 // rates. One observation must still abstain; a two-point series may resolve.
 if(requiresSecondOrder(claimStatement)){
  const series=chronologicalRates.length>=2
   ?chronologicalRates.map(item=>item.value)
   :evidenceQuantities.map(scaled);
  if(series.length>=2){
   const first=series[0],last=series.at(-1);
   if(first!==last){
    const text=normalize(claimStatement);
    const positiveSecondOrder=/\b(accelerat(?:e|ed|ing|ion)|faster)\b/.test(text);
    const supports=positiveSecondOrder?last>first:last<first;
    return result(supports?'SUPPORTS':'COUNTERS','RT_SECOND_ORDER_SERIES',
     'comparable rate moved from '+String(first)+' to '+String(last));
   }
  }
  return result('AMBIGUOUS','RT_SECOND_ORDER_CONTEXT_MISSING','second-order direction requires a comparable rate series');
 }

 const claimDirection=directionOf(claimStatement);
 if(claimDirection&&evidenceQuantities.length>=2){
  const series=chronologicalRates.length>=2
   ?chronologicalRates.map(item=>item.value)
   :evidenceQuantities.map(scaled);
  const first=series[0],last=series.at(-1);
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
