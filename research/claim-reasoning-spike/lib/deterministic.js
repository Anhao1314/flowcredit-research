// Deterministic relation checks for the spike.
// Domain-general only: numeric comparison, unit normalization, period comparison,
// subject/scope equality, hedge and truncation detection, table arithmetic.
// This module never sees expected labels, case ids or the dev-set file.
import {quantities,periods,comparator,isLatestSeries,isTrendClaim,percentThreshold,hedge,truncated,otherSubject,sharesMetric,compare,normalize} from './text.js';

export const PROVIDER='deterministic/v1';

function unitFamily(text){
 const t=normalize(text);
 if(/\b(usd|dollars?|us\$|\$)\b/.test(t)||/\$/.test(t))return 'currency';
 if(/\b(percent|%)\b/.test(t))return 'percent';
 return null;
}
function money(q){return q.value;}

// Returns {relation, rule, detail} or null when the deterministic layer withholds.
export function deterministicRelation(claim,evidence){
 // R10 truncated statement
 if(truncated(evidence))return {relation:'AMBIGUOUS',rule:'R10_TRUNCATED',detail:'evidence statement is incomplete'};
 // R7 hedged quantity cannot decide direction
 if(hedge(evidence)&&quantities(evidence).length>0)return {relation:'AMBIGUOUS',rule:'R7_HEDGED_QUANTITY',detail:'hedged or unresolved-scale statement'};
 // R11 subject / scope equality
 const other=otherSubject([claim,evidence]);
 if(other)return {relation:'NEUTRAL',rule:'R11_SUBJECT_SCOPE',detail:other};
 // metric equality: require a shared metric phrase before any numeric decision
 if(!sharesMetric(claim,evidence))return null;

 const cq=quantities(claim),eq=quantities(evidence);
 const cp=periods(claim),ep=periods(evidence);
 const op=comparator(claim);

 // R2 table / multi-period arithmetic: two periods and two quantities in evidence
 if(eq.length>=2&&(ep.years.length>=2||ep.months.length>=2)){
  if(isTrendClaim(claim)){
   const pct=percentThreshold(claim);
   const change=(eq[eq.length-1].value-eq[0].value)/Math.abs(eq[0].value||1)*100;
   const grew=eq[eq.length-1].value>eq[0].value;
   if(pct!==null)return {relation:change>=pct?'SUPPORTS':'COUNTERS',rule:'R2_PERCENT_ARITHMETIC',detail:`change ${change.toFixed(2)} percent vs threshold ${pct} percent`};
   return {relation:grew?'SUPPORTS':'COUNTERS',rule:'R2_TREND_ARITHMETIC',detail:`${eq[0].value} to ${eq[eq.length-1].value}`};
  }
 }

 // R5 dated claim vs different explicit period
 const ownPeriod=(cp.months.length||cp.years.length)>0;
 const evPeriod=(ep.months.length||ep.years.length)>0;
 if(ownPeriod&&evPeriod){
  const sameMonth=cp.months.some(m=>ep.months.includes(m))||cp.months.length===0;
  const sameYear=cp.years.some(y=>ep.years.includes(y))||cp.years.length===0;
  if(!(sameMonth&&sameYear)&&!isLatestSeries(claim))return {relation:'NEUTRAL',rule:'R5_PERIOD_MISMATCH',detail:`claim ${[...cp.months,...cp.years].join('/')} vs evidence ${[...ep.months,...ep.years].join('/')}`};
 }

 // R1 numeric predicate
 if(op&&cq.length>=1&&eq.length>=1){
  // R8 completeness guards: the deciding unit or period must be present
  const claimUnit=unitFamily(claim),evUnit=unitFamily(evidence);
  if(claimUnit&&!evUnit)return {relation:'AMBIGUOUS',rule:'R8_UNIT_MISSING',detail:'evidence quantity has no unit'};
  if(claimUnit==='percent'&&evUnit!=='percent')return {relation:'AMBIGUOUS',rule:'R8_UNIT_FAMILY',detail:'percent predicate vs non-percent evidence'};
  if(ownPeriod&&!evPeriod)return {relation:'AMBIGUOUS',rule:'R8_PERIOD_MISSING',detail:'dated claim vs undated evidence'};
  const threshold=cq[0].value,value=money(eq[0]);
  const ok=compare(value,threshold,op);
  if(ok===null)return null;
  return {relation:ok?'SUPPORTS':'COUNTERS',rule:'R1_NUMERIC_COMPARATOR',detail:`${value} ${op} ${threshold} is ${ok}`};
 }
 return null;
}
