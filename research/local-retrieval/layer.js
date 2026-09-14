import {digest} from '../src/identity.js';
import {instant} from '../memory/time.js';
import {cutoffVisible} from '../retrieval/layer.js';
import {retrievalText,spanRenderVersion} from './render.js';
import {searchSpansLexical} from './lexical.js';
import {rankSpansSemantic,fuseSpanRankings,spanSemanticVersion,spanFusionVersion,defaultMinSimilarity} from './search.js';
import {validateEmbeddingProvider} from './provider.js';
import {spanEmbeddingId,spanIndexVersion} from './index.js';

// Retrieval narrows the world in front of the unchanged Evidence Analyst: it
// orders the already verified SourceSupports of one (document, page) and returns
// a bounded Top-K. It never creates Evidence, never scores confidence and never
// changes what the deterministic validator accepts.
export const retrievalVersion='span-hybrid-retrieval/v1';
export const retrievalModes=['lexical','semantic','hybrid'];
export const defaultRetrievalLimit=10;
export const maxRetrievalLimit=40;

function temporalVisible(support,asOf,timeMode){
 if(!support.availableAt)return false;
 if(timeMode==='replay')return cutoffVisible({availableAt:support.availableAt},asOf,'replay');
 if(timeMode==='audit')return cutoffVisible({availableAt:support.availableAt,retrievedAt:support.availableAt,createdAt:support.availableAt},asOf,'audit');
 throw new Error('Unknown temporal mode');
}
export function filterVisibleSupports({supports,subjectId,asOf,timeMode='replay'}){
 const visible=[],wrongSubject=[],future=[],unavailable=[];
 for(const support of supports){
  if(support.subjectId!==subjectId){wrongSubject.push(support.spanId);continue;}
  if(!support.availableAt){unavailable.push(support.spanId);continue;}
  if(!temporalVisible(support,asOf,timeMode)){future.push(support.spanId);continue;}
  visible.push(support);
 }
 return {visible,wrongSubject,future,unavailable};
}
export class SpanRetrievalLayer {
 #provider;#index;#clock;#limit;#mode;#minSimilarity;
 constructor({provider=null,index=null,clock=()=>new Date().toISOString(),limit=defaultRetrievalLimit,mode='hybrid',minSimilarity=defaultMinSimilarity}={}){
  if(!Number.isInteger(limit)||limit<1||limit>maxRetrievalLimit)throw new Error('Retrieval limit must be 1..'+maxRetrievalLimit);
  if(!retrievalModes.includes(mode))throw new Error('Unknown retrieval mode');
  if(!Number.isFinite(minSimilarity)||minSimilarity<0||minSimilarity>1)throw new Error('Invalid similarity floor');
  if(provider)validateEmbeddingProvider(provider);
  if((mode==='semantic'||mode==='hybrid')&&(!provider||!index))throw new Error('SEMANTIC_RETRIEVAL_UNAVAILABLE');
  this.#provider=provider;this.#index=index;this.#clock=clock;this.#limit=limit;this.#mode=mode;this.#minSimilarity=minSimilarity;
 }
 get mode(){return this.#mode;}
 get limit(){return this.#limit;}
 async retrieve({supports,query,subjectId,asOf,timeMode='replay',caseId=null}={}){
  if(typeof query!=='string'||!query.trim()||query.length>2000)throw new Error('Retrieval query required');
  if(typeof subjectId!=='string'||!subjectId)throw new Error('Retrieval subject required');
  if(!['replay','audit'].includes(timeMode))throw new Error('Unknown temporal mode');
  if(!Array.isArray(supports)||!supports.length)throw new Error('NO_SPANS');
  const at=instant(asOf,{query:true}),started=performance.now();
  const {visible,wrongSubject,future,unavailable}=filterVisibleSupports({supports,subjectId,asOf:at,timeMode});
  const filteredAt=performance.now();
  if(!visible.length){
   return {query:query.trim(),queryHash:digest(query.trim()),mode:this.#mode,limit:this.#limit,candidateCount:supports.length,visibleCount:0,filtered:{wrongSubject:wrongSubject.length,future:future.length,unavailable:unavailable.length},results:[],supports:[],abstained:true,abstainReason:'NO_VISIBLE_SPAN',receipt:null,latencyMs:{filter:filteredAt-started,total:performance.now()-started}};
  }
  const rows=visible.map(support=>({spanId:support.spanId,spanHash:support.spanHash,text:retrievalText(support),support}));
  const bySpanId=new Map(rows.map(row=>[row.spanId,row]));
  const lexical=this.#mode==='semantic'?[]:searchSpansLexical(rows,query,{limit:Math.max(this.#limit,20)});
  const lexicalAt=performance.now();
  let semantic=[],semanticStatus='unavailable',missingEmbeddings=0,staleEmbeddings=0;
  if(this.#mode!=='lexical'){
   const metadata=validateEmbeddingProvider(this.#provider);
   const [queryVector]=await this.#provider.embedMany([query.trim()]);
   const ranked=rankSpansSemantic({rows:rows.map(({spanId,spanHash})=>({spanId,spanHash})),queryVector,index:this.#index,metadata,limit:Math.max(this.#limit,20),minSimilarity:this.#minSimilarity});
   semantic=ranked.rows;missingEmbeddings=ranked.missing;staleEmbeddings=ranked.stale;semanticStatus='available';
  }
  const semanticAt=performance.now();
  const fused=this.#mode==='hybrid'?fuseSpanRankings(lexical,semantic,{limit:this.#limit}):(this.#mode==='lexical'?lexical:semantic).slice(0,this.#limit).map((row,index)=>({...row,finalRank:index+1,lexicalRank:this.#mode==='lexical'?row.rank:null,semanticRank:this.#mode==='semantic'?row.rank:null}));
  const fusedAt=performance.now();
  for(const row of fused){
   const source=bySpanId.get(row.spanId);
   if(!source)throw new Error('Retrieval returned an unranked span');
   if(source.support.subjectId!==subjectId)throw new Error('WRONG_SUBJECT_RETRIEVAL');
   if(!temporalVisible(source.support,at,timeMode))throw new Error('FUTURE_LEAKAGE_RETRIEVAL');
  }
  const results=fused.map(row=>({spanId:row.spanId,subjectId:bySpanId.get(row.spanId).support.subjectId,page:bySpanId.get(row.spanId).support.page,type:bySpanId.get(row.spanId).support.type,finalRank:row.finalRank,lexicalRank:row.lexicalRank??null,semanticRank:row.semanticRank??null,lexicalScore:Number.isFinite(row.lexicalScore)?Number(row.lexicalScore.toFixed(6)):null,semanticScore:Number.isFinite(row.semanticScore)?Number(row.semanticScore.toFixed(6)):null,hybridScore:row.hybridScore?Number(row.hybridScore.toFixed(8)):null}));
  const receipt={version:retrievalVersion,mode:this.#mode,limit:this.#limit,caseId,query:query.trim(),queryHash:digest(query.trim()),rendererVersion:spanRenderVersion,semanticVersion:spanSemanticVersion,fusionVersion:spanFusionVersion,minSimilarity:this.#minSimilarity,candidateCount:supports.length,visibleCount:visible.length,filtered:{wrongSubject:wrongSubject.length,future:future.length,unavailable:unavailable.length},semanticStatus,missingEmbeddings,staleEmbeddings,results,abstained:results.length===0,abstainReason:results.length===0?'NO_CANDIDATE_ABOVE_FLOOR':null,latencyMs:{filter:filteredAt-started,lexical:lexicalAt-filteredAt,semantic:semanticAt-lexicalAt,fusion:fusedAt-semanticAt,total:fusedAt-started},createdAt:this.#clock()};
  return {query:receipt.query,queryHash:receipt.queryHash,mode:this.#mode,limit:this.#limit,candidateCount:supports.length,visibleCount:visible.length,filtered:receipt.filtered,results,supports:results.map(result=>bySpanId.get(result.spanId).support),abstained:receipt.abstained,abstainReason:receipt.abstainReason,receipt,latencyMs:receipt.latencyMs};
 }
}
export async function embedSupports({supports,provider,index,clock=()=>new Date().toISOString(),onBatch=null}={}){
 const metadata=validateEmbeddingProvider(provider);
 const records=[],texts=supports.map(support=>retrievalText(support));
 const vectors=await provider.embedMany(texts,{onBatch});
 for(const [position,support] of supports.entries()){
  const identity={spanId:support.spanId,spanHash:support.spanHash,rendererVersion:spanRenderVersion,embeddingModel:metadata.model,embeddingModelDigest:metadata.modelVersion,indexVersion:spanIndexVersion};
  const record={id:spanEmbeddingId(identity),...identity,documentId:support.documentId,subjectId:support.subjectId,sourceId:support.sourceId,page:support.page,dimension:metadata.dimension,vector:vectors[position],sourceHash:support.supportHash,createdAt:clock()};
  records.push(record);
 }
 return records;
}
export {retrievalText};
