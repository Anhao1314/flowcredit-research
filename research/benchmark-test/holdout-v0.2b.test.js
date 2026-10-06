import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadBenchmark} from '../benchmark/schema.js';
import {scoreBenchmark,evaluateGate} from '../benchmark/evaluate.js';

const root=new URL('../../',import.meta.url);
const holdoutPath=new URL('../benchmark/data/real-sec-blind-holdout-v0.2b.json',import.meta.url);
const lock=JSON.parse(readFileSync(new URL('../benchmark/holdout-v0.2b-lock.json',import.meta.url),'utf8'));
const holdout=loadBenchmark(holdoutPath);
const gate=JSON.parse(readFileSync(new URL('../benchmark/phase-gate-v0.2a.json',import.meta.url),'utf8'));
const pilot=loadBenchmark(new URL('../benchmark/data/real-sec-pilot-v0.1.json',import.meta.url));

function gitBlobSha(buffer){
 const bytes=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
 const header=Buffer.from('blob '+bytes.length+'\0');
 return createHash('sha1').update(Buffer.concat([header,bytes])).digest('hex');
}
function blobOf(path){
 return gitBlobSha(readFileSync(new URL('../../'+path,import.meta.url)));
}

test('v0.2B holdout bytes and candidate runtime are frozen before evaluation',()=>{
 assert.equal(blobOf(lock.datasetPath),lock.datasetGitBlobSha);
 for(const [path,sha] of Object.entries(lock.candidateRuntime))assert.equal(blobOf(path),sha,path);
 assert.equal(blobOf(lock.phaseGate.path),lock.phaseGate.gitBlobSha);
});

test('v0.2B is source-isolated from the v0.2A SEC pilot',()=>{
 assert.equal(holdout.status,'LOCKED_BLIND_HOLDOUT_SINGLE_REVIEW');
 assert.equal(holdout.cases.length,24);
 assert.equal(holdout.sources.length,3);
 const pilotIssuers=new Set(pilot.sources.map(source=>source.issuer));
 for(const source of holdout.sources)assert.ok(!pilotIssuers.has(source.issuer),source.issuer);
 assert.equal(new Set(holdout.cases.map(item=>item.caseId)).size,24);
 assert.ok(holdout.cases.every(item=>item.annotation.tier==='locked-blind-single-review'));
});

test('first blind candidate evaluation is deterministic, offline and reports the existing gate without tuning',()=>{
 const originalFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=()=>{calls+=1;throw new Error('HOLDOUT_NETWORK_FORBIDDEN');};
 let first,second;
 try{
  first=scoreBenchmark(holdout,{runtime:'candidate'});
  second=scoreBenchmark(holdout,{runtime:'candidate'});
 }finally{
  globalThis.fetch=originalFetch;
 }
 assert.equal(calls,0);
 assert.deepEqual(second,first);
 assert.equal(first.evaluatedCases,24);
 const phase=evaluateGate(first,gate);
 console.log('BLIND_HOLDOUT_V02B_RESULT '+JSON.stringify({
  metrics:first.metrics,
  counts:first.counts,
  byLabel:first.byLabel,
  byChallenge:first.byChallenge
 }));
 console.log('BLIND_HOLDOUT_V02B_FAILURES '+JSON.stringify(first.rows.filter(row=>!row.correct).map(row=>({
  caseId:row.caseId,challenge:row.challenge,expected:row.expected,predicted:row.predicted,reasonCodes:row.reasonCodes
 }))));
 console.log('BLIND_HOLDOUT_V02B_GATE '+JSON.stringify(phase));
 assert.ok(['PASS','FAIL'].includes(phase.status));
});
