import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resumeDrift,loadArmCheckpoint,assembleLockedRun} from '../local-retrieval/cli.js';
import {armOf,warm,gate,context,embedding,chat,spanIndex,resource,decisions} from './fixtures.js';

const versions={selectionPromptVersion:'span-selection-v2.txt',interpretationPromptVersion:'fact-interpretation-span-v2.txt',layoutParserVersion:'pdf-layout-spans-pymupdf-1.26.5/v1',groundingVersion:'grounding/v0.8',segmentationVersion:'sentence-spans/v1',supportVersion:'source-support/v0.9',validationVersion:'grounded-validator/v2',spanRenderVersion:'span-retrieval-render/v1',spanIndexVersion:'span-embedding-index/v1'};
const fingerprint={goldHash:'sha256:gold',gateHash:'sha256:gate',provider:{modelVersion:'sha256:model'},embedding:{modelDigest:'sha256:embedding'},retrieval:{mode:'hybrid',limit:8},frozenK:8,...versions};

test('resume reuses a stored arm only while every frozen input still matches',()=>{
 assert.deepEqual(resumeDrift({stored:fingerprint,current:{...fingerprint,versions}}),[]);
 const modelMoved=resumeDrift({stored:fingerprint,current:{...fingerprint,provider:{modelVersion:'sha256:other'},versions}});
 assert.equal(modelMoved.length,1);
 assert.match(modelMoved[0],/provider\.modelVersion/);
 const promptMoved=resumeDrift({stored:fingerprint,current:{...fingerprint,versions:{...versions,selectionPromptVersion:'span-selection-v3.txt'}}});
 assert.equal(promptMoved.length,1);
 assert.match(promptMoved[0],/version\.selectionPromptVersion/);
 const goldMoved=resumeDrift({stored:fingerprint,current:{...fingerprint,goldHash:'sha256:other',versions}});
 assert.equal(goldMoved.length,1);
 assert.match(goldMoved[0],/goldHash/);
});

test('a resumed run rebuilds both arms from the checkpoints and assembles the same decision',()=>{
 const folder=mkdtempSync(join(tmpdir(),'fc-resume-'));
 try{
  const controlArm=armOf({label:'v0.10-control',target:0.6875,conversion:0.6875,tokens:390000,perCase:Array.from({length:16},()=>30000),timeouts:3,noUsage:3,recall:0});
  const retrievalArm=armOf({label:'v0.11-hybrid',target:0.75,conversion:0.6875,tokens:120000,perCase:Array.from({length:16},()=>7500),timeouts:0,recall:0.9375});
  for(const arm of [controlArm,retrievalArm]){
   writeFileSync(join(folder,'arm-'+arm.label+'-raw.json'),JSON.stringify({label:arm.label,runId:'local-run',goldHash:'sha256:gold',metrics:arm.result.metrics,splits:arm.result.splits,gateResult:arm.result.gateResult,gatePassed:arm.result.gatePassed,failureBreakdown:arm.result.failureBreakdown,claimsProtection:arm.result.claimsProtection,latency:arm.result.latency,scores:arm.result.scores,results:arm.result.results}));
   writeFileSync(join(folder,'arm-'+arm.label+'.json'),JSON.stringify({label:arm.label,payload:arm.payload,measurement:arm.measurement,caseRows:arm.caseRows,tokens:arm.tokens,responses:arm.responses,injectionRuns:arm.injectionRuns,injectionUsage:arm.injectionUsage,metrics:arm.result.metrics,splits:arm.result.splits,gateResult:arm.result.gateResult,latency:arm.result.latency,claimsProtection:arm.result.claimsProtection,futureLeakage:arm.futureLeakage}));
  }
  const direct=assembleLockedRun({controlArm,retrievalArm,context,phaseGate:gate,embedding,chat,spanIndex,findings:[],resource,warm,decisions});
  const resumed=assembleLockedRun({controlArm:loadArmCheckpoint({label:'v0.10-control',folder}),retrievalArm:loadArmCheckpoint({label:'v0.11-hybrid',folder}),context,phaseGate:gate,embedding,chat,spanIndex,findings:[],resource,warm,decisions});
  assert.equal(resumed.decision,direct.decision);
  assert.deepEqual(resumed.gateResult.failed,direct.gateResult.failed);
  assert.deepEqual(resumed.efficiency,JSON.parse(JSON.stringify(direct.efficiency)));
  assert.deepEqual(resumed.resultsPayload.cases,direct.resultsPayload.cases);
  assert.equal(resumed.resultsPayload.arms.retrieval.retrievalMetrics.mrr.rate,direct.resultsPayload.arms.retrieval.retrievalMetrics.mrr.rate);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
