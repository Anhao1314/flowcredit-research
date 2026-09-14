import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSelectionHandles} from '../selection-handles/handles.js';
import {parseRanking,rankingSchema} from '../selector-ranking/contract.js';
import {rankingMetrics,selectorDecision} from '../selector-ranking/metrics.js';
const handles=buildSelectionHandles(Array.from({length:8},(_,i)=>'canonical-'+i));
test('ranked contract resolves order exactly, bounds breadth and allows abstention',()=>{
 assert.deepEqual(parseRanking('{"rankedHandles":["S4","S7","S2"]}',handles).resolved.map(r=>r.spanId),['canonical-3','canonical-6','canonical-1']);
 assert.deepEqual(parseRanking('{"rankedHandles":[]}',handles).resolved,[]);
 for(const raw of [{rankedHandles:['S1','S2','S3','S4']},{rankedHandles:['S1','S1']},{rankedHandles:['s1']},{rankedHandles:['S9']},{rankedHandles:['canonical-0']},{rankedHandles:[' S1']},{rankedHandles:['S1'],confidence:1}])assert.throws(()=>parseRanking(JSON.stringify(raw),handles));
 const schema=rankingSchema(['S1','S2']);assert.deepEqual(schema.properties.rankedHandles.items.enum,['S1','S2']);assert.equal(schema.additionalProperties,false);
});
test('MRR penalizes misses, rank-3 hedging cannot inflate Hit@1 or precision',()=>{
 const rows=[{expectedSpanIds:['target'],selectedSpanIds:['wrong','also-wrong','target']},{expectedSpanIds:['other'],selectedSpanIds:[]}];
 const m=rankingMetrics(rows);assert.equal(m.hitAtK[1],0);assert.equal(m.hitAtK[3],0.5);assert.equal(m.mrr,1/6);assert.equal(m.selectionPrecision,1/3);assert.equal(m.averageSelectedHandles,1.5);assert.equal(m.abstentionRate,0.5);
 assert.match(rankingMetrics(rows,{ordered:false}).mrr,/unavailable/);
});
test('value decision requires both uplifts and every safety gate',()=>{
 const gate={safety:{timeout:0},value:{minimumAbsoluteMrrUplift:0.05,minimumAbsoluteHit1Uplift:0.0625}},baseline={mrr:0.3,hitAtK:{1:0.25}};
 assert.equal(selectorDecision({baseline,ranked:{mrr:0.4,hitAtK:{1:0.375}},safety:{timeout:0},gate}),'SELECTOR READY');
 assert.equal(selectorDecision({baseline,ranked:{mrr:0.3,hitAtK:{1:0.25}},safety:{timeout:0},gate}),'BYPASS LLM SELECTOR');
 assert.equal(selectorDecision({baseline,ranked:{mrr:0.4,hitAtK:{1:0.375}},safety:{timeout:1},gate}),'STAY ON SELECTOR CALIBRATION');
});
