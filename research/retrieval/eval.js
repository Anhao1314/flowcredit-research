import { readJson } from '../src/schema.js';
export const queries=readJson(new URL('../eval/coreweave/queries.json',import.meta.url));
export function evaluate(layer,items=queries) {
  const report={queries:items.length,positiveQueries:items.filter(q=>q.expected.length).length,negativeQueries:items.filter(q=>!q.expected.length).length,methods:{}};
  for(const mode of ['lexical','semantic','hybrid']) {
    if(mode==='semantic' && !layer.provider){report.methods[mode]={status:'unavailable',reason:'No real embedding provider configured; no fabricated semantic benchmark'};continue;}
    const rows=items.map(item=>{
      const response=layer.search(item.query,{subjectId:item.subjectId,asOf:item.asOf,timeMode:item.timeMode,mode,limit:1000});
      const hits=response.results.map(result=>item.expected.some(expected=>result.chunk.sourceId===expected.sourceId && result.chunk.page===expected.page && (!expected.textIncludes || result.chunk.text.includes(expected.textIncludes))));
      const rank=hits.indexOf(true)+1;
      let valid=0,leakage=0,wrongSubject=0;
      for(const result of response.results.slice(0,5)) {
        const candidate=layer.createCandidate(result.chunkId,{query:item.query,subjectId:item.subjectId,asOf:item.asOf,timeMode:item.timeMode,mode});
        if(candidate.validationStatus==='valid')valid++;
        if(result.chunk.subjectId!==item.subjectId)wrongSubject++;
        if(item.timeMode==='replay' && (result.chunk.availableAt===null || result.chunk.availableAt>response.asOf))leakage++;
        if(item.timeMode==='audit' && (result.chunk.retrievedAt>response.asOf || result.chunk.createdAt>response.asOf))leakage++;
      }
      return {id:item.id,expectedEvidenceIds:item.expectedEvidenceIds??[],expected:item.expected,query:item.query,resultChunkIds:response.results.slice(0,5).map(r=>r.chunkId),firstRelevantRank:rank||null,results:Math.min(5,response.results.length),valid,leakage,wrongSubject,abstained:response.results.length===0};
    });
    const positives=rows.filter(row=>row.expected.length),n=positives.length,returned=rows.reduce((n,row)=>n+row.results,0),valid=rows.reduce((n,row)=>n+row.valid,0);
    const fraction=x=>n?Number((x/n).toFixed(4)):null;
    report.methods[mode]={status:layer.provider?.metadata.kind==='test'?'test_provider_not_real_semantics':mode==='hybrid'?'lexical_only_degraded':'real_document_baseline',recallAt1:fraction(positives.filter(r=>r.firstRelevantRank && r.firstRelevantRank<=1).length),recallAt3:fraction(positives.filter(r=>r.firstRelevantRank && r.firstRelevantRank<=3).length),recallAt5:fraction(positives.filter(r=>r.firstRelevantRank && r.firstRelevantRank<=5).length),mrr:fraction(positives.reduce((n,r)=>n+(r.firstRelevantRank?1/r.firstRelevantRank:0),0)),citationValidityRate:returned?valid/returned:null,futureLeakageRate:returned?rows.reduce((n,r)=>n+r.leakage,0)/returned:0,wrongSubjectRate:returned?rows.reduce((n,r)=>n+r.wrongSubject,0)/returned:0,negativeAbstentions:rows.filter(r=>!r.expected.length && r.abstained).length,returned,rows};
  }
  return report;
}
