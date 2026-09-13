import {digest} from '../src/identity.js';
import {groundingVersion} from './grounding.js';

export function spanHash(span){
 const {id,contentHash,...payload}=span;
 return digest({...payload,createdAt:undefined});
}

export class SpanRegistry {
 #documents;#spans;#byId;#byDocument;#byPage;
 constructor({documents=[],spans=[]}){
  this.#documents=new Map(documents.map(document=>[document.id,document]));
  this.#spans=spans;this.#byId=new Map();this.#byDocument=new Map();this.#byPage=new Map();
  for(const span of spans){
   if(this.#byId.has(span.id))throw new Error('Duplicate span id: '+span.id);
   if(!this.#documents.has(span.documentId))throw new Error('Span without grounded document: '+span.id);
   if(span.groundingVersion!==groundingVersion)throw new Error('Grounding version drift');
   this.#byId.set(span.id,span);
   const list=this.#byDocument.get(span.documentId)??[];list.push(span);this.#byDocument.set(span.documentId,list);
   const key=span.documentId+'#'+span.page;
   const page=this.#byPage.get(key)??[];page.push(span);this.#byPage.set(key,page);
  }
  for(const list of this.#byDocument.values())list.sort((a,b)=>a.page-b.page||a.id.localeCompare(b.id));
 }
 get documents(){return [...this.#documents.values()];}
 document(id){return this.#documents.get(id)??null;}
 get(spanId){return this.#byId.get(spanId)??null;}
 list({sourceId=null,documentId=null,spanType=null,page=null}={}){
  const base=documentId?this.#byDocument.get(documentId)??[]:this.#spans;
  return base.filter(span=>(sourceId===null||span.sourceId===sourceId)&&(spanType===null||span.spanType===spanType)&&(page===null||span.page===page));
 }
 findSpansByPage(documentId,page){return this.#byPage.get(documentId+'#'+page)??[];}
 verify(spanId){
  const span=this.#byId.get(spanId);
  if(!span)return {valid:false,reason:'SPAN_UNKNOWN'};
  const document=this.#documents.get(span.documentId);
  if(!document)return {valid:false,reason:'DOCUMENT_UNKNOWN'};
  if(document.sourceId!==span.sourceId||document.subjectId!==span.subjectId)return {valid:false,reason:'IDENTITY_MISMATCH'};
  if(!Number.isInteger(span.page)||span.page<document.firstPage||span.page>document.pageCount)return {valid:false,reason:'PAGE_OUT_OF_RANGE'};
  if(typeof document.contentHash!=='string'||!document.contentHash.startsWith('sha256:'))return {valid:false,reason:'SOURCE_HASH_MISSING'};
  if(span.sourceId!==document.sourceId||span.documentId!==document.id)return {valid:false,reason:'IDENTITY_MISMATCH'};
  if(typeof document.textHash!=='string'||digest(document.text)!==document.textHash)return {valid:false,reason:'SOURCE_HASH_MISMATCH'};
  if(spanHash(span)!==span.contentHash)return {valid:false,reason:'CONTENT_HASH_MISMATCH'};
  if(span.spanType!=='text'&&span.spanType!=='table')return {valid:false,reason:'SPAN_TYPE_UNSUPPORTED'};
  return {valid:true,span,document};
 }
}
