import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deterministicRelation} from '../claim-reasoning-spike/lib/deterministic.js';
import {layeredDecision,nliDecision,aggregateBundle,LAYERED_POLICY,CALIBRATED_PARAMS} from '../claim-reasoning-spike/lib/hybrid.js';
import {scoreRows} from '../claim-reasoning-spike/lib/metrics.js';
import {freeze} from '../claim-reasoning-spike/cli.js';

const read=relative=>JSON.parse(readFileSync(new URL(`../../research/${relative}`,import.meta.url),'utf8'));
const readText=relative=>readFileSync(new URL(`../../research/${relative}`,import.meta.url),'utf8');
const sha=value=>'sha256:'+createHash('sha256').update(value).digest('hex');

const dev=read('claim-reasoning-spike/dev-set.json');
const prereg=read('claim-reasoning-spike/artifacts/preregistration.json');
const stripComments=source=>source.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').map(line=>line.replace(/\/\/.*$/,'')).join('\n');

test('spike dev set is frozen and matches its preregistration hashes',()=>{
 assert.equal(dev.pairs.length,41);
 assert.equal(dev.bundles.length,4);
 assert.equal(new Set(dev.pairs.map(p=>p.id)).size,41);
 assert.deepEqual(dev.relationTaxonomy,['SUPPORTS','COUNTERS','NEUTRAL','AMBIGUOUS']);
 assert.equal(prereg.hashes['dev-set.json'],sha(readText('claim-reasoning-spike/dev-set.json')));
 assert.equal(prereg.hashes['prompts/claim-relation-spike-v1.txt'],sha(readText('prompts/claim-relation-spike-v1.txt')));
 assert.equal(prereg.hashes['lib/deterministic.js'],sha(readText('claim-reasoning-spike/lib/deterministic.js')));
 assert.equal(prereg.hashes['lib/text.js'],sha(readText('claim-reasoning-spike/lib/text.js')));
 assert.equal(prereg.hashes['nli/run_nli.py'],sha(readText('claim-reasoning-spike/nli/run_nli.py')));
});

test('deterministic relation layer stays domain-general and holds its frozen decisions',()=>{
 for(const file of ['claim-reasoning-spike/lib/deterministic.js','claim-reasoning-spike/lib/text.js']){
  const source=stripComments(readText(file));
  assert.equal(/\.expected\b/.test(source),false,`${file} must not read expected labels`);
  assert.equal(/dev-set|readFileSync|artifacts\//.test(source),false,`${file} must not read benchmark data`);
 }
 const decided=dev.pairs.map(p=>({id:p.id,expected:p.expected,row:deterministicRelation(p.claim,p.evidence)})).filter(x=>x.row);
 // Frozen development-set behaviour: every pair the deterministic layer decides is decided correctly,
 // and the layer decides the same 30 pairs every run.
 assert.equal(decided.length,30);
 for(const {id,expected,row} of decided)assert.equal(row.relation,expected,`${id} deterministic relation drifted`);
});

test('layered hybrid routing follows the documented policy',()=>{
 const det={relation:'COUNTERS',rule:'R1_NUMERIC_COMPARATOR'};
 assert.deepEqual(layeredDecision({det,nliRow:{mnli:{contradiction:0.0},minicheck:0.0},qwenRow:{relation:'SUPPORTS'}}).decidedBy,'deterministic');
 assert.deepEqual(layeredDecision({det:null,nliRow:{mnli:{contradiction:0.95},minicheck:0.0},qwenRow:{relation:'SUPPORTS'}}).decidedBy,'nli-contradiction');
 assert.deepEqual(layeredDecision({det:null,nliRow:{mnli:{contradiction:0.2},minicheck:0.96},qwenRow:{relation:'NEUTRAL'}}).decidedBy,'minicheck-support');
 assert.deepEqual(layeredDecision({det:null,nliRow:{mnli:{contradiction:0.2},minicheck:0.02},qwenRow:{relation:'AMBIGUOUS'}}).decidedBy,'qwen');
 assert.deepEqual(layeredDecision({det:null,nliRow:{mnli:{contradiction:0.2},minicheck:0.02},qwenRow:null}).relation,null);
 assert.equal(LAYERED_POLICY.contradictionGate,0.9);
 assert.equal(LAYERED_POLICY.minicheckSupportGate,0.5);
});

test('nli-only thresholds and metrics helpers behave as documented',()=>{
 const decided=nliDecision({mnli:{entailment:0.1,neutral:0.2,contradiction:0.9},minicheck:0.0},CALIBRATED_PARAMS);
 assert.equal(decided,'COUNTERS');
 const ambiguous=nliDecision({mnli:{entailment:0.45,neutral:0.40,contradiction:0.15},minicheck:0.0},CALIBRATED_PARAMS);
 assert.equal(ambiguous,'AMBIGUOUS');
 assert.equal(aggregateBundle(['SUPPORTS','COUNTERS']),'CONFLICT');
 assert.equal(aggregateBundle(['NEUTRAL','NEUTRAL']),'NO_RELEVANT_EVIDENCE');
 assert.equal(aggregateBundle(['AMBIGUOUS','COUNTERS']),'COUNTER_DOMINANT');
 const scored=scoreRows([{expected:'SUPPORTS',predicted:'SUPPORTS'},{expected:'SUPPORTS',predicted:'COUNTERS'}]);
 assert.equal(scored.accuracy,0.5);
 assert.equal(scored.falseCounterRate,0.5);
});

test('stored spike results stay consistent with the stored provider outputs',()=>{
 const resultsPath='claim-reasoning-spike/artifacts/results.json';
 for(const file of [resultsPath,'claim-reasoning-spike/artifacts/nli-output.json','claim-reasoning-spike/artifacts/qwen-output.json'])assert.ok(existsSync(new URL(`../../research/${file}`,import.meta.url)),`missing ${file}`);
 const results=read(resultsPath);
 const nli=read('claim-reasoning-spike/artifacts/nli-output.json');
 const qwen=read('claim-reasoning-spike/artifacts/qwen-output.json');
 const predicted={deterministic:[],nli:[],qwen:[],hybrid:[]};
 for(const p of dev.pairs){
  const det=deterministicRelation(p.claim,p.evidence);
  const nliRow={minicheck:nli.pairs[p.id].minicheck,mnli:nli.pairs[p.id].mnli,relation:nliDecision({minicheck:nli.pairs[p.id].minicheck,mnli:nli.pairs[p.id].mnli},CALIBRATED_PARAMS)};
  const layered=layeredDecision({det,nliRow,qwenRow:qwen.rows[p.id]});
  predicted.deterministic.push(det?det.relation:null);
  predicted.nli.push(nliRow.relation==='ABSTAIN'?null:nliRow.relation);
  predicted.qwen.push(qwen.rows[p.id].relation);
  predicted.hybrid.push(layered.relation);
 }
 const accuracy=list=>list.filter((v,i)=>v===dev.pairs[i].expected).length/41;
 assert.equal(Number(accuracy(predicted.deterministic).toFixed(6)),Number(results.architectures['deterministic-only'].accuracy.toFixed(6)));
 assert.equal(Number(accuracy(predicted.nli).toFixed(6)),Number(results.architectures['nli-only'].accuracy.toFixed(6)));
 assert.equal(Number(accuracy(predicted.qwen).toFixed(6)),Number(results.architectures['qwen-only'].accuracy.toFixed(6)));
 assert.equal(Number(accuracy(predicted.hybrid).toFixed(6)),Number(results.architectures['hybrid-with-qwen'].accuracy.toFixed(6)));
 assert.equal(results.routing.deterministic+results.routing.qwen+results.routing['nli-contradiction']+results.routing['minicheck-support'],41);
 assert.equal(results.architectures['hybrid-with-qwen'].correct,38);
});

test('spike artifacts carry no paid-API or remote-network evidence',()=>{
 const qwen=read('claim-reasoning-spike/artifacts/qwen-output.json');
 assert.deepEqual(qwen.remoteNetworkAttempts,[]);
 assert.equal(qwen.provider.provider,'ollama');
 assert.equal(qwen.provider.temperature,0);
 assert.equal(qwen.provider.think,false);
 assert.equal(qwen.calls,41);
 assert.equal(Object.values(qwen.rows).filter(row=>row.error).length,0);
});

test('the spike CLI is importable and the preregistration is immutable',()=>{
 assert.throws(()=>freeze(),/PREREGISTRATION_EXISTS/);
});
