import {parseNumeric,parsePeriod} from '../analyst-staged/parsers.js';
import {spanPeriodText} from './renderer.js';
export const placeholderCell=/^(?:[*\u2014\u2013-]+|N\/?A)$/i;
export const normalizeSpace=text=>typeof text==='string'?text.replace(/[\u00a0\u2007\u202f]/g,' '):text;
const FORBIDDEN=/risk_grade|risk_score|accepted|thesis|target_price|\bbuy\b|\bsell\b/i;
const GUIDANCE_CUE=/\b(?:expect(?:s|ed)?|anticipate|guidance|forecast|project(?:s|ed)?)\b/i;
export function unitWord(span){
 if(!span.unitContext)return null;
 return {thousands:'thousand',millions:'million',billions:'billion'}[span.unitContext.scale]??null;
}
export function bindingLiteral(span){
 const word=unitWord(span);
 if(!word)return span.cellText;
 const currency=span.unitContext?.currency==='USD'&&!/\$/.test(span.cellText)?'$ ':'';
 return `${currency}${span.cellText} ${word}`;
}
function escape(text){return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function findWords(text,words){
 if(!words.length)return null;
 const pattern=new RegExp(words.map(escape).join('\\s+')).exec(text);
 return pattern?pattern[0]:null;
}
export function sourceQuote(chunkText,span){
 if(span.spanType!=='table')return chunkText.includes(span.text)?span.text:null;
 const cell=span.cellText.split(/\s+/).filter(Boolean),label=(span.rowLabel??'').split(/\s+/).filter(word=>word&&!/^\(\d+\)$/.test(word));
 return findWords(chunkText,[...label,...cell])??findWords(chunkText,cell);
}
export function deriveSpanFact(span,fact){
 const findings=[];
 if(fact.explicitOrDerived!=='explicit')findings.push('DETERMINISTIC_PARSE_UNSUPPORTED');
 if(FORBIDDEN.test(fact.metric))findings.push('FORBIDDEN_JUDGMENT');
 const evidence=span.spanType==='table'?bindingLiteral(span):span.text;
 const value=fact.rawValueText,unit=fact.rawUnitText,period=fact.periodText;
 if(span.spanType==='table'){
  if(value!==null&&!span.cellText.includes(value))findings.push('VALUE_ERROR');
  if(unit!==null&&!(span.unitContext&&span.unitContext.match.includes(unit)))findings.push('UNIT_ERROR');
  const periodText=spanPeriodText(span);
  if(period!==null&&!(periodText&&periodText.includes(period)))findings.push('PERIOD_ERROR');
 }else{
  const normalized=normalizeSpace(span.text);
  if(value!==null&&!normalized.includes(normalizeSpace(value)))findings.push('VALUE_ERROR');
  if(unit!==null&&!normalized.includes(normalizeSpace(unit)))findings.push('UNIT_ERROR');
  if(period!==null&&!normalized.includes(normalizeSpace(period)))findings.push('PERIOD_ERROR');
 }
 if(GUIDANCE_CUE.test(span.spanType==='table'?span.cellText+' '+(span.rowLabel??''):span.text)&&fact.actualOrGuidance!=='guidance')findings.push('ACTUAL_GUIDANCE_ERROR');
 if(fact.actualOrGuidance==='guidance'&&fact.metricOrCategory!=='guidance')findings.push('ACTUAL_GUIDANCE_ERROR');
 const numeric=span.spanType==='table'
  ?(value===null?{status:'unsupported',reason:'value_missing'}:parseNumeric(bindingLiteral(span),null,{quote:bindingLiteral(span)}))
  :parseNumeric(value,unit,{quote:span.text});
 const periodText=span.spanType==='table'?spanPeriodText(span):period;
 const parsedPeriod=periodText?parsePeriod(periodText):{status:'unknown',reason:'period_missing'};
 if(numeric.status!=='known'||parsedPeriod.status!=='known')findings.push('DETERMINISTIC_PARSE_UNSUPPORTED');
 if(fact.actualOrGuidance==='risk_disclosure'&&numeric.status==='known')findings.push('ACTUAL_GUIDANCE_ERROR');
 return {evidence,numeric,period:parsedPeriod,findings:[...new Set(findings)],status:findings.length?'unsupported':'parsed'};
}
