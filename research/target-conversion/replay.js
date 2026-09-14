import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const history=read('../eval/selector-ranking/results.json'),replay=read('../eval/target-conversion/historical-replay.json'),traces=read('../eval/target-conversion/historical-traces.json');
assert.equal(history.decision,'SELECTOR READY');
assert.equal(history.rows.length,16);assert.equal(history.rows.filter(r=>r.targetConverted).length,5);
assert.equal(history.rows.filter(r=>r.candidateFoundAtRank!==null).length,11);
assert.equal(history.rows.filter(r=>r.selectedSpanIds.some(s=>history.rows.find(x=>x.caseId===r.caseId).expectedSpanIds.includes(s))).length,14);
assert.equal(replay.losses.length,9);assert.equal(replay.validButWrongTargetCandidates,6);
for(const row of traces.rows){const old=history.rows.find(r=>r.caseId===row.caseId);assert.equal(row.targetCorrect,old.targetConverted);assert.deepEqual(row.attempts,old.attempts);}
console.log('PASS unchanged historical replay: 15 retrieval / 14 Top-3 / 5 strict / 9 losses / 6 wrong-target Candidates');
