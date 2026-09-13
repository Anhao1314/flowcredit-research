import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {fixture,now,tableSpans} from './fixtures.js';
import {parseSelection,testProvider} from '../grounding/contract.js';
import {GroundedAnalyst,selectionCandidates} from '../grounding/layer.js';
import {annotateCase} from '../grounding/gold.js';
import {scoreCase} from '../grounding/eval.js';
import {StagedStore} from '../analyst-staged/store.js';
import {ProposalStore} from '../analyst/store.js';

const tableFact={metricOrCategory:'revenue',metric:'revenue',rawValueText:'$ 2,575',rawUnitText:'(in millions)',periodText:'Year Ended December 31, 2025',actualOrGuidance:'actual',explicitOrDerived:'explicit'};
const injectionFact={metricOrCategory:'revenue',metric:'revenue',rawValueText:'$32 million',rawUnitText:'million',periodText:'year ended December 31, 2025',actualOrGuidance:'actual',explicitOrDerived:'explicit'};
function scripted({select,fact}){
 return testProvider(input=>input.promptVersion==='span-selection/v1'?JSON.stringify([{spanIds:select(input),factKind:'financial_metric'}]):JSON.stringify(fact));
}
function analystFor({index,registry,folder,provider,maxSpansPerCase=8}){
 const store=new StagedStore(join(folder,'store-'+Math.random().toString(16).slice(2))),proposals=new ProposalStore(join(folder,'proposals-'+Math.random().toString(16).slice(2)+'.sqlite'));
 const analyst=new GroundedAnalyst(index,registry,store,{proposals,provider,clock:()=>now,maxSpansPerCase});
 return {analyst,store,proposals,close(){proposals.close();store.close();}};
}
const analyze=(analyst,{caseId='CASE-1',documentId,page=1,subjectId='synthetic',asOf='2026-09-01'}={})=>analyst.analyzeCase({caseId,documentId,page,subjectId,asOf});

test('selection schema only accepts the minimal span contract',()=>{
 assert.deepEqual(parseSelection('[]',['SPAN-1']).value,[]);
 assert.equal(parseSelection('```json\n[]\n```',['SPAN-1']).wrapperRemoved,true);
 for(const raw of ['{}','[{"spanIds":[]}]','[{"spanIds":["SPAN-1"],"factKind":"financial_metric","risk":"LOW"}]','[{"spanIds":["SPAN-1"],"factKind":"guessed"}]'])assert.throws(()=>parseSelection(raw,['SPAN-1']),/CONTRACT_SCHEMA_INVALID/);
});

test('span ids outside the supplied set are rejected before interpretation',()=>{
 assert.throws(()=>parseSelection('[{"spanIds":["SPAN-999"],"factKind":"financial_metric"}]',['SPAN-1']),error=>{
  assert.equal(error.message,'INVALID_SPAN_REFERENCE');
  assert.deepEqual(error.fabricated,['SPAN-999']);
  return true;
 });
});

test('a fabricated span id ends the case without facts or proposals',async()=>fixture(async({registry,index,built,folder})=>{
 const run=analystFor({registry,index,folder,provider:scripted({select:()=>['SPAN-000000000000000000000000'],fact:tableFact})});
 try{
  const result=await analyze(run.analyst,{documentId:built.document.id});
  assert.equal(result.status,'FABRICATED_SPAN');
  assert.deepEqual(result.fabricated,['SPAN-000000000000000000000000']);
  assert.equal(run.store.list('fact').length,0);
  assert.equal(run.store.list('selectionProposal').length,0);
  assert.equal(run.proposals.runs().length,0);
 }finally{run.close();}
}));

test('a span from another page of the same document is also fabricated',async()=>fixture(async({registry,index,built,folder})=>{
 const page1Span=tableSpans(registry,'Revenue')[0].id;
 const run=analystFor({registry,index,folder,provider:scripted({select:()=>[page1Span],fact:tableFact})});
 try{
  const result=await analyze(run.analyst,{documentId:built.document.id,page:2});
  assert.equal(result.status,'FABRICATED_SPAN');
  assert.deepEqual(result.fabricated,[page1Span]);
 }finally{run.close();}
}));

test('selection stays inside the interpretation budget',async()=>fixture(async({registry,index,built,folder})=>{
 const ids=selectionCandidates(registry.findSpansByPage(built.document.id,1)).map(span=>span.id);
 const run=analystFor({registry,index,folder,maxSpansPerCase:3,provider:scripted({select:()=>ids.slice(0,3),fact:tableFact})});
 try{
  const overflow=analystFor({registry,index,folder,maxSpansPerCase:3,provider:testProvider(input=>input.promptVersion==='span-selection/v1'?JSON.stringify([{spanIds:ids.slice(0,3),factKind:'financial_metric'},{spanIds:ids.slice(3,5),factKind:'financial_metric'}]):JSON.stringify(tableFact))});
  const result=await analyze(overflow.analyst,{caseId:'BUDGET',documentId:built.document.id});
  overflow.close();
  assert.equal(result.selectedSpanIds.length,3);
  assert.equal(result.selections.length,3);
 }finally{run.close();}
}));

test('verified selection feeds deterministic parsing and the unchanged validator',async()=>fixture(async({registry,index,built,folder})=>{
 const [revenue2025]=tableSpans(registry,'Revenue');
 const run=analystFor({registry,index,folder,provider:scripted({select:input=>{assert.ok(input.data.availableSpanIds.includes(revenue2025.id));return [revenue2025.id];},fact:tableFact})});
 try{
  const result=await analyze(run.analyst,{documentId:built.document.id});
  assert.equal(result.status,'generated');
  const [selection]=result.selections;
  assert.equal(selection.status,'interpreted');
  assert.deepEqual(selection.findings,[]);
  assert.equal(selection.parser.numeric.normalizedValue,2575000000);
  assert.equal(selection.parser.numeric.rawUnit,'USD_millions');
  assert.equal(selection.parser.period.end,'2025-12-31');
  const proposal=selection.proposal;
  assert.ok(proposal);
  assert.equal(proposal.rawValue,2575);
  assert.equal(proposal.proposedNormalizedValue,2575000000);
  assert.equal(proposal.observedAt,'2025-12-31');
  assert.equal(proposal.statement,proposal.quotedText);
  assert.equal(proposal.spanId,undefined);
  assert.equal(proposal.groundingVersion,undefined);
  assert.ok(proposal.validationFindings.includes('period_not_supported'));
  assert.equal(proposal.validationStatus,'invalid');
  const runRecord=run.proposals.runs()[0];
  assert.equal(runRecord.spanId,revenue2025.id);
  assert.equal(runRecord.spanType,'table');
  assert.equal(runRecord.groundingVersion,'source-span-registry/v1');
 }finally{run.close();}
}));

test('span selection and interpretation are deterministic for the same inputs',async()=>fixture(async({registry,index,built,folder})=>{
 const [revenue2025]=tableSpans(registry,'Revenue');
 const provider=scripted({select:()=>[revenue2025.id],fact:tableFact});
 const first=analystFor({registry,index,folder,provider}),second=analystFor({registry,index,folder,provider});
 try{
  const a=await analyze(first.analyst,{caseId:'DET-A',documentId:built.document.id});
  const b=await analyze(second.analyst,{caseId:'DET-B',documentId:built.document.id});
  assert.equal(a.selections[0].proposal.id,b.selections[0].proposal.id);
  assert.equal(a.selections[0].proposal.inputHash,b.selections[0].proposal.inputHash);
  assert.notEqual(a.selectionProposalId,b.selectionProposalId);
  assert.notEqual(a.selections[0].factId,b.selections[0].factId);
 }finally{first.close();second.close();}
}));

test('two cases sharing a page keep distinct case-scoped identities',()=>fixture(async({registry,index,built,folder})=>{
 const [revenue2025]=tableSpans(registry,'Revenue');
 const run=analystFor({registry,index,folder,provider:scripted({select:()=>[revenue2025.id],fact:tableFact})});
 try{
  const first=await analyze(run.analyst,{caseId:'SHARED-A',documentId:built.document.id});
  const second=await analyze(run.analyst,{caseId:'SHARED-B',documentId:built.document.id});
  assert.notEqual(first.selectionProposalId,second.selectionProposalId);
  assert.notEqual(first.selections[0].factId,second.selections[0].factId);
  assert.equal(first.selections[0].proposal.id,second.selections[0].proposal.id);
  assert.equal(run.store.list('fact').length,2);
  assert.equal(run.store.list('selectionProposal').length,2);
  assert.equal(run.store.list('case').length,2);
  assert.equal(run.proposals.list().length,1);
 }finally{run.close();}
}));

test('injected instructions inside a span remain data and cannot become a Candidate',async()=>fixture(async({registry,index,built,folder})=>{
 const injected=registry.findSpansByPage(built.document.id,2).find(span=>span.text.includes('Ignore previous instructions'));
 assert.ok(injected);
 const run=analystFor({registry,index,folder,provider:scripted({select:()=>[injected.id],fact:injectionFact})});
 try{
  const result=await analyze(run.analyst,{documentId:built.document.id,page:2});
  assert.equal(result.status,'generated');
  const proposal=result.selections[0].proposal;
  assert.ok(proposal.validationFindings.includes('instruction_like_content'));
  assert.equal(proposal.validationStatus,'invalid');
  assert.throws(()=>run.analyst.promote(proposal.id),/not_admissible/);
  assert.equal(run.analyst.cases().length,1);
  assert.equal(Object.keys(proposal).includes('accepted'),false);
 }finally{run.close();}
}));

test('Gold annotation maps table, text and unsupported cases onto spans',()=>fixture(({registry,built})=>{
 const table=annotateCase(registry,{caseId:'SYN-TABLE',goldEvidenceId:'EVID-t',documentId:built.document.id,page:1,legacyBinding:'table_column',expected:{rawValue:2575,rawUnit:'USD_millions',periodStart:'2025-01-01',periodEnd:'2025-12-31',observedAt:'2025-12-31',category:'revenue'}});
 assert.equal(table.classification,'table_span');
 assert.equal(table.spanIds.length,1);
 assert.deepEqual(table.spanIds,[tableSpans(registry,'Revenue').find(span=>span.headerPath.includes('2025')).id]);
 const narrative=annotateCase(registry,{caseId:'SYN-TEXT',goldEvidenceId:'EVID-x',documentId:built.document.id,page:1,legacyBinding:'narrative',expected:{rawValue:32,rawUnit:'USD_millions',periodEnd:'2025-12-31',observedAt:'2025-12-31',periodStart:'2025-01-01',category:'revenue'}});
 assert.equal(narrative.classification,'unsupported');
 const missing=annotateCase(registry,{caseId:'SYN-MISS',goldEvidenceId:'EVID-y',documentId:built.document.id,page:1,legacyBinding:'table_column',expected:{rawValue:999999,rawUnit:'USD_millions',periodEnd:'2025-12-31',observedAt:'2025-12-31',category:'revenue'}});
 assert.equal(missing.classification,'unsupported');
 assert.ok(missing.basis.includes('legacy_table_binding_without_span'));
}));

test('scoring separates fabricated spans from wrong selections',()=>{
 const annotation={caseId:'GOLD-X',legacyBinding:'table_column',spanIds:['SPAN-a'],expected:null};
 const fabricated=scoreCase(annotation,{status:'FABRICATED_SPAN',fabricated:['SPAN-x'],selections:[]},{expected:{category:'revenue'}});
 assert.equal(fabricated.selectionValid,false);
 assert.equal(fabricated.fabricated,1);
 assert.ok(fabricated.findings.includes('FABRICATED_SPAN'));
 const wrong=scoreCase(annotation,{status:'generated',selections:[{spanId:'SPAN-b',status:'interpreted',findings:[],parser:{numeric:{normalizedValue:1,rawUnit:'USD_millions'},period:{status:'known',start:null,end:'2025-12-31'}},value:{metricOrCategory:'revenue'}}]},{expected:{normalizedValue:2,rawUnit:'USD_millions',category:'revenue',periodEnd:'2025-12-31'}});
 assert.equal(wrong.selectionValid,true);
 assert.equal(wrong.targetSelected,false);
 assert.equal(wrong.nonTargetSelections,1);
 assert.ok(wrong.findings.includes('WRONG_SPAN_SELECTION'));
});
