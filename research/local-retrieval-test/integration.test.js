import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {SpanRetrievalLayer} from '../local-retrieval/layer.js';
import {localEmbeddingProvider} from '../local-retrieval/provider.js';
import {SpanEmbeddingIndex,spanEmbeddingId,spanIndexVersion} from '../local-retrieval/index.js';
import {spanRenderVersion,retrievalText} from '../local-retrieval/render.js';
import {EvidenceSupportAnalyst,supportCandidates} from '../evidence-support/layer.js';
import {SupportStore} from '../evidence-support/store.js';
import {parseSelection} from '../evidence-support/contract.js';
import {fixture} from '../evidence-support-test/fixtures.js';

const embeddingDimension=8;
const fixtureDigest='sha256:'+'c'.repeat(64);
const revenueFact={metricOrCategory:'revenue',metric:'consolidated_revenue',rawValueText:null,rawUnitText:null,periodText:null,actualOrGuidance:'actual',explicitOrDerived:'explicit'};
function embedText(text){
 const vector=new Array(embeddingDimension).fill(0);
 for(const token of String(text).toLowerCase().match(/[a-z0-9]+/g)??[])if(token.length>2)vector[token.length%embeddingDimension]+=1;
 const norm=Math.hypot(...vector)||1;
 return vector.map(value=>Number((value/norm).toFixed(6)));
}
// Both loops of the hybrid path run over real loopback HTTP against
// deterministic stand-ins: the same transports the real run uses, no Ollama, no
// weights and no external network in CI.
async function fakeRuntimes(selectSpanId){
 const selectionRequests=[];
 const server=createServer((request,response)=>{
  const chunks=[];
  request.on('data',chunk=>chunks.push(chunk));
  request.on('end',()=>{
   const send=value=>{response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(value));};
   if(request.url==='/api/version')return send({version:'fixture-runtime/1'});
   if(request.url==='/api/tags')return send({models:[{name:'fixture:tiny',model:'fixture:tiny',digest:fixtureDigest,size:1,details:{family:'fixture',parameter_size:'0.1B',quantization_level:'Q4_0',context_length:4096,embedding_length:embeddingDimension,format:'gguf'}},{name:'fixture-embed',model:'fixture-embed',digest:'sha256:'+'e'.repeat(64),size:1,details:{family:'fixture',parameter_size:'1M',quantization_level:'F16',embedding_length:embeddingDimension,format:'gguf'}}]});
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(request.url==='/api/embed')return send({model:body.model,embeddings:body.input.map(embedText),prompt_eval_count:body.input.length,total_duration:1000});
   if(request.url==='/api/chat'){
    const phase=/span-selection/.test(body.messages[0].content)?'selection':'interpretation';
    if(phase==='selection')selectionRequests.push(JSON.parse(body.messages[1].content));
    const content=phase==='selection'?JSON.stringify([{spanIds:[selectSpanId],factKind:'financial_metric'}]):JSON.stringify(revenueFact);
    return send({model:'fixture:tiny',done:true,done_reason:'stop',message:{role:'assistant',content},prompt_eval_count:100,eval_count:20,load_duration:1000000,prompt_eval_duration:1000000,eval_duration:1000000,total_duration:3000000});
   }
   response.writeHead(404);response.end('{}');
  });
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const endpoint='http://127.0.0.1:'+server.address().port;
 return {endpoint,selectionRequests,close:()=>new Promise(done=>server.close(done))};
}
test('retrieval narrows the candidate set before the model and the frozen contract still validates',async()=>fixture(async({folder,workspace})=>{
 const supports=supportCandidates(workspace.sentences,workspace.tables,{documentId:workspace.built.document.id,page:1});
 const cell=[...workspace.tables.list()[0].cells.values()].find(span=>span.cellText.replace(/[^0-9,]/g,'')==='2,575');
 const runtime=await fakeRuntimes(cell.id);
 try{
  const provider=localEmbeddingProvider({endpoint:runtime.endpoint,model:'fixture-embed'});
  await provider.preflight();
  const spanIndex=new SpanEmbeddingIndex(join(folder,'span-index.sqlite'));
  const vectors=await provider.embedMany(supports.map(retrievalText));
  for(const [position,support] of supports.entries()){
   const identity={spanId:support.spanId,spanHash:support.spanHash,rendererVersion:spanRenderVersion,embeddingModel:provider.metadata.model,embeddingModelDigest:provider.metadata.modelVersion,indexVersion:spanIndexVersion};
   spanIndex.put({id:spanEmbeddingId(identity),...identity,documentId:support.documentId,subjectId:support.subjectId,sourceId:support.sourceId,page:support.page,dimension:provider.metadata.dimension,vector:vectors[position],sourceHash:support.supportHash,createdAt:'2026-09-14T00:00:00.000Z'});
  }
  const retrieval=new SpanRetrievalLayer({provider,index:spanIndex,limit:3,clock:()=>'2026-09-14T00:00:00.000Z'});
  const chat=await (await import('../local-model/provider.js')).ollamaProvider({endpoint:runtime.endpoint,model:'fixture:tiny'});
  await chat.preflight();
  const analyst=new EvidenceSupportAnalyst(workspace.index,workspace.registry,{sentences:workspace.sentences,tables:workspace.tables,store:new SupportStore(join(folder,'store-retrieval')),provider:chat,maxSpansPerCase:24,retrieve:async request=>{
   const outcome=await retrieval.retrieve({supports:request.candidates,query:'revenue 2,575',subjectId:request.subjectId,asOf:request.asOf,timeMode:request.timeMode,caseId:request.caseId});
   return {supports:outcome.supports,receipt:outcome.receipt};
  }});
  const record=await analyst.analyzeCase({caseId:'RET-01',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'});
  assert.equal(record.status,'generated');
  assert.equal(record.candidateCount,supports.length);
  assert.ok(record.retrievedCount<=3);
  assert.ok(record.retrievedCount<record.candidateCount);
  assert.equal(record.retrieval.mode,'hybrid');
  assert.equal(record.retrieval.candidateCount,supports.length);
  const prompt=runtime.selectionRequests.at(-1);
  assert.equal(prompt.data.availableSpanIds.length,record.retrievedCount);
  assert.ok(prompt.data.availableSpanIds.every(spanId=>record.retrieval.results.some(result=>result.spanId===spanId)));
  assert.ok(prompt.data.context.split('\n\n').length<=record.retrievedCount);
  assert.equal(record.fabricated.length,0);
  const selection=record.selections[0];
  assert.equal(selection.spanId,cell.id);
  assert.equal(selection.proposal.validationStatus,'validated');
  const promoted=analyst.promote(selection.proposal.id,{asOf:'2026-09-14'});
  assert.ok(promoted.candidateId.startsWith('CANDIDATE-'));
  assert.equal(analyst.supportCandidates()[0].evidenceWritten,false);
  assert.deepEqual(parseSelection(JSON.stringify([{spanIds:[cell.id],factKind:'financial_metric'}]),record.selectedSpanIds).value,[{spanIds:[cell.id],factKind:'financial_metric'}]);
  spanIndex.close();
 }finally{await runtime.close();}
}));
test('an emptied retrieval result abstains without calling the model at all',async()=>fixture(async({folder,workspace})=>{
 const cell=[...workspace.tables.list()[0].cells.values()].find(span=>span.cellText.replace(/[^0-9,]/g,'')==='2,575');
 const runtime=await fakeRuntimes(cell.id);
 try{
  const chat=await (await import('../local-model/provider.js')).ollamaProvider({endpoint:runtime.endpoint,model:'fixture:tiny'});
  await chat.preflight();
  const analyst=new EvidenceSupportAnalyst(workspace.index,workspace.registry,{sentences:workspace.sentences,tables:workspace.tables,store:new SupportStore(join(folder,'store-abstain')),provider:chat,maxSpansPerCase:24,retrieve:async()=>({supports:[],receipt:{version:'span-hybrid-retrieval/v1',mode:'hybrid',abstained:true,abstainReason:'NO_CANDIDATE_ABOVE_FLOOR',results:[]}})});
  const record=await analyst.analyzeCase({caseId:'RET-02',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'});
  assert.equal(record.status,'RETRIEVAL_ABSTAINED');
  assert.equal(record.retrievedCount,0);
  assert.equal(record.selectionRun,null);
  assert.equal(runtime.selectionRequests.length,0);
  assert.equal(analyst.cases()[0].status,'RETRIEVAL_ABSTAINED');
 }finally{await runtime.close();}
}));
