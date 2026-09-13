import { digest,stableId } from '../src/identity.js';
import { tokenize } from './lexical.js';
export function validateProvider(provider) {
  const m=provider?.metadata;
  if(typeof provider?.embed!=='function' || !m?.provider || !m.model || !m.embeddingVersion || !Number.isInteger(m.dimension) || m.dimension<1 || !['real','test'].includes(m.kind))throw new Error('Invalid embedding provider metadata/interface');
  return m;
}
function vector(provider,text) {
  const values=provider.embed(text),m=validateProvider(provider);
  if(values?.then)throw new Error('Synchronous embedding provider required');
  if(!Array.isArray(values) || values.length!==m.dimension || values.some(v=>!Number.isFinite(v)))throw new Error('Invalid embedding dimension/values');
  return values;
}
export function cosine(a,b){const dot=a.reduce((n,x,i)=>n+x*b[i],0),norm=Math.hypot(...a)*Math.hypot(...b);return norm?dot/norm:0;}
export function searchSemantic(index,chunks,query,provider,{limit=5,minSimilarity=0.3}={}) {
  const metadata=validateProvider(provider),q=vector(provider,query),records=index.list('embedding').filter(e=>digest(e.metadata)===digest(metadata)),map=new Map(records.map(e=>[e.chunkId,e]));
  return chunks.map(chunk=>{
    const embedding=map.get(chunk.id);if(!embedding)return null;
    if(embedding.chunkHash!==chunk.contentHash || embedding.vector.length!==metadata.dimension || embedding.vector.some(v=>!Number.isFinite(v)))throw new Error('Embedding integrity mismatch');
    return {chunkId:chunk.id,score:cosine(q,embedding.vector)};
  }).filter(row=>row && row.score>=minSimilarity).sort((a,b)=>b.score-a.score || a.chunkId.localeCompare(b.chunkId)).slice(0,limit).map((row,i)=>({...row,rank:i+1}));
}
export function indexEmbeddings(index,provider) {
  const metadata=validateProvider(provider);let inserted=0;
  for(const chunk of index.list('chunk')) {
    const id=stableId('EMBED',{chunkId:chunk.id,chunkHash:chunk.contentHash,metadata});
    if(index.get('embedding',id))continue;
    index.putEmbedding({id,subjectId:chunk.subjectId,chunkId:chunk.id,chunkHash:chunk.contentHash,metadata,vector:vector(provider,chunk.text)});inserted++;
  }
  return {inserted,metadata};
}
// Test-only concept bags. Not a trained embedding and never a real benchmark.
export class DeterministicTestProvider {
  metadata={provider:'deterministic-fixture',model:'concept-bag',dimension:12,embeddingVersion:'test/v1',kind:'test'};
  embed(text) {
    const groups=[['revenue','sales'],['customer','client','concentration'],['debt','borrowing'],['cash','flow'],['capital','capex','purchases'],['rpo','obligations','backlog'],['liquidity','assets','liabilities'],['compute','infrastructure'],['founding','history'],['risk','sensitivity'],['controls','weaknesses'],['quantum','unicorn']];
    const words=new Set(tokenize(text));return groups.map(group=>group.filter(word=>words.has(word)).length);
  }
}
