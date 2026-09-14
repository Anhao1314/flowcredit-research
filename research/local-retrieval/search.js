import {cosine} from '../retrieval/semantic.js';
import {rrfK} from '../retrieval/fusion.js';

// Semantic ranking and fusion. The v0.3 embedding provider contract is
// synchronous by construction (`embed(text)`), so the loopback runtime is used
// where the contract allows it: vectors are produced once at index build time
// (async batch) and stored, and ranking is a pure synchronous cosine over stored
// vectors with the audited v0.3 similarity floor.
export const spanSemanticVersion='span-semantic/v1';
export const spanFusionVersion='span-rrf/v1';
export const defaultMinSimilarity=0.3;
export {rrfK};
export function rankSpansSemantic({rows,queryVector,index,metadata,limit=10,minSimilarity=defaultMinSimilarity}){
 const scored=[];
 let missing=0,stale=0;
 for(const row of rows){
  const record=index.get(row.spanId,row.spanHash);
  if(!record){missing+=1;continue;}
  if(record.spanHash!==row.spanHash){stale+=1;continue;}
  if(record.embeddingModel!==metadata.model||record.embeddingModelDigest!==metadata.modelVersion||record.dimension!==metadata.dimension){missing+=1;continue;}
  if(record.vector.length!==metadata.dimension)throw new Error('Embedding integrity mismatch');
  scored.push({spanId:row.spanId,score:cosine(queryVector,record.vector)});
 }
 return {rows:scored.filter(row=>row.score>=minSimilarity).sort((a,b)=>b.score-a.score||a.spanId.localeCompare(b.spanId)).slice(0,limit).map((row,index_)=>({...row,rank:index_+1})),missing,stale};
}
export function fuseSpanRankings(lexical,semantic,{limit=10,k=rrfK}={}){
 if(!Number.isFinite(k)||k<=0)throw new Error('RRF k must be positive');
 const map=new Map();
 for(const [method,rows] of [['lexical',lexical],['semantic',semantic]])for(const row of rows){
  if(!Number.isInteger(row.rank)||row.rank<1)throw new Error('Invalid retrieval rank');
  const value=map.get(row.spanId)??{spanId:row.spanId,lexicalRank:null,semanticRank:null,lexicalScore:null,semanticScore:null,hybridScore:0};
  if(value[method+'Rank']!==null)throw new Error('Duplicate fusion result');
  value[method+'Rank']=row.rank;
  if(method==='lexical')value.lexicalScore=row.score;else value.semanticScore=row.score;
  value.hybridScore+=1/(k+row.rank);map.set(row.spanId,value);
 }
 // Deterministic tie-break, frozen before the locked run: higher fused score,
 // then a lexical hit, then the stronger semantic score, then span id.
 return [...map.values()].sort((a,b)=>b.hybridScore-a.hybridScore||(a.lexicalRank??Number.POSITIVE_INFINITY)-(b.lexicalRank??Number.POSITIVE_INFINITY)||(b.semanticScore??-1)-(a.semanticScore??-1)||a.spanId.localeCompare(b.spanId)).slice(0,limit).map((row,index)=>({...row,finalRank:index+1}));
}
