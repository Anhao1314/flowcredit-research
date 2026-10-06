import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadBenchmark} from '../benchmark/schema.js';

const lock=JSON.parse(readFileSync(new URL('../benchmark/holdout-v0.2c-dataset-lock.json',import.meta.url),'utf8'));
const protocol=JSON.parse(readFileSync(new URL('../benchmark/holdout-v0.2c-protocol.json',import.meta.url),'utf8'));
const dataset=loadBenchmark(new URL('../benchmark/data/real-sec-fresh-blind-v0.2c.json',import.meta.url));

function gitBlobSha(buffer){
 const bytes=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
 const header=Buffer.from('blob '+bytes.length+'\0');
 return createHash('sha1').update(Buffer.concat([header,bytes])).digest('hex');
}
function blobOf(path){
 return gitBlobSha(readFileSync(new URL('../../'+path,import.meta.url)));
}

test('v0.2C dataset bytes are locked before evaluation',()=>{
 assert.equal(lock.status,'DATASET_LOCKED_NOT_EVALUATED');
 assert.equal(lock.evaluationState.r2ExecutedAgainstDataset,false);
 assert.equal(lock.evaluationState.firstPredictionExists,false);
 assert.equal(lock.evaluationState.scoreExists,false);
 assert.equal(blobOf(lock.datasetPath),lock.datasetGitBlobSha);
 assert.equal(blobOf(lock.protocolPath),lock.protocolGitBlobSha);
});

test('v0.2C dataset obeys the pre-frozen four-issuer 32-case corpus plan',()=>{
 assert.equal(dataset.cases.length,protocol.corpusPlan.totalCases);
 assert.equal(dataset.sources.length,protocol.corpusPlan.issuersRequired);

 const excluded=new Set(protocol.corpusPlan.excludedIssuers);
 for(const source of dataset.sources)assert.ok(!excluded.has(source.issuer),source.issuer);

 const sourceIds=new Set(dataset.sources.map(source=>source.sourceId));
 const perIssuer={};
 const buckets={};
 for(const item of dataset.cases){
  assert.ok(sourceIds.has(item.sourceId),item.caseId);
  perIssuer[item.sourceId]=(perIssuer[item.sourceId]??0)+1;
  buckets[item.bucket]=(buckets[item.bucket]??0)+1;
  assert.equal(item.split,'fresh-blind');
  assert.equal(item.annotation.tier,'locked-blind-single-review');
 }
 for(const count of Object.values(perIssuer))assert.equal(count,protocol.corpusPlan.casesPerIssuer);
 assert.deepEqual(buckets,Object.fromEntries(protocol.corpusPlan.buckets.map(item=>[item.name,item.cases])));
});

test('v0.2C source metadata is primary SEC filing only and uniquely identified',()=>{
 const accessions=new Set();
 for(const source of dataset.sources){
  assert.equal(source.form,'10-K');
  assert.equal(source.evidenceMode,'paraphrased_facts');
  assert.ok(source.url.startsWith('https://www.sec.gov/Archives/edgar/data/'));
  assert.ok(/^\d{10}-\d{2}-\d{6}$/.test(source.accession),source.accession);
  assert.ok(!accessions.has(source.accession),source.accession);
  accessions.add(source.accession);
 }
});

test('v0.2C case composition matches frozen bucket counts exactly',()=>{
 const expected=lock.counts.buckets;
 const actual={};
 for(const item of dataset.cases)actual[item.bucket]=(actual[item.bucket]??0)+1;
 assert.deepEqual(actual,expected);
 assert.equal(Object.values(actual).reduce((a,b)=>a+b,0),32);
});

test('dataset-construction test does not import or execute any candidate evaluator',()=>{
 const source=readFileSync(new URL('./holdout-v0.2c-dataset-lock.test.js',import.meta.url),'utf8');
 const imports=source.split('\n').filter(line=>line.trim().startsWith('import ')).join('\n');
 assert.ok(!/benchmark\/evaluate|scoreBenchmark|evaluateCandidate|candidate-r2/.test(imports));
});
