import {parseNumeric,parsePeriod} from '../analyst-staged/parsers.js';
import {spanPeriodText} from './renderer.js';
import {bindingLiteral,normalizeSpace} from './facts.js';
export const goldGroundingVersion='gold-span-annotation/v1';

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
function literalFormats(value){
 const digits=String(Math.abs(value));
 return [digits,String(value),Number(value).toLocaleString('en-US'),Number(value).toLocaleString('en-US').replace(/,/g,'')];
}
export function annotateCase(registry,{caseId,goldEvidenceId,documentId,page,expected,legacyBinding}){
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
 let classification='unsupported';
 if(matched.length)classification='table_span';
 else{
  for(const span of spans){
   if(span.spanType!=='text')continue;
   const normalized=normalizeSpace(span.text);
   const literal=literalFormats(expected.rawValue).some(format=>normalized.includes(format));
   if(!literal)continue;
   const date=expected.periodEnd??expected.observedAt;
   if(date&&!/\b20\d{2}\b/.test(normalized))continue;
   matched.push(span.id);basis.push('text:'+span.id);
  }
  if(matched.length)classification='text_span';
 }
 return {caseId,goldEvidenceId,legacyBinding,documentId,page,classification,spanIds:matched,basis:legacyBinding==='table_column'&&classification!=='table_span'?[...basis,'legacy_table_binding_without_span']:basis};
}
export function reclassifyLockedGold(registry,cases){
 const annotated=cases.map(entry=>annotateCase(registry,entry));
 const legacy=annotated.filter(entry=>entry.legacyBinding==='table_column');
 return {version:goldGroundingVersion,subjectId:'coreweave',cases:annotated,totals:{total:annotated.length,text:annotated.filter(entry=>entry.classification==='text_span').length,table:annotated.filter(entry=>entry.classification==='table_span').length,unsupported:annotated.filter(entry=>entry.classification==='unsupported').length,coverageRate:annotated.filter(entry=>entry.classification!=='unsupported').length/annotated.length},legacyTableMapping:{total:legacy.length,nowTableGroundable:legacy.filter(entry=>entry.classification==='table_span').length,nowTextGroundable:legacy.filter(entry=>entry.classification==='text_span').length,stillUnsupported:legacy.filter(entry=>entry.classification==='unsupported').length}};
}
