import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const protocol=JSON.parse(readFileSync(new URL('../benchmark/holdout-v0.2c-protocol.json',import.meta.url),'utf8'));

function gitBlobSha(buffer){
 const bytes=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
 const header=Buffer.from('blob '+bytes.length+'\0');
 return createHash('sha1').update(Buffer.concat([header,bytes])).digest('hex');
}
function blobOf(path){
 return gitBlobSha(readFileSync(new URL('../../'+path,import.meta.url)));
}

test('v0.2C protocol freezes R2 runtime and evaluation harness before dataset creation',()=>{
 assert.equal(protocol.status,'PROTOCOL_FROZEN_NO_DATASET');
 assert.equal(protocol.baseCommit,'b7817dedd1c6d9b59cde15558b2036ca421c4ff7');
 assert.equal(protocol.candidate.name,'relation-candidate/v0.2b-r2');
 for(const [path,sha] of Object.entries(protocol.candidate.files))assert.equal(blobOf(path),sha,path);
 for(const [path,sha] of Object.entries(protocol.harness.files))assert.equal(blobOf(path),sha,path);
 assert.equal(blobOf(protocol.gate.path),protocol.gate.gitBlobSha,protocol.gate.path);
});

test('v0.2C corpus shape is frozen at four unseen issuers and 32 cases',()=>{
 const plan=protocol.corpusPlan;
 assert.equal(plan.issuersRequired,4);
 assert.equal(plan.casesPerIssuer,8);
 assert.equal(plan.totalCases,32);
 assert.equal(plan.buckets.reduce((sum,item)=>sum+item.cases,0),32);
 assert.equal(new Set(plan.buckets.map(item=>item.name)).size,plan.buckets.length);
 assert.ok(plan.excludedIssuers.length>=7);
 for(const issuer of ['Apple Inc.','Microsoft Corporation','NVIDIA Corporation','Amazon.com, Inc.','Alphabet Inc.','Meta Platforms, Inc.','CoreWeave, Inc.']){
  assert.ok(plan.excludedIssuers.includes(issuer),issuer);
 }
});

test('v0.2C evaluation policy forbids adaptive tuning before and after first run',()=>{
 const policy=protocol.evaluationPolicy;
 for(const key of [
  'datasetBeforeRuntimeExecution',
  'datasetMustBeHashedAndLocked',
  'firstRunMustBeOneShot',
  'networkCallsFromRelationRuntimeForbidden',
  'noLabelChangesAfterFirstPrediction',
  'noThresholdChangesAfterFirstPrediction',
  'noRuntimeChangesBetweenDatasetLockAndFirstRun',
  'firstResultMustBeArchivedWhetherPassOrFail',
  'afterFirstRunDatasetBecomesRepairRegressionOnly',
  'passDoesNotAuthorizeDefaultPromotion',
  'failDoesNotAuthorizeThresholdRelaxation'
 ])assert.equal(policy[key],true,key);
});

test('v0.2C gate thresholds exactly match the previously established gate',()=>{
 const gate=JSON.parse(readFileSync(new URL('../benchmark/phase-gate-v0.2a.json',import.meta.url),'utf8'));
 assert.deepEqual(protocol.gate.thresholds,gate.thresholds);
});
