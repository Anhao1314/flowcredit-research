import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadBenchmark} from '../benchmark/schema.js';
import {scoreBenchmark,evaluateGate} from '../benchmark/evaluate.js';

const protocol=JSON.parse(readFileSync(new URL('../benchmark/holdout-v0.2c-protocol.json',import.meta.url),'utf8'));
const lock=JSON.parse(readFileSync(new URL('../benchmark/holdout-v0.2c-dataset-lock.json',import.meta.url),'utf8'));
const dataset=loadBenchmark(new URL('../benchmark/data/real-sec-fresh-blind-v0.2c.json',import.meta.url));
const gate=JSON.parse(readFileSync(new URL('../benchmark/phase-gate-v0.2a.json',import.meta.url),'utf8'));

function gitBlobSha(buffer){
 const bytes=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
 const header=Buffer.from('blob '+bytes.length+'\0');
 return createHash('sha1').update(Buffer.concat([header,bytes])).digest('hex');
}
function blobOf(path){
 return gitBlobSha(readFileSync(new URL('../../'+path,import.meta.url)));
}

test('v0.2C first blind run verifies all frozen bytes before executing R2 exactly once',()=>{
 assert.equal(lock.status,'DATASET_LOCKED_NOT_EVALUATED');
 assert.equal(lock.evaluationState.r2ExecutedAgainstDataset,false);
 assert.equal(lock.evaluationState.firstPredictionExists,false);
 assert.equal(lock.evaluationState.scoreExists,false);

 assert.equal(blobOf(lock.datasetPath),lock.datasetGitBlobSha);
 assert.equal(blobOf(lock.protocolPath),lock.protocolGitBlobSha);
 for(const [path,sha] of Object.entries(protocol.candidate.files))assert.equal(blobOf(path),sha,path);
 for(const [path,sha] of Object.entries(protocol.harness.files))assert.equal(blobOf(path),sha,path);
 assert.equal(blobOf(protocol.gate.path),protocol.gate.gitBlobSha,protocol.gate.path);
 assert.deepEqual(gate.thresholds,protocol.gate.thresholds);

 const originalFetch=globalThis.fetch;
 let networkCalls=0;
 globalThis.fetch=()=>{networkCalls+=1;throw new Error('V02C_NETWORK_FORBIDDEN');};
 let result;
 try{
  result=scoreBenchmark(dataset,{runtime:'candidate-r2'});
 }finally{
  globalThis.fetch=originalFetch;
 }
 assert.equal(networkCalls,0);
 assert.equal(result.evaluatedCases,32);

 const phase=evaluateGate(result,gate);
 console.log('FRESH_BLIND_V02C_RESULT '+JSON.stringify({
  metrics:result.metrics,
  counts:result.counts,
  byLabel:result.byLabel,
  byChallenge:result.byChallenge
 }));
 console.log('FRESH_BLIND_V02C_FAILURES '+JSON.stringify(result.rows.filter(row=>!row.correct).map(row=>({
  caseId:row.caseId,
  bucket:dataset.cases.find(item=>item.caseId===row.caseId)?.bucket??null,
  challenge:row.challenge,
  expected:row.expected,
  predicted:row.predicted,
  reasonCodes:row.reasonCodes
 }))));
 console.log('FRESH_BLIND_V02C_GATE '+JSON.stringify(phase));
});
