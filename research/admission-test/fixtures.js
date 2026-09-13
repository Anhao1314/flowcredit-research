import {fixture as retrievalFixture,replay,now} from '../retrieval-test/fixtures.js';
import {openMemory} from '../memory/open.js';
import {AdmissionLayer,candidateHash} from '../admission/layer.js';
import {join} from 'node:path';
export {now,replay};
export function fixture(fn,{allowSystemTest=true}={}) {
 return retrievalFixture(context=>{
  let time=now;const clock=()=>time,memory=openMemory({filename:join(context.folder,'memory.sqlite'),clock}),admission=new AdmissionLayer(context.index,memory,{clock,allowSystemTest});
  const query='customer concentration',chunk=context.layer.searchLexical(query,replay).results[0],candidate=context.layer.createCandidate(chunk.chunkId,{...replay,mode:'lexical',query});
  const stored=context.index.get('candidate',candidate.id),request={candidateHash:candidateHash(stored),subjectId:'synthetic',reviewerType:'system_test',reviewerId:'deterministic-admission-test',reasonCode:'verified_primary_source',note:'Synthetic explicit reviewed primary quotation.'};
  try{return fn({...context,memory,admission,candidate:stored,request,clock,setTime:value=>time=value});}finally{memory.close();}
 });
}
export const numericFact={researchField:'revenue',category:'revenue',metric:'synthetic_revenue',scope:'consolidated_company',rawValue:100,rawUnit:'USD',unit:'USD',normalization:'identity',periodStart:null,periodEnd:'2025-12-31',observedAt:'2025-12-31',confidence:0.9};
