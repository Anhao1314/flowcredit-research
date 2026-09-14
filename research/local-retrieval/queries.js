import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {queries as coreweaveQueries} from '../retrieval/eval.js';
import {supportCandidates} from '../evidence-support/layer.js';
import {annotateCase} from '../evidence-support/gold.js';

// Retrieval queries come from the research question, never from the answer. A
// question may name the subject, the period and the metric family that the
// research plan asked for; the expected value, its unit, the expected location
// and the expected span text are excluded by construction and asserted below.
export const retrievalQueryVersion='span-retrieval-query/v1';
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function periodLabel({periodStart=null,periodEnd=null,observedAt=null}={}){
 const end=periodEnd??observedAt;
 if(!end)return 'undated';
 const [year,month,day]=end.split('-').map(Number);
 if(periodStart){
  const [startYear,startMonth,startDay]=periodStart.split('-').map(Number);
  if(startMonth===1&&startDay===1&&month===12&&day===31&&startYear===year)return 'FY'+year;
  if(startDay===1&&startMonth===month-2&&[3,6,9,12].includes(month))return 'Q'+(month/3)+' '+year;
  if(startYear===year&&startMonth===month)return monthNames[month-1]+' '+year;
 }
 return end;
}
export function phraseOf(term){return String(term??'').replace(/_/g,' ').replace(/\s+/g,' ').trim().toLowerCase();}
export function questionOf({expected,subjectDisplay='CoreWeave'}){
 const parts=[subjectDisplay,periodLabel(expected),phraseOf(expected.metric),phraseOf(expected.category)];
 const seen=new Set(),words=[];
 for(const part of parts)for(const word of String(part).split(' ')){
  const key=word.toLowerCase();
  if(!word||seen.has(key))continue;
  seen.add(key);words.push(word);
 }
 return words.join(' ');
}
export function answerTermsOf({expected}){
 const terms=[String(expected.rawValue),Number(expected.rawValue).toLocaleString('en-US')];
 if(Number.isFinite(expected.normalizedValue))terms.push(String(expected.normalizedValue));
 if(expected.rawUnit)terms.push(phraseOf(expected.rawUnit));
 return [...new Set(terms)];
}
// A leaked answer is the expected value appearing in the question as a standalone
// number. Boundary-aware matching keeps fiscal years (`FY2025`) and quarters
// (`Q2 2026`) from being misread as values such as 2025 or 26.
function leakPattern(term){return new RegExp('(?:^|[^\\p{L}\\p{N}])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:[^\\p{L}\\p{N}]|$)','u');}
export function assertQuestionHasNoAnswer(question,{expected}){
 for(const term of answerTermsOf({expected})){
  if(!/\d/.test(term))continue;
  if(leakPattern(term).test(question))throw new Error('RETRIEVAL_QUERY_LEAKS_ANSWER: '+term);
 }
 return true;
}
export function lockedRetrievalCases({registry,sentences,cases,annotation}){
 return cases.map(entry=>{
  const gold=annotation.cases.find(item=>item.caseId===entry.caseId);
  const question=questionOf({expected:entry.expected});
  assertQuestionHasNoAnswer(question,{expected:entry.expected});
  return {caseId:entry.caseId,kind:'gold',documentId:entry.documentId,page:entry.page,subjectId:registry.document(entry.documentId).subjectId,question,expectedSpanIds:gold.expectedSpanIds,expectedSupportType:gold.expectedSupportType,rawValue:entry.expected.rawValue};
 });
}
function normalize(text){return String(text).replace(/\s+/g,' ').trim();}
// The v0.3 dev queries carry their expected literal. The answer-free variant
// removes every numeric token so the same topics exercise the question class the
// locked set uses, which is what the development Top-K sweep must be based on.
export function answerFreeOf(question){return normalize(question.replace(/[\d][\d,.]*%?/g,' ').replace(/\s+/g,' '));}
export function coreweaveSpanQueries({registry,index,sentences,tables}){
 const documents=new Map(registry.documents.map(document=>[document.sourceId,document]));
 return coreweaveQueries.map(item=>{
  const expectedByDocument=new Map();
  for(const expected of item.expected){
   const document=documents.get(expected.sourceId);
   if(!document)throw new Error('Retrieval corpus document missing for '+item.id);
   const supports=supportCandidates(sentences,tables,{documentId:document.id,page:expected.page});
   const literal=expected.textIncludes?normalize(expected.textIncludes):null;
   let matched=literal?supports.filter(support=>normalize(JSON.stringify(support)).includes(literal)||normalize(support.type==='text'?support.text:support.cellText).includes(literal)):[];
   const pageFallback=matched.length===0;
   if(pageFallback)matched=supports;
   expectedByDocument.set(document.id,(expectedByDocument.get(document.id)??[]).concat(matched.map(support=>support.spanId)));
   expectedByDocument.set(document.id+':fallback',pageFallback);
  }
  const expectedSpanIds=[...new Set([...expectedByDocument.entries()].filter(([key])=>!key.endsWith(':fallback')).flatMap(([,value])=>value))];
  return {caseId:item.id,kind:'coreweave-v0.3',answerFreeQuestion:answerFreeOf(item.query),documentId:documents.get(item.expected[0]?.sourceId)?.id??null,page:item.expected[0]?.page??null,subjectId:item.subjectId,question:item.query,expectedSpanIds,expectedSupportType:null,fallback:[...expectedByDocument.entries()].some(([key,value])=>key.endsWith(':fallback')&&value===true),category:item.category,chunkIds:item.expectedEvidenceIds??[]};
 });
}
// Deterministic negatives: questions whose period cannot exist in the corpus. Each
// one is proven absent with the same gold annotator the positives use, so an
// abstention claim is never taken on faith.
export function negativeRetrievalCases({registry,sentences,tables,cases,annotation},{years=[2020],limit=6}={}){
 const negatives=[];
 for(const entry of cases){
  const gold=annotation.cases.find(item=>item.caseId===entry.caseId);
  if(!gold||!gold.expectedSpanIds.length)continue;
  for(const year of years){
   if(negatives.length>=limit)break;
   const shifted={...entry.expected,periodStart:entry.expected.periodStart?year+entry.expected.periodStart.slice(4):null,periodEnd:year+String(entry.expected.periodEnd??entry.expected.observedAt).slice(4),observedAt:year+String(entry.expected.observedAt??entry.expected.periodEnd).slice(4)};
   const absent=annotateCase(registry,sentences,{caseId:'NEG-'+entry.caseId+'-'+year,documentId:entry.documentId,page:entry.page,expected:shifted,legacyBinding:entry.legacyBinding});
   if(absent.expectedSpanIds.length)continue;
   const question=questionOf({expected:shifted});
   negatives.push({caseId:'NEG-'+entry.caseId+'-'+year,kind:'negative',documentId:entry.documentId,page:entry.page,subjectId:registry.document(entry.documentId).subjectId,question,expectedSpanIds:[],expectedSupportType:null,absenceBasis:`no ${shifted.category} span on page ${entry.page} satisfies period ${shifted.periodEnd}`,coveredCase:entry.caseId,answerTerms:answerTermsOf({expected:shifted})});
  }
 }
 return negatives;
}
export function questionHash(question){return digest(question);}
export function readCoreweaveQueries(){return JSON.parse(readFileSync(new URL('../eval/coreweave/queries.json',import.meta.url),'utf8'));}
