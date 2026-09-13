import {parseNumeric,parsePeriod} from '../analyst-staged/parsers.js';
import {spanPeriodText} from '../grounding/renderer.js';
import {bindingLiteral,normalizeSpace} from '../grounding/facts.js';
export const goldGroundingVersion='gold-span-annotation/v2';

function cellNumber(span){
 if(span.spanType!=='table')return null;
 const bound=bindingLiteral(span);
 const parsed=parseNumeric(bound,null,{quote:bound});
 return parsed.status==='known'?parsed:null;
}
function unitMatches(span,expectedUnit){
 if(expectedUnit==='percent')return /\d+(?:\.\d+)?%/.test(span.cellText);
 const word={USD_millions:'millions',USD_billions:'billions',USD:'dollars'}[expectedUnit];
 if(!word)return false;
 if(expectedUnit==='USD')return !!span.unitContext&&span.unitContext.scale==='thousands'&&/[$,]/.test(span.cellText);
 return !!span.unitContext&&span.unitContext.scale===word;
}
function periodMatches(span,expected){
 const text=spanPeriodText(span);
 if(!text)return false;
 const parsed=parsePeriod(text);
 if(parsed.status!=='known')return false;
 const end=expected.periodEnd??expected.observedAt??null,start=expected.periodStart??null;
 if(end&&parsed.end!==end)return false;
 if(start&&parsed.start!==start)return false;
 return true;
}
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
function dateForms(date){
 const [year,month,day]=date.split('-').map(Number);
 const name=months[month-1];
 return [date,`${name} ${day}, ${year}`,`${name} ${day} ${year}`,`${name} ${day},${year}`];
}
function sentencePeriodMatches(sentenceText,expected){
 const text=normalizeSpace(sentenceText);
 const dates=[expected.periodEnd,expected.observedAt,expected.periodStart].filter(Boolean);
 if(!dates.length)return true;
 return dates.some(date=>dateForms(date).some(form=>text.includes(form)));
}
const literalPattern=/(?:\$\s*|\bUSD\s+)?(?:\(?[-−]?\d{1,3}(?:,\d{3})*(?:\.\d+)?\)?|[-−]?\d+(?:\.\d+)?)(?:\s*(?:million|billion|percent|%|days?|customers?))?/gi;
function sentenceLiteralMatches(sentenceText,expected){
 const text=normalizeSpace(sentenceText);
 for(const match of text.matchAll(literalPattern)){
  const candidate=match[0].trim();
  if(!candidate||!/\d/.test(candidate))continue;
  const parsed=parseNumeric(candidate,null,{quote:text});
  if(parsed.status!=='known')continue;
  if(parsed.normalizedValue!==expected.normalizedValue)continue;
  if(parsed.rawUnit!==expected.rawUnit)continue;
  return true;
 }
 return false;
}
export function annotateCase(registry,sentenceIndex,{caseId,goldEvidenceId,documentId,page,expected,legacyBinding}){
 const spans=registry.findSpansByPage(documentId,page),basis=[],matched=[];
 for(const span of spans){
  if(span.spanType!=='table')continue;
  if(span.cellText.includes('*')||/^[$\s]*$/.test(span.cellText))continue;
  const numeric=cellNumber(span);
  if(!numeric||numeric.numericValue!==expected.rawValue)continue;
  if(!periodMatches(span,expected))continue;
  if(!unitMatches(span,expected.rawUnit))continue;
  matched.push(span.id);basis.push(`table:${span.rowLabel}|${spanPeriodText(span)}|${span.cellText}`);
 }
 if(matched.length)return {caseId,goldEvidenceId,legacyBinding,documentId,page,classification:'table_span',expectedSupportType:'table',expectedSpanIds:matched,spanIds:matched,basis};
 const sentences=sentenceIndex.list({documentId,page});
 for(const sentence of sentences){
  if(!sentenceLiteralMatches(sentence.text,expected))continue;
  if(!sentencePeriodMatches(sentence.text,expected))continue;
  matched.push(sentence.id);basis.push(`sentence:${sentence.id}`);
 }
 const classification=matched.length?'sentence_span':'unsupported';
 return {caseId,goldEvidenceId,legacyBinding,documentId,page,classification,expectedSupportType:classification==='sentence_span'?'text':null,expectedSpanIds:matched,spanIds:matched,basis};
}
export function reclassifyLockedGold(registry,sentenceIndex,cases){
 const annotated=cases.map(entry=>annotateCase(registry,sentenceIndex,entry));
 const legacy=annotated.filter(entry=>entry.legacyBinding==='table_column');
 const count=classification=>annotated.filter(entry=>entry.classification===classification).length;
 return {version:goldGroundingVersion,subjectId:'coreweave',cases:annotated,totals:{total:annotated.length,text:count('sentence_span'),table:count('table_span'),unsupported:count('unsupported'),coverageRate:(annotated.length-count('unsupported'))/annotated.length},legacyTableMapping:{total:legacy.length,nowTableGroundable:legacy.filter(entry=>entry.classification==='table_span').length,nowTextGroundable:legacy.filter(entry=>entry.classification==='sentence_span').length,stillUnsupported:legacy.filter(entry=>entry.classification==='unsupported').length}};
}
