import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../src/identity.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const historical=read('research/eval/selector-ranking/historical-metrics.json');
const sources={'v0.11':read('research/eval/local-retrieval/results.json').cases,'v0.11.1':read('research/eval/selection-handles/results.json').cases};
for(const [version,rows] of Object.entries(sources)){
 const h=historical[version];
 for(const row of rows){const saved=h.rows.find(r=>r.caseId===row.caseId);if(saved.selections!==row.selectedCount||saved.targetHit!==row.targetSelected||saved.nonTarget!==row.nonTargetSelections)throw Error('HISTORICAL_METRIC_DRIFT');}
 if(rows.reduce((n,r)=>n+r.selectedCount,0)!==h.selections||rows.reduce((n,r)=>n+r.nonTargetSelections,0)!==h.nonTargetSelections)throw Error('HISTORICAL_TOTAL_DRIFT');
}
const benchmark=read('research/eval/local-retrieval/retrieval-benchmark.json'),output={};
for(const [name,set] of Object.entries(benchmark.sets)){
 if(name==='negatives')continue;
 const rows=set.methods.hybrid.rows,positive=rows.filter(r=>r.expectedSpanCount),ranks=positive.map(r=>r.firstRelevantRank&&r.firstRelevantRank<=8?r.firstRelevantRank:null);
 output[name]={cases:ranks.length,'Hit@K':Object.fromEntries([1,2,3,5,8].map(k=>[k,ranks.filter(r=>r!==null&&r<=k).length/ranks.length])),MRR:ranks.reduce((n,r)=>n+(r?1/r:0),0)/ranks.length,rows:rows.map(r=>({caseId:r.caseId,targetRank:r.firstRelevantRank&&r.firstRelevantRank<=8?r.firstRelevantRank:null,uncappedRank:r.firstRelevantRank}))};
}
if(digest(output)!==digest(read('research/eval/selector-ranking/retrieval-only.json')))throw Error('BASELINE_METRIC_DRIFT');
console.log('PASS historical case counts and offline K=8 Hit@K/MRR recomputation');
// No inference, retrieval, parameter changes, or history rewriting.
