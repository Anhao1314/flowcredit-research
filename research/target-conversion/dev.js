import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {devWorkspace,asOf} from './fixtures.js';
import {createIntent,assertIntent,createSidecar,parseBound} from './contract.js';
import {convertTarget} from './layer.js';
import {SupportStore} from '../evidence-support/store.js';
import {supportCandidates} from '../evidence-support/layer.js';
import {testProvider} from '../evidence-support/contract.js';
export const request={subjectId:'synthetic',targetKind:'financial_fact',targetCategory:'revenue',targetMetricOrConcept:'consolidated_revenue',timeScope:{kind:'period',start:'2027-01-01',end:'2027-12-31'},dimension:{kind:'none',value:null},actualOrGuidance:'actual',explicitOrDerived:'explicit'};
const fact=(metric='consolidated_revenue',category='revenue',value=null,period=null,extra={})=>({metricOrCategory:category,metric,rawValueText:value,rawUnitText:null,periodText:period,actualOrGuidance:'actual',explicitOrDerived:'explicit',...extra});
const yes=f=>({targetMatch:'supported',fact:f}),no={targetMatch:'not_supported',fact:null},ambiguous={targetMatch:'ambiguous',fact:null};
export async function runDev(){
 const context=devWorkspace(),intent=createIntent(request,{createdAt:asOf}),table=supportCandidates(context.sentences,context.tables,{documentId:context.built.document.id,page:1}),text=page=>supportCandidates(context.sentences,context.tables,{documentId:context.built.document.id,page})[0];
 const revenue=table.find(s=>s.type==='table'&&s.rowLabel==='Revenue'&&s.columnLabel==='2027'),old=table.find(s=>s.type==='table'&&s.rowLabel==='Revenue'&&s.columnLabel==='2026'),debt=table.find(s=>s.type==='table'&&s.rowLabel==='Total debt'&&s.columnLabel==='2027');assert.ok(revenue&&old&&debt);
 const rows=[];
 async function scenario(name,{supports=[revenue],target=intent,responses=[yes(fact())],expectedRank=null,expectedFailure=null,expectedCalls=null,cutoff=asOf}){
  let calls=0;const provider=testProvider(()=>JSON.stringify(responses[calls++]??no)),store=new SupportStore(resolve(context.folder,name));
  try{const result=await convertTarget({context,store,provider,supports,rankedHandles:supports.slice(0,3).map((_,i)=>'S'+(i+1)),intent:target,documentId:context.built.document.id,asOf:cutoff});assert.equal(result.candidateFoundAtRank,expectedRank,name+' '+JSON.stringify(result));if(expectedFailure)assert.equal(result.attempts[0].status,expectedFailure,name);if(expectedCalls!==null)assert.equal(calls,expectedCalls,name);
   if(expectedRank){assert.equal(store.list('intentSidecar').length,1);assert.equal(result.attempts.at(-1).sidecar.intentId,target.intentId);assert.equal(store.list('supportCandidate')[0].evidenceWritten,false);}else assert.equal(store.list('supportCandidate').length,0);
   rows.push({name,passed:true,calls,candidateFoundAtRank:result.candidateFoundAtRank,statuses:result.attempts.map(a=>a.status),extractionProof:result.attempts.find(a=>a.extractionProof)?.extractionProof??null});
  }finally{store.close();}
 }
 try{
  assert.throws(()=>assertIntent({...intent,expectedValue:37}));assert.throws(()=>assertIntent({...intent,expectedSpanId:'secret'}));assert.throws(()=>parseBound(JSON.stringify({...no,authority:'ACCEPTED'})));
  await scenario('correct-table-target',{expectedRank:1,expectedCalls:1});
  await scenario('wrong-fact-same-span',{supports:[text(2)],responses:[yes(fact('operating_cash_flow','cash_flow','$19 million','year ended December 31, 2027'))],expectedFailure:'CATEGORY_ERROR'});
  const cashflow=createIntent({...request,targetCategory:'cash_flow',targetMetricOrConcept:'operating_cash_flow'},{createdAt:asOf});
  await scenario('two-metrics-target-binding',{supports:[text(2)],target:cashflow,responses:[yes(fact('operating_cash_flow','cash_flow','$19 million','year ended December 31, 2027'))],expectedRank:1});
  await scenario('wrong-literal-same-span',{supports:[text(2)],target:cashflow,responses:[yes(fact('operating_cash_flow','cash_flow','$37 million','year ended December 31, 2027'))],expectedFailure:'TARGET_MISMATCH'});
  await scenario('guidance-is-not-actual',{supports:[text(3)],responses:[yes(fact('revenue_guidance','guidance','$71 million','year ended December 31, 2028',{actualOrGuidance:'guidance'}))],expectedFailure:'CATEGORY_ERROR'});
  const guidance=createIntent({...request,targetCategory:'guidance',targetMetricOrConcept:'revenue_guidance',actualOrGuidance:'guidance',timeScope:{kind:'period',start:'2028-01-01',end:'2028-12-31'}},{createdAt:asOf});
  await scenario('explicit-guidance',{supports:[text(3)],target:guidance,responses:[yes(fact('revenue_guidance','guidance','$71 million','year ended December 31, 2028',{actualOrGuidance:'guidance'}))],expectedRank:1});
  await scenario('right-category-wrong-period',{supports:[old],expectedFailure:'TARGET_MISMATCH',expectedCalls:0});
  await scenario('right-period-wrong-metric',{supports:[text(2)],responses:[no],expectedFailure:'TARGET_MISMATCH'});
  await scenario('table-row-mismatch',{supports:[debt],expectedFailure:'TARGET_MISMATCH',expectedCalls:0});
  await scenario('compound-explicit-clause',{supports:[text(2)],responses:[yes(fact('consolidated_revenue','revenue','$37 million and $19 million','year ended December 31, 2027'))],expectedRank:1});
  await scenario('compound-respectively-no-guess',{supports:[text(5)],responses:[yes(fact('consolidated_revenue','revenue','$34 million and $74 million','three and six months ended March 31, 2027'))],expectedFailure:'COMPOUND_LITERAL_ERROR'});
  await scenario('ambiguous-support',{supports:[text(4)],responses:[ambiguous],expectedFailure:'SUPPORT_AMBIGUOUS'});
  await scenario('no-target-support',{supports:[text(6)],responses:[no],expectedFailure:'TARGET_MISMATCH'});
  await scenario('rank-fallback',{supports:[text(6),revenue,debt],responses:[no,yes(fact())],expectedRank:2,expectedCalls:2});
  await scenario('unit-guess-rejected',{supports:[text(7)],responses:[yes({...fact('consolidated_revenue','revenue','37','year ended December 31, 2027'),rawUnitText:'million'})],expectedFailure:'PARSER_ERROR'});
  await scenario('derived-not-coerced',{responses:[yes(fact('consolidated_revenue','revenue',null,null,{explicitOrDerived:'derived'}))],expectedFailure:'TARGET_MISMATCH'});
  await scenario('untrusted-source-injection',{supports:[text(8)],responses:[no],expectedFailure:'TARGET_MISMATCH'});
  const wrong=createIntent({...request,subjectId:'wrong'},{createdAt:asOf});await scenario('wrong-subject',{target:wrong,expectedFailure:'VALIDATOR_REJECT',expectedCalls:0});
  await scenario('future-source',{cutoff:'2027-01-01T00:00:00Z',expectedFailure:'VALIDATOR_REJECT',expectedCalls:0});
  await scenario('rank-three-stop',{supports:[text(6),text(4),text(7)],responses:[no,no,no],expectedCalls:3,expectedFailure:'TARGET_MISMATCH'});
  await scenario('tampered-source',{supports:[{...revenue,rowLabel:'Total debt'}],expectedCalls:0,expectedFailure:'VALIDATOR_REJECT'});
  return {version:'target-conversion-dev/v1',offline:true,provider:'deterministic-test',modelCalls:0,embeddingCalls:0,passed:rows.every(r=>r.passed),cases:rows.length,rows};
 }finally{context.close();}
}
