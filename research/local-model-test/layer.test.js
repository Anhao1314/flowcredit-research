import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {ollamaProvider} from '../local-model/provider.js';
import {scanForbiddenOutput} from '../local-model/eval.js';
import {EvidenceSupportAnalyst} from '../evidence-support/layer.js';
import {SupportStore} from '../evidence-support/store.js';
import {fixture} from '../evidence-support-test/fixtures.js';

const fixtureDigest='sha256:'+'b'.repeat(64);
const revenueFact={metricOrCategory:'revenue',metric:'consolidated_revenue',rawValueText:null,rawUnitText:null,periodText:null,actualOrGuidance:'actual',explicitOrDerived:'explicit'};
// The whole local path is exercised over real loopback HTTP: the real
// LocalProvider transport talks to a deterministic stand-in for the runtime, so
// CI never needs Ollama, a model or any external network.
async function fakeRuntime(respond){
 const state={selection:0,interpretation:0};
 const server=createServer((request,response)=>{
  const chunks=[];
  request.on('data',chunk=>chunks.push(chunk));
  request.on('end',()=>{
   const send=value=>{response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(value));};
   if(request.url==='/api/version')return send({version:'fixture-runtime/1'});
   if(request.url==='/api/tags')return send({models:[{name:'fixture:tiny',model:'fixture:tiny',digest:fixtureDigest,size:123,details:{family:'fixture',parameter_size:'0.1B',quantization_level:'Q4_0',context_length:4096,format:'gguf'}}]});
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const phase=/span-selection/.test(body.messages[0].content)?'selection':'interpretation';
   state[phase]+=1;
   const content=respond({phase,body,state});
   send({model:'fixture:tiny',done:true,done_reason:'stop',message:{role:'assistant',content},prompt_eval_count:100,eval_count:20,load_duration:1000000,prompt_eval_duration:1000000,eval_duration:1000000,total_duration:3000000});
  });
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const {port}=server.address();
 const provider=ollamaProvider({endpoint:'http://127.0.0.1:'+port,model:'fixture:tiny'});
 return {provider,state,close:()=>new Promise(done=>server.close(done))};
}
function analystFor(workspace,folder,provider){return new EvidenceSupportAnalyst(workspace.index,workspace.registry,{sentences:workspace.sentences,tables:workspace.tables,store:new SupportStore(folder),provider,maxSpansPerCase:24});}

test('a local runtime selection validates, promotes and leaves Claims untouched',async()=>fixture(async({workspace,folder})=>{
 const cell=[...workspace.tables.list()[0].cells.values()].find(span=>span.cellText.replace(/[^0-9,]/g,'')==='2,575');
 const runtime=await fakeRuntime(({phase})=>phase==='selection'?JSON.stringify([{spanIds:[cell.id],factKind:'financial_metric'}]):JSON.stringify(revenueFact));
 try{
  const info=await runtime.provider.preflight();
  assert.equal(info.modelDigest,fixtureDigest);
  const analyst=analystFor(workspace,join(folder,'store-local-clean'),runtime.provider);
  const record=await analyst.analyzeCase({caseId:'LOCAL-01',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'});
  assert.equal(record.status,'generated');
  assert.equal(record.fabricated.length,0);
  const selection=record.selections[0];
  assert.equal(selection.proposal.validationStatus,'validated');
  const promoted=analyst.promote(selection.proposal.id,{asOf:'2026-09-14'});
  assert.ok(promoted.candidateId.startsWith('CANDIDATE-'));
  const stored=analyst.supportCandidates()[0];
  assert.equal(stored.admissionRequired,true);
  assert.equal(stored.evidenceWritten,false);
  assert.equal(analyst.provider.provider,'ollama');
  assert.equal(analyst.provider.modelVersion,fixtureDigest);
  assert.equal(runtime.state.selection,1);
  assert.equal(runtime.state.interpretation,1);
  assert.deepEqual(analyst.cases()[0].errors,[]);
  assert.deepEqual(analyst.facts()[0].validation.status,'validated');
  assert.deepEqual(runtime.provider.receipts.map(receipt=>receipt.status),['completed','completed']);
 }finally{await runtime.close();}
}));
test('a span the runtime invents is rejected before any interpretation call',async()=>fixture(async({workspace,folder})=>{
 const runtime=await fakeRuntime(()=>JSON.stringify([{spanIds:['SPAN-invented-by-local-model'],factKind:'financial_metric'}]));
 try{
  const analyst=analystFor(workspace,join(folder,'store-local-fabricated'),runtime.provider);
  const record=await analyst.analyzeCase({caseId:'LOCAL-02',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'});
  assert.equal(record.status,'FABRICATED_SPAN');
  assert.deepEqual(record.fabricated,['SPAN-invented-by-local-model']);
  assert.equal(record.selections.length,0);
  assert.equal(runtime.state.selection,1);
  assert.equal(runtime.state.interpretation,0);
  assert.equal(analyst.proposals().length,0);
 }finally{await runtime.close();}
}));
test('malformed local output and forbidden verdicts stay schema errors, never repairs',async()=>fixture(async({workspace,folder})=>{
 const cell=[...workspace.tables.list()[0].cells.values()].find(span=>span.cellText.replace(/[^0-9,]/g,'')==='2,575');
 const responses=[()=>JSON.stringify({not:'an array'}),()=>'ACCEPTED',()=>JSON.stringify([{spanIds:[cell.id],factKind:'financial_metric',verdict:'BUY'}])];
 for(const [index,respond] of responses.entries()){
  const runtime=await fakeRuntime(respond);
  try{
   const analyst=analystFor(workspace,join(folder,'store-local-schema-'+index),runtime.provider);
   const record=await analyst.analyzeCase({caseId:'LOCAL-03-'+index,documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'});
   assert.equal(record.status,'SPAN_SCHEMA_ERROR',respond());
   assert.equal(runtime.state.interpretation,0);
   assert.equal(analyst.proposals().length,0);
   if(respond().includes('BUY'))assert.deepEqual(scanForbiddenOutput(respond()),['RISK_VERDICT']);
  }finally{await runtime.close();}
 }
}));
test('an interpretation outside the contract is rejected without validator relaxation',async()=>fixture(async({workspace,folder})=>{
 const cell=[...workspace.tables.list()[0].cells.values()].find(span=>span.cellText.replace(/[^0-9,]/g,'')==='2,575');
 const runtime=await fakeRuntime(({phase})=>phase==='selection'?JSON.stringify([{spanIds:[cell.id],factKind:'financial_metric'}]):JSON.stringify({...revenueFact,metricOrCategory:'high_risk',actualOrGuidance:'risk_score'}));
 try{
  const analyst=analystFor(workspace,join(folder,'store-local-interpretation'),runtime.provider);
  const record=await analyst.analyzeCase({caseId:'LOCAL-04',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'});
  assert.equal(record.status,'abstained_or_unsupported');
  assert.equal(record.selections[0].status,'INTERPRETATION_SCHEMA_ERROR');
  assert.equal(record.selections[0].proposal,undefined);
  assert.equal(analyst.proposals().length,0);
  assert.equal(runtime.state.interpretation,1);
 }finally{await runtime.close();}
}));
