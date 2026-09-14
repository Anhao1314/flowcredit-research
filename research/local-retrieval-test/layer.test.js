import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {SpanRetrievalLayer,filterVisibleSupports,defaultRetrievalLimit} from '../local-retrieval/layer.js';
import {localEmbeddingProvider} from '../local-retrieval/provider.js';
import {SpanEmbeddingIndex,spanEmbeddingId,spanIndexVersion} from '../local-retrieval/index.js';
import {spanRenderVersion,retrievalText} from '../local-retrieval/render.js';
import {supportCandidates} from '../evidence-support/layer.js';
import {fixture} from '../evidence-support-test/fixtures.js';

const dimension=8;
function embedText(text){
 const vector=new Array(dimension).fill(0);
 for(const token of String(text).toLowerCase().match(/[a-z0-9]+/g)??[])if(token.length>2)vector[token.length%dimension]+=1;
 const norm=Math.hypot(...vector)||1;
 return vector.map(value=>Number((value/norm).toFixed(6)));
}
async function fakeEmbeddingRuntime(){
 const server=createServer((request,response)=>{
  const chunks=[];
  request.on('data',chunk=>chunks.push(chunk));
  request.on('end',()=>{
   const send=value=>{response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(value));};
   if(request.url==='/api/version')return send({version:'fixture-runtime/1'});
   if(request.url==='/api/tags')return send({models:[{name:'fixture-embed',model:'fixture-embed',digest:'sha256:'+'e'.repeat(64),size:1,details:{family:'fixture',parameter_size:'1M',quantization_level:'F16',embedding_length:dimension,format:'gguf'}}]});
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   send({model:body.model,embeddings:body.input.map(embedText),prompt_eval_count:body.input.length,total_duration:1000});
  });
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 return {endpoint:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(done=>server.close(done))};
}
async function indexedWorkspace(folder,workspace,runtime){
 const provider=localEmbeddingProvider({endpoint:runtime.endpoint,model:'fixture-embed'});
 await provider.preflight();
 const index=new SpanEmbeddingIndex(join(folder,'span-index.sqlite'));
 const supports=supportCandidates(workspace.sentences,workspace.tables,{documentId:workspace.built.document.id,page:1});
 const vectors=await provider.embedMany(supports.map(retrievalText));
 for(const [position,support] of supports.entries()){
  const identity={spanId:support.spanId,spanHash:support.spanHash,rendererVersion:spanRenderVersion,embeddingModel:provider.metadata.model,embeddingModelDigest:provider.metadata.modelVersion,indexVersion:spanIndexVersion};
  index.put({id:spanEmbeddingId(identity),...identity,documentId:support.documentId,subjectId:support.subjectId,sourceId:support.sourceId,page:support.page,dimension:provider.metadata.dimension,vector:vectors[position],sourceHash:support.supportHash,createdAt:'2026-09-14T00:00:00.000Z'});
 }
 return {provider,index,supports};
}
test('retrieval narrows a page to a bounded Top-K with a deterministic receipt',async()=>fixture(async({folder,workspace})=>{
 const runtime=await fakeEmbeddingRuntime();
 try{
  const {provider,index,supports}=await indexedWorkspace(folder,workspace,runtime);
  const layer=new SpanRetrievalLayer({provider,index,limit:3,clock:()=>'2026-09-14T00:00:00.000Z'});
  const outcome=await layer.retrieve({supports,query:'revenue from customers in Europe',subjectId:'synthetic',asOf:'2026-09-14',timeMode:'replay',caseId:'T-1'});
  assert.equal(outcome.candidateCount,supports.length);
  assert.ok(outcome.results.length<=3);
  assert.deepEqual(outcome.results.map(row=>row.finalRank),[1,2,3]);
  const repeat=await layer.retrieve({supports,query:'revenue from customers in Europe',subjectId:'synthetic',asOf:'2026-09-14',timeMode:'replay',caseId:'T-1'});
  assert.deepEqual(repeat.results,outcome.results);
  assert.equal(outcome.receipt.version,'span-hybrid-retrieval/v1');
  assert.ok(outcome.receipt.latencyMs.total>=0);
  assert.equal(outcome.receipt.abstained,false);
  index.close();
 }finally{await runtime.close();}
}));
test('subject isolation and temporal filtering run before ranking and are reported',async()=>{
 const supports=[
  {spanId:'SPAN-a',spanHash:'sha256:a',type:'text',subjectId:'coreweave',page:1,text:'Revenue from the United States was 4,801 million.',availableAt:'2026-01-01T00:00:00Z',supportHash:'sha256:sa'},
  {spanId:'SPAN-b',spanHash:'sha256:b',type:'text',subjectId:'other-company',page:1,text:'Revenue from the United States was 4,801 million.',availableAt:'2026-01-01T00:00:00Z',supportHash:'sha256:sb'},
  {spanId:'SPAN-c',spanHash:'sha256:c',type:'text',subjectId:'coreweave',page:1,text:'Revenue from the United States was 4,801 million.',availableAt:'2026-12-31T00:00:00Z',supportHash:'sha256:sc'}
 ];
 const filtered=filterVisibleSupports({supports,subjectId:'coreweave',asOf:'2026-09-14T00:00:00.000Z',timeMode:'replay'});
 assert.deepEqual(filtered.visible.map(support=>support.spanId),['SPAN-a']);
 assert.deepEqual(filtered.wrongSubject,['SPAN-b']);
 assert.deepEqual(filtered.future,['SPAN-c']);
 const layer=new SpanRetrievalLayer({limit:5,mode:'lexical'});
 const outcome=await layer.retrieve({supports,query:'revenue from the United States',subjectId:'coreweave',asOf:'2026-09-14T00:00:00.000Z',timeMode:'replay'});
 assert.deepEqual(outcome.results.map(row=>row.spanId),['SPAN-a']);
 assert.deepEqual(outcome.filtered,{wrongSubject:1,future:1,unavailable:0});
 assert.equal(outcome.results.every(row=>row.subjectId==='coreweave'),true);
});
test('support fields outside the visible set are never returned',async()=>{
 const supports=[{spanId:'SPAN-a',spanHash:'sha256:a',type:'text',subjectId:'coreweave',page:1,text:'Revenue was 4,801 million.',availableAt:'2026-01-01T00:00:00Z',supportHash:'sha256:sa'}];
 for(const timeMode of ['replay','audit']){
  const outcome=await new SpanRetrievalLayer({limit:5,mode:'lexical'}).retrieve({supports,query:'revenue',subjectId:'coreweave',asOf:'2026-09-14T00:00:00.000Z',timeMode});
  assert.equal(outcome.results.length,1);
 }
 await assert.rejects(new SpanRetrievalLayer({limit:5,mode:'lexical'}).retrieve({supports,query:'revenue',subjectId:'coreweave',asOf:'2026-09-14',timeMode:'nonsense'}),/Unknown temporal mode/);
});
test('an empty visible set is an explicit abstention instead of a guess',async()=>{
 const supports=[{spanId:'SPAN-c',spanHash:'sha256:c',type:'text',subjectId:'coreweave',page:1,text:'Revenue was 4,801 million.',availableAt:'2026-12-31T00:00:00Z',supportHash:'sha256:sc'}];
 const outcome=await new SpanRetrievalLayer({limit:5,mode:'lexical'}).retrieve({supports,query:'revenue',subjectId:'coreweave',asOf:'2026-09-14T00:00:00.000Z',timeMode:'replay'});
 assert.equal(outcome.abstained,true);
 assert.equal(outcome.abstainReason,'NO_VISIBLE_SPAN');
 assert.deepEqual(outcome.results,[]);
 assert.equal(defaultRetrievalLimit,10);
});
test('semantic mode requires a real embedding runtime instead of degrading silently',async()=>{
 assert.throws(()=>new SpanRetrievalLayer({mode:'semantic',limit:5}),/SEMANTIC_RETRIEVAL_UNAVAILABLE/);
 assert.throws(()=>new SpanRetrievalLayer({mode:'hybrid',limit:5}),/SEMANTIC_RETRIEVAL_UNAVAILABLE/);
 assert.throws(()=>new SpanRetrievalLayer({limit:0}),/Retrieval limit must be 1\.\.40/);
});
