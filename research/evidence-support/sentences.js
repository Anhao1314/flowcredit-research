import {digest,stableId} from '../src/identity.js';
import {groundingVersion} from '../grounding/grounding.js';

// Deterministic sentence segmentation over verified block TextSpans.
// No LLM segmentation, no text manufacture: every sentence is an exact
// whitespace-preserving slice of its parent block, with whole-block fallback
// when a boundary cannot be established reliably.
export const segmentationVersion='sentence-segmentation/v1';
export const sentenceGroundingVersion='sentence-span-index/v1';

const NEVER_SPLIT=new Set(['u.s','u.k','no','vs','etc','st','mr','ms','mrs','dr','jr','sr','approx','dept','est','fig','e.g','i.e']);
const SPLIT_IF_UPPER=new Set(['inc','llc','ltd','co','corp','opco','plc','gmbh']);
const CLOSERS=new Set(['"',"'",'”','’',')',']']);

function wordBefore(text,index){
 let start=index;
 while(start>0&&/[A-Za-z.]/.test(text[start-1]))start--;
 return text.slice(start,index).toLowerCase().replace(/\.+$/,'');
}
function nextSignal(text,index){
 let cursor=index;
 while(cursor<text.length&&/\s/.test(text[cursor]))cursor++;
 if(cursor>=text.length)return {atEnd:true};
 return {atEnd:false,char:text[cursor],whitespace:cursor>index};
}
function isBoundary(text,index){
 const next=nextSignal(text,index);
 if(next.atEnd)return true;
 if(!next.whitespace)return false;
 const previous=text[index-1];
 if(/[0-9]/.test(previous)&&/^[0-9]/.test(next.char))return false; // decimals like $1.21
 const word=wordBefore(text,index);
 if(NEVER_SPLIT.has(word))return false;
 if(SPLIT_IF_UPPER.has(word))return /[A-Z0-9"“(]/.test(next.char);
 return /[A-Z0-9"“(]/.test(next.char);
}
export function segmentSentences(blockText){
 if(typeof blockText!=='string'||!blockText.length)return [];
 const cuts=[];let depth=0;
 for(let index=0;index<blockText.length;index++){
  const char=blockText[index];
  if(char==='('||char==='[')depth++;
  else if(char===')'||char===']')depth=Math.max(0,depth-1);
  else if((char==='.'||char==='!'||char==='?')&&depth===0){
   let end=index+1;
   while(end<blockText.length&&(blockText[end]==='.'||blockText[end]==='!'||blockText[end]==='?'||CLOSERS.has(blockText[end])))end++;
   if(isBoundary(blockText,end)){cuts.push(end);index=end-1;}
  }
 }
 const sentences=[];
 let start=0;
 for(const cut of [...cuts,blockText.length]){
  if(cut<=start)continue;
  sentences.push({text:blockText.slice(start,cut),charStart:start,charEnd:cut});
  start=cut;
 }
 if(!sentences.length)sentences.push({text:blockText,charStart:0,charEnd:blockText.length});
 return sentences;
}
function sentenceId({parentSpanId,charStart,charEnd,text}){
 return stableId('SPAN',{kind:'sentence',parentSpanId,charStart,charEnd,textHash:digest(text)});
}
export function sentenceSpansFor(parent){
 if(parent.spanType!=='text')throw new Error('Sentence spans are derived from text spans only');
 const spans=[];
 for(const sentence of segmentSentences(parent.text)){
  const before=parent.text.slice(0,sentence.charStart);
  const lineStart=parent.locator.lineStart+before.split('\n').length-1;
  const lineEnd=lineStart+sentence.text.split('\n').length-1;
  const payload={spanType:'sentence',parentSpanId:parent.id,subjectId:parent.subjectId,sourceId:parent.sourceId,documentId:parent.documentId,page:parent.page,section:parent.section,locator:{type:'pdf_sentence',page:parent.page,parentBlockIndex:parent.locator.blockIndex,lineStart,lineEnd,bbox:parent.locator.bbox},charStart:sentence.charStart,charEnd:sentence.charEnd,documentCharStart:parent.charStart+sentence.charStart,documentCharEnd:parent.charStart+sentence.charEnd,text:sentence.text,parserVersion:parent.parserVersion,groundingVersion:parent.groundingVersion,segmentationVersion,availableAt:parent.availableAt,rendererVersion:null};
  const contentHash=digest({...payload,createdAt:undefined});
  spans.push(Object.freeze({id:sentenceId({parentSpanId:parent.id,...sentence}),...payload,contentHash}));
 }
 return spans;
}
export function spanHash(span){
 const {id,contentHash,...payload}=span;
 return digest({...payload,createdAt:undefined});
}

export class SentenceSpanIndex {
 #registry;#byId;#byParent;#byDocument;
 constructor(registry){
  this.#registry=registry;this.#byId=new Map();this.#byParent=new Map();this.#byDocument=new Map();
  for(const span of registry.list({spanType:'text'})){
   for(const sentence of sentenceSpansFor(span)){
    if(this.#byId.has(sentence.id))throw new Error('Duplicate sentence id: '+sentence.id);
    this.#byId.set(sentence.id,sentence);
    const parent=this.#byParent.get(span.id)??[];parent.push(sentence);this.#byParent.set(span.id,parent);
    const list=this.#byDocument.get(span.documentId)??[];list.push(sentence);this.#byDocument.set(span.documentId,list);
   }
  }
 }
 get(id){return this.#byId.get(id)??null;}
 list({documentId=null,page=null}={}){
  const base=documentId?this.#byDocument.get(documentId)??[]:[...this.#byId.values()];
  return base.filter(span=>page===null||span.page===page);
 }
 sentencesOf(parentSpanId){return this.#byParent.get(parentSpanId)??[];}
 verify(id){
  const sentence=this.#byId.get(id);
  if(!sentence)return {valid:false,reason:'SENTENCE_UNKNOWN'};
  const parent=this.#registry.get(sentence.parentSpanId);
  if(!parent)return {valid:false,reason:'PARENT_SPAN_UNKNOWN'};
  if(parent.spanType!=='text')return {valid:false,reason:'PARENT_SPAN_TYPE'};
  const verdict=this.#registry.verify(parent.id);
  if(!verdict.valid)return {valid:false,reason:'PARENT_SPAN_INVALID',detail:verdict.reason};
  const document=verdict.document;
  if(sentence.segmentationVersion!==segmentationVersion)return {valid:false,reason:'SEGMENTATION_VERSION_DRIFT'};
  if(sentence.groundingVersion!==groundingVersion)return {valid:false,reason:'GROUNDING_VERSION_DRIFT'};
  if(sentence.documentId!==parent.documentId||sentence.sourceId!==parent.sourceId||sentence.subjectId!==parent.subjectId)return {valid:false,reason:'IDENTITY_MISMATCH'};
  if(!Number.isInteger(sentence.charStart)||!Number.isInteger(sentence.charEnd)||sentence.charStart<0||sentence.charEnd<=sentence.charStart||sentence.charEnd>parent.text.length)return {valid:false,reason:'OFFSET_OUT_OF_RANGE'};
  if(parent.text.slice(sentence.charStart,sentence.charEnd)!==sentence.text)return {valid:false,reason:'PARENT_SLICE_MISMATCH'};
  if(sentence.documentCharStart!==parent.charStart+sentence.charStart||sentence.documentCharEnd!==parent.charStart+sentence.charEnd)return {valid:false,reason:'DOCUMENT_OFFSET_MISMATCH'};
  if(document.text.slice(sentence.documentCharStart,sentence.documentCharEnd)!==sentence.text)return {valid:false,reason:'DOCUMENT_SLICE_MISMATCH'};
  if(digest(document.text)!==document.textHash)return {valid:false,reason:'SOURCE_HASH_MISMATCH'};
  if(spanHash(sentence)!==sentence.contentHash)return {valid:false,reason:'CONTENT_HASH_MISMATCH'};
  return {valid:true,sentence,parent,document};
 }
}
