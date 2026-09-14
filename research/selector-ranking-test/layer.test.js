import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {fixture} from '../evidence-support-test/fixtures.js';
import {testProvider} from '../evidence-support/contract.js';
import {supportCandidates} from '../evidence-support/layer.js';
import {SupportStore} from '../evidence-support/store.js';
import {select,convertRanked} from '../selector-ranking/layer.js';
const revenueFact={metricOrCategory:'revenue',metric:'consolidated_revenue',rawValueText:'$ 2,575',rawUnitText:'USD millions',periodText:'2025-12-31',actualOrGuidance:'actual',explicitOrDerived:'explicit'};
test('ranking input contains requested fact, hides IDs and ignores source policy instructions',()=>fixture(async({workspace})=>{
 const supports=supportCandidates(workspace.sentences,workspace.tables,{documentId:workspace.built.document.id,page:1}).slice(0,8);let seen;
 const provider=testProvider(input=>{seen=input;return JSON.stringify({rankedHandles:['S2']});});
 const selection=await select({provider,supports,question:'FY2025 revenue',subjectId:'synthetic',asOf:'2026-09-14'});
 assert.equal(seen.data.requestedFact,'FY2025 revenue');assert.equal(JSON.stringify(seen.data).includes('SPAN-'),false);assert.equal(selection.selectedSpanIds[0],supports[1].spanId);
}));
test('ranked conversion falls back on invalid interpretation and stops after legal Candidate',()=>fixture(async({workspace,folder})=>{
 const supports=supportCandidates(workspace.sentences,workspace.tables,{documentId:workspace.built.document.id,page:1}).slice(0,8);
 const revenue=supports.find(s=>s.type==='table'&&s.cellText.includes('2,575'));assert.ok(revenue);
 const other=supports.find(s=>s.spanId!==revenue.spanId);let calls=0;
 const provider=testProvider(input=>{calls++;return calls===1?'{}':JSON.stringify(revenueFact);});
 const rankingProvider=testProvider(()=>JSON.stringify({rankedHandles:['S1','S2','S3']}));
 const ordered=[other,revenue,...supports.filter(s=>![other.spanId,revenue.spanId].includes(s.spanId))];
 const selection=await select({provider:rankingProvider,supports:ordered,question:'FY2025 revenue',subjectId:'synthetic',asOf:'2026-09-14'}),store=new SupportStore(join(folder,'ranking-store'));
 try{const converted=await convertRanked({context:workspace,store,provider,selection,supports:ordered,entry:{subjectId:'synthetic',documentId:workspace.built.document.id},asOf:'2026-09-14'});assert.equal(converted.candidateFoundAtRank,2);assert.equal(calls,2);assert.equal(converted.attempts[0].status,'INTERPRETATION_ERROR');assert.equal(store.list('supportCandidate').length,1);assert.equal(store.list('proposalV2')[0].provenance.selectionPromptVersion,'span-ranking-handles/v1');}finally{store.close();}
}));
test('conversion stops at rank 3 after repeated invalid interpretations',()=>fixture(async({workspace,folder})=>{
 const supports=supportCandidates(workspace.sentences,workspace.tables,{documentId:workspace.built.document.id,page:1}).slice(0,8);let calls=0;
 const provider=testProvider(()=>{calls++;return '{}';});
 const selection=await select({provider:testProvider(()=>'{"rankedHandles":["S1","S2","S3"]}'),supports,question:'FY2025 revenue',subjectId:'synthetic',asOf:'2026-09-14'}),store=new SupportStore(join(folder,'ranking-cap-store'));
 try{const result=await convertRanked({context:workspace,store,provider,selection,supports,entry:{subjectId:'synthetic',documentId:workspace.built.document.id},asOf:'2026-09-14'});assert.equal(calls,3);assert.equal(result.candidateFoundAtRank,null);assert.equal(result.attempts.length,3);assert.equal(store.list('supportCandidate').length,0);}finally{store.close();}
}));
test('wrong subject and future source cannot reach interpretation or promotion',()=>fixture(async({workspace,folder})=>{
 const supports=supportCandidates(workspace.sentences,workspace.tables,{documentId:workspace.built.document.id,page:1}).slice(0,8);
 const selection=await select({provider:testProvider(()=>'{"rankedHandles":["S1"]}'),supports,question:'FY2025 revenue',subjectId:'synthetic',asOf:'2026-09-14'});
 for(const [name,entry,asOf] of [['wrong',{subjectId:'other',documentId:workspace.built.document.id},'2026-09-14'],['future',{subjectId:'synthetic',documentId:workspace.built.document.id},'2020-01-01']]){
  let calls=0;const provider=testProvider(()=>{calls++;return JSON.stringify(revenueFact);}),store=new SupportStore(join(folder,'ranking-filter-'+name));
  try{const result=await convertRanked({context:workspace,store,provider,selection,supports,entry,asOf});assert.equal(calls,0);assert.equal(result.candidateFoundAtRank,null);assert.equal(result.attempts[0].status,'VALIDATOR_REJECT');assert.equal(store.list('supportCandidate').length,0);}finally{store.close();}
 }
}));
