import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {spanHash} from '../grounding/registry.js';
import {normalizeSpace} from '../grounding/facts.js';
import {parseNumeric,parsePeriod} from '../analyst-staged/parsers.js';
import {supportVersion,supportHash,tableIdOfSpan,parseTableValue,parseTablePeriod} from './support.js';
import {segmentationVersion} from './sentences.js';
import {groundingVersion} from '../grounding/grounding.js';

export const validationVersionV2='grounded-evidence-validation/v2';
export const validatorV2Hash=digest(readFileSync(new URL('./validator.js',import.meta.url),'utf8'));
export const forbiddenJudgment=/risk_grade|risk_score|accepted|thesis|target_price|\bbuy\b|\bsell\b/i;
const GUIDANCE_CUE=/\b(?:expect(?:s|ed)?|anticipate|guidance|forecast|project(?:s|ed)?)\b/i;

// v0.9 text-path guidance rule: a cue must touch the extracted value itself.
// A cue before the literal inside the same clause, or immediately after it
// without an intervening clause boundary, makes the assertion forward-looking.
// This keeps "we expect revenue of $X" rejected while an as-of balance whose
// later clause describes future recognition is still an actual disclosure.
export function assertionWindow(text,literal){
 const index=text.indexOf(literal);
 if(index<0)return null;
 let before=text.slice(Math.max(0,index-160),index);
 const boundary=Math.max(before.lastIndexOf(';'),before.lastIndexOf(':'));
 if(boundary>=0)before=before.slice(boundary+1);
 let after=text.slice(index+literal.length,index+literal.length+40);
 const cut=after.search(/[.;:,]/);
 if(cut>=0)after=after.slice(0,cut);
 return {before,after};
}
function finding(list,code){if(!list.includes(code))list.push(code);}
function sameJson(a,b){return digest(a)===digest(b);}
function escapeRegExp(text){return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
// A bare date is ambiguous on its own; when the verified sentence itself says
// "as of <date>" next to the value, that source context is used, not invented.
export function periodWithSourceContext(text,periodText){
 const direct=parsePeriod(periodText);
 if(direct.status==='known')return direct;
 const pattern=new RegExp('\\bas\\s+of\\s+'+escapeRegExp(periodText.trim()),'i');
 return pattern.test(text)?parsePeriod('as of '+periodText.trim()):direct;
}

export function validateSupportV2({registry,sentenceIndex,tableIndex},support,{subjectId=null,asOf=null,timeMode='replay',documentId=null}={}){
 const findings=[];
 if(!support||typeof support!=='object')return {valid:false,findings:['SUPPORT_MISSING']};
 if(support.supportVersion!==supportVersion)finding(findings,'SUPPORT_VERSION_DRIFT');
 if(!['text','table'].includes(support.type)){finding(findings,'SUPPORT_TYPE_UNSUPPORTED');return {valid:false,findings};}
 const document=registry.document(support.documentId);
 if(!document){finding(findings,'DOCUMENT_UNKNOWN');return {valid:false,findings};}
 if(documentId&&document.id!==documentId)finding(findings,'DOCUMENT_MISMATCH');
 if(document.subjectId!==support.subjectId||document.sourceId!==support.sourceId)finding(findings,'IDENTITY_MISMATCH');
 if(subjectId&&support.subjectId!==subjectId)finding(findings,'SUBJECT_MISMATCH');
 if(typeof support.availableAt!=='string'||!support.availableAt)finding(findings,'AVAILABILITY_MISSING');
 else if(asOf){
  if(timeMode==='replay'&&support.availableAt>asOf)finding(findings,'TEMPORAL_INVALID');
  if(!['replay','audit'].includes(timeMode))finding(findings,'TEMPORAL_INVALID');
 }
 if(typeof support.supportHash!=='string'||supportHash(support)!==support.supportHash)finding(findings,'SUPPORT_HASH_MISMATCH');
 if(findings.length)return {valid:false,findings,document};
 if(support.type==='text'){
  const sentence=sentenceIndex.get(support.spanId);
  if(!sentence){finding(findings,'SPAN_UNKNOWN');return {valid:false,findings,document};}
  const verdict=sentenceIndex.verify(support.spanId);
  if(!verdict.valid){return {valid:false,findings:['SPAN_INVALID',verdict.reason],document};}
  if(sentence.parentSpanId!==support.parentSpanId)finding(findings,'TEXT_PARENT_MISMATCH');
  if(sentence.page!==support.page)finding(findings,'TEXT_PAGE_MISMATCH');
  if(sentence.section!==support.section)finding(findings,'TEXT_SECTION_MISMATCH');
  if(sentence.text!==support.text)finding(findings,'TEXT_MISMATCH');
  if(digest(support.text)!==support.textHash)finding(findings,'TEXT_HASH_MISMATCH');
  if(sentence.charStart!==support.charStart||sentence.charEnd!==support.charEnd)finding(findings,'TEXT_OFFSET_MISMATCH');
  if(sentence.documentCharStart!==support.documentCharStart||sentence.documentCharEnd!==support.documentCharEnd)finding(findings,'TEXT_OFFSET_MISMATCH');
  if(sentence.locator.lineStart!==support.lineStart||sentence.locator.lineEnd!==support.lineEnd)finding(findings,'TEXT_LINE_MISMATCH');
  if(sentence.parserVersion!==support.parserVersion||sentence.groundingVersion!==support.groundingVersion)finding(findings,'VERSION_MISMATCH');
  if(support.groundingVersion!==groundingVersion)finding(findings,'VERSION_MISMATCH');
  if(support.segmentationVersion!==segmentationVersion)finding(findings,'VERSION_MISMATCH');
  if(sentence.contentHash!==support.spanHash)finding(findings,'SPAN_HASH_MISMATCH');
  return {valid:!findings.length,findings,document,sentence};
 }
 const span=registry.get(support.spanId);
 if(!span){finding(findings,'SPAN_UNKNOWN');return {valid:false,findings,document};}
 if(span.spanType!=='table'){finding(findings,'SPAN_TYPE_MISMATCH');return {valid:false,findings,document};}
 const verdict=registry.verify(support.spanId);
 if(!verdict.valid){return {valid:false,findings:['SPAN_INVALID',verdict.reason],document};}
 const table=tableIndex.get(support.tableId);
 if(!table){finding(findings,'TABLE_UNKNOWN');return {valid:false,findings,document};}
 if(support.tableId!==tableIdOfSpan(span))finding(findings,'TABLE_ID_MISMATCH');
 if(!tableIndex.hasRow(support.tableId,support.rowIndex))finding(findings,'TABLE_ROW_MISSING');
 if(!tableIndex.hasColumn(support.tableId,support.columnIndex))finding(findings,'TABLE_COLUMN_MISSING');
 const cell=tableIndex.cell(support.tableId,support.rowIndex,support.columnIndex);
 if(!cell||cell.id!==span.id)finding(findings,'TABLE_CELL_UNKNOWN');
 if((span.rowLabel??'')!==support.rowLabel)finding(findings,'TABLE_ROW_LABEL_MISMATCH');
 if(!sameJson(span.headerPath,support.headerPath))finding(findings,'TABLE_HEADER_PATH_MISMATCH');
 if((span.headerPath.at(-1)??'')!==support.columnLabel)finding(findings,'TABLE_COLUMN_LABEL_MISMATCH');
 if(span.cellText!==support.cellText)finding(findings,'TABLE_CELL_MISMATCH');
 if(digest(support.cellText)!==support.cellHash)finding(findings,'TABLE_CELL_HASH_MISMATCH');
 const unitView=span.unitContext?{match:span.unitContext.match,scale:span.unitContext.scale,currency:span.unitContext.currency,captionText:span.unitContext.captionText}:null;
 if(!sameJson(unitView,support.unitContext))finding(findings,'TABLE_UNIT_CONTEXT_MISMATCH');
 if(span.page!==support.page)finding(findings,'TABLE_PAGE_MISMATCH');
 if((table.caption??null)!==support.tableTitle)finding(findings,'TABLE_TITLE_MISMATCH');
 if(spanHash(span)!==support.spanHash||span.contentHash!==support.spanHash)finding(findings,'SPAN_HASH_MISMATCH');
 if(span.parserVersion!==support.parserVersion||span.groundingVersion!==support.groundingVersion)finding(findings,'VERSION_MISMATCH');
 return {valid:!findings.length,findings,document,span,table};
}

export function validateFactV2(support,fact){
 const findings=[];
 if(!fact||typeof fact!=='object')return {status:'rejected',findings:['INTERPRETATION_MISSING'],parse:{numeric:null,period:null}};
 if(fact.explicitOrDerived!=='explicit')finding(findings,'DERIVED_NOT_ADMISSIBLE');
 if(forbiddenJudgment.test(String(fact.metric??'')))finding(findings,'FORBIDDEN_JUDGMENT');
 if(support.type==='table'){
  const numeric=parseTableValue(support),period=parseTablePeriod(support);
  if(numeric.status!=='known')finding(findings,'DETERMINISTIC_PARSE_UNSUPPORTED');
  if(period.status!=='known')finding(findings,'DETERMINISTIC_PARSE_UNSUPPORTED');
  const cueSource=(support.cellText??'')+' '+(support.rowLabel??'');
  if(GUIDANCE_CUE.test(cueSource)&&fact.actualOrGuidance!=='guidance')finding(findings,'ACTUAL_GUIDANCE_ERROR');
  if(fact.actualOrGuidance==='guidance'&&fact.metricOrCategory!=='guidance')finding(findings,'ACTUAL_GUIDANCE_ERROR');
  if(fact.actualOrGuidance==='risk_disclosure'&&numeric.status==='known')finding(findings,'ACTUAL_GUIDANCE_ERROR');
  return {status:findings.length?'rejected':'validated',findings,parse:{numeric,period}};
 }
 const text=normalizeSpace(support.text);
 const value=fact.rawValueText===null||fact.rawValueText===undefined?null:normalizeSpace(fact.rawValueText);
 const unit=fact.rawUnitText===null||fact.rawUnitText===undefined?null:normalizeSpace(fact.rawUnitText);
 const periodText=fact.periodText===null||fact.periodText===undefined?null:normalizeSpace(fact.periodText);
 if(value!==null&&!text.includes(value))finding(findings,'VALUE_ERROR');
 if(unit!==null&&!text.includes(unit))finding(findings,'UNIT_ERROR');
 if(periodText!==null&&!text.includes(periodText))finding(findings,'PERIOD_ERROR');
 const numeric=value===null?{status:'unsupported',reason:'value_missing'}:parseNumeric(value,unit,{quote:text});
 const period=periodText===null?{status:'unknown',reason:'period_missing'}:periodWithSourceContext(text,periodText);
 if(numeric.status!=='known')finding(findings,'DETERMINISTIC_PARSE_UNSUPPORTED');
 if(period.status!=='known')finding(findings,'DETERMINISTIC_PARSE_UNSUPPORTED');
 if(value!==null){
  const window=assertionWindow(text,value);
  const cue=!!window&&(GUIDANCE_CUE.test(window.before)||GUIDANCE_CUE.test(window.after));
  if(cue&&fact.actualOrGuidance!=='guidance')finding(findings,'ACTUAL_GUIDANCE_ERROR');
 }
 if(fact.actualOrGuidance==='guidance'&&fact.metricOrCategory!=='guidance')finding(findings,'ACTUAL_GUIDANCE_ERROR');
 if(fact.actualOrGuidance==='risk_disclosure'&&numeric.status==='known')finding(findings,'ACTUAL_GUIDANCE_ERROR');
 return {status:findings.length?'rejected':'validated',findings,parse:{numeric,period}};
}
