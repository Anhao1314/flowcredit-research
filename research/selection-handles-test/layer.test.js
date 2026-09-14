import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {EvidenceSupportAnalyst,supportCandidates} from '../evidence-support/layer.js';
import {testProvider} from '../evidence-support/contract.js';
import {SupportStore} from '../evidence-support/store.js';
import {fixture} from '../evidence-support-test/fixtures.js';

const revenueFact={metricOrCategory:'revenue',metric:'consolidated_revenue',rawValueText:'$ 2,575',rawUnitText:'USD millions',periodText:'2025-12-31',actualOrGuidance:'actual',explicitOrDerived:'explicit'};

function analystFor(workspace,folder,{selection,interpretation=()=>revenueFact,seen=[]}){
 const provider=testProvider(input=>{
  seen.push(input);
  return JSON.stringify(input.data.span?interpretation(input.data.span):selection);
 });
 const store=new SupportStore(join(folder,'store-handles-'+Math.random().toString(16).slice(2)));
 return {analyst:new EvidenceSupportAnalyst(workspace.index,workspace.registry,{sentences:workspace.sentences,tables:workspace.tables,store,provider,maxSpansPerCase:24,selectionInterface:'handles'}),store};
}

test('the selection prompt offers handles and no canonical span id',()=>fixture(({workspace,folder})=>{
 const seen=[];
 const {analyst,store}=analystFor(workspace,folder,{selection:[{selectedHandles:['S2'],factKind:'financial_metric'}],seen});
 return analyst.analyzeCase({caseId:'H-01',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'}).then(record=>{
  const selectionInput=seen.find(input=>!input.data.span),interpretationInput=seen.find(input=>input.data.span);
  const order=supportCandidates(workspace.sentences,workspace.tables,{documentId:workspace.built.document.id,page:1}).map(support=>support.spanId);
  assert.equal(selectionInput.data.availableSpanIds,undefined);
  assert.deepEqual(selectionInput.data.availableHandles,order.map((_,index)=>'S'+(index+1)));
  assert.ok(selectionInput.data.context.startsWith('[S1]\n'));
  assert.equal(selectionInput.data.context.includes('SPAN-'),false);
  assert.equal(selectionInput.promptVersion,'span-selection/v3');
  assert.deepEqual(selectionInput.outputSchema.items.properties.selectedHandles.items.enum,order.map((_,index)=>'S'+(index+1)));
  assert.equal(interpretationInput.data.span.handle,'S2');
  assert.equal(interpretationInput.data.span.id,undefined);
  assert.equal(interpretationInput.data.evidenceText.startsWith('[S2]\n'),true);
  assert.equal(interpretationInput.data.evidenceText.includes('SPAN-'),false);
  assert.deepEqual(record.selectedSpanIds,[order[1]]);
  assert.equal(record.selectionInterface.handles[1].handle,'S2');
  assert.equal(record.selectionInterface.handles[1].spanId,order[1]);
  assert.equal(record.fabricated.length,0);
  assert.deepEqual(record.invalidHandles,[]);
  const selectionProposal=store.get('selectionProposal',record.selectionProposalId);
  assert.deepEqual(selectionProposal.spanIds,[order[1]]);
  assert.equal(selectionProposal.interface,'handles');
  assert.equal(selectionProposal.promptVersion,'span-selection/v3');
  assert.deepEqual(selectionProposal.handles,[{handle:'S2',spanId:order[1]}]);
  const proposal=analyst.proposals()[0];
  assert.equal(proposal.support.spanId,order[1]);
  assert.equal(proposal.provenance.selectionPromptVersion,'span-selection/v3');
  store.close();
 });
}));

test('an unusable handle is named, never interpreted and never repaired',()=>fixture(({workspace,folder})=>{
 let calls=0;
 const beyond='S'+(supportCandidates(workspace.sentences,workspace.tables,{documentId:workspace.built.document.id,page:1}).length+1);
 const provider=testProvider(()=>{calls+=1;return JSON.stringify([{selectedHandles:[beyond],factKind:'financial_metric'}]);});
 const store=new SupportStore(join(folder,'store-handles-bad'));
 const analyst=new EvidenceSupportAnalyst(workspace.index,workspace.registry,{sentences:workspace.sentences,tables:workspace.tables,store,provider,maxSpansPerCase:24,selectionInterface:'handles'});
 return analyst.analyzeCase({caseId:'H-02',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'}).then(record=>{
  assert.equal(record.status,'INVALID_SELECTION_HANDLE');
  assert.deepEqual(record.invalidHandles,[beyond]);
  assert.equal(calls,1);
  assert.equal(record.selections.length,0);
  assert.equal(record.fabricated.length,0);
  store.close();
 });
}));

test('the historical canonical-id response cannot pass the handle interface',()=>fixture(({workspace,folder})=>{
 const provider=testProvider(()=>JSON.stringify([{spanIds:['SPAN-not-a-handle'],factKind:'financial_metric'}]));
 const store=new SupportStore(join(folder,'store-handles-canonical'));
 const analyst=new EvidenceSupportAnalyst(workspace.index,workspace.registry,{sentences:workspace.sentences,tables:workspace.tables,store,provider,maxSpansPerCase:24,selectionInterface:'handles'});
 return analyst.analyzeCase({caseId:'H-03',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'}).then(record=>{
  assert.equal(record.status,'SPAN_SCHEMA_ERROR');
  assert.equal(record.rawResponse.includes('SPAN-not-a-handle'),true);
  store.close();
 });
}));

test('a duplicated handle is rejected instead of deduplicated',()=>fixture(({workspace,folder})=>{
 const provider=testProvider(()=>JSON.stringify([{selectedHandles:['S1','S1'],factKind:'financial_metric'}]));
 const store=new SupportStore(join(folder,'store-handles-dup'));
 const analyst=new EvidenceSupportAnalyst(workspace.index,workspace.registry,{sentences:workspace.sentences,tables:workspace.tables,store,provider,maxSpansPerCase:24,selectionInterface:'handles'});
 return analyst.analyzeCase({caseId:'H-04',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'}).then(record=>{
  assert.equal(record.status,'DUPLICATE_SELECTION_HANDLE');
  assert.equal(record.selections.length,0);
  store.close();
 });
}));

test('a model abstention stays an abstention and the canonical interface is untouched',()=>fixture(({workspace,folder})=>{
 const seen=[];
 const {analyst,store}=analystFor(workspace,folder,{selection:[],seen});
 return analyst.analyzeCase({caseId:'H-05',documentId:workspace.built.document.id,page:1,subjectId:'synthetic',asOf:'2026-09-14'}).then(record=>{
  assert.equal(record.status,'abstained_or_unsupported');
  assert.deepEqual(record.selectedSpanIds,[]);
  const selectionInput=seen[0];
  assert.equal(selectionInput.promptVersion,'span-selection/v3');
  assert.deepEqual(selectionInput.outputSchema.items.properties.selectedHandles.items.enum.length>0,true);
  store.close();
 });
}));
