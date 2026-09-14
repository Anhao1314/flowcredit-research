import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {retrievalVersion} from './layer.js';

// K=8 is the frozen Top-K of the registered phase gate, so it must be reported
// as a first-class recall point rather than only inside the sweep table.
export const retrievalRecallKs=[1,3,5,8,10];
export const retrievalTopKs=[1,3,5,8,10,20];
export const retrievalFailureKinds=['RETRIEVAL_MISS','MODEL_SELECTION_ERROR','PARSER_ERROR','VALIDATOR_REJECT','PROVIDER_TIMEOUT'];
export function rate(numerator,denominator){return {numerator,denominator,rate:denominator?numerator/denominator:null};}
export function stats(values){
 const list=values.filter(value=>Number.isFinite(value)).sort((a,b)=>a-b);
 if(!list.length)return {count:0,median:null,p95:null,min:null,max:null,total:null,mean:null};
 const at=fraction=>list[Math.min(list.length-1,Math.ceil(list.length*fraction)-1)];
 return {count:list.length,median:at(0.5),p95:at(0.95),min:list[0],max:list.at(-1),total:list.reduce((total,value)=>total+value,0),mean:list.reduce((total,value)=>total+value,0)/list.length};
}
export function firstRelevantRank(expectedSpanIds,results){
 const expected=new Set(expectedSpanIds);
 for(const result of results??[]){if(expected.has(result.spanId))return result.finalRank;}
 return null;
}
export function retrievalMetrics({cases,responses}){
 const byCase=new Map(responses.map(response=>[response.caseId,response]));
 const rows=cases.map(entry=>{
  const response=byCase.get(entry.caseId)??null;
  const results=response?.results??[];
  const rank=firstRelevantRank(entry.expectedSpanIds,results);
  return {caseId:entry.caseId,kind:entry.kind,subjectId:entry.subjectId,page:entry.page,question:entry.question,expectedSpanCount:entry.expectedSpanIds.length,expectedInTop:rank!==null,firstRelevantRank:rank,candidateCount:response?.candidateCount??null,visibleCount:response?.visibleCount??null,retrievedCount:results.length,abstained:!!response?.abstained,topScore:results.length?{lexicalScore:results[0].lexicalScore??null,semanticScore:results[0].semanticScore??null,hybridScore:results[0].hybridScore??null}:null,results:results.map(result=>({spanId:result.spanId,finalRank:result.finalRank,lexicalRank:result.lexicalRank,semanticRank:result.semanticRank,lexicalScore:result.lexicalScore??null,semanticScore:result.semanticScore??null,hybridScore:result.hybridScore??null}))};
 });
 const positives=rows.filter(row=>row.expectedSpanCount>0),negatives=rows.filter(row=>row.expectedSpanCount===0);
 const ranked=positives.map(row=>row.firstRelevantRank).filter(rank=>rank!==null);
 const recallAtK={};
 for(const k of retrievalRecallKs)recallAtK['recallAt'+k]=rate(positives.filter(row=>row.firstRelevantRank!==null&&row.firstRelevantRank<=k).length,positives.length);
 const negativeAnalysis={cases:negatives.length,abstained:negatives.filter(row=>row.abstained).length,topSemanticScores:stats(negatives.map(row=>row.topScore?.semanticScore)),topLexicalScores:stats(negatives.map(row=>row.topScore?.lexicalScore)),topLexicalCoverage:stats(negatives.map(row=>row.topScore?.lexicalCoverage))};
 return {version:'span-retrieval-metrics/v1',retrievalVersion,rows,negativeAnalysis,positiveCount:positives.length,negativeCount:negatives.length,recallAtK,mrr:rate(positives.reduce((total,row)=>total+(row.firstRelevantRank?1/row.firstRelevantRank:0),0),positives.length),retrieved:rate(positives.filter(row=>!row.abstained).length,positives.length),misses:positives.filter(row=>row.firstRelevantRank===null||row.firstRelevantRank>Math.max(...retrievalRecallKs)).map(row=>row.caseId),abstainedNegatives:negatives.filter(row=>row.abstained).map(row=>row.caseId),retrievalMisses:positives.filter(row=>row.firstRelevantRank===null).map(row=>({caseId:row.caseId,candidateCount:row.candidateCount,visibleCount:row.visibleCount,retrieved:row.results.map(result=>result.spanId)}))};
}
// Sensitivity only: how the frozen similarity floor trades negative abstention
// against positive recall. Nothing here is tuned on the locked Gold.
export function similaritySensitivity({cases,responses,floors=[0.3,0.4,0.5,0.6,0.7,0.8]}){
 const byCase=new Map(responses.map(response=>[response.caseId,response]));
 return floors.map(floor=>{
  const positives=cases.filter(entry=>entry.expectedSpanIds.length),negatives=cases.filter(entry=>!entry.expectedSpanIds.length);
  const hit=entry=>{
   const response=byCase.get(entry.caseId);
   const results=(response?.results??[]).filter(result=>result.semanticScore===null||result.semanticScore>=floor);
   return results.some(result=>entry.expectedSpanIds.includes(result.spanId));
  };
  return {floor,positiveRecall:rate(positives.filter(hit).length,positives.length),negativeAbstention:rate(negatives.filter(entry=>(byCase.get(entry.caseId)?.results??[]).every(result=>result.semanticScore===null||result.semanticScore<floor)).length,negatives.length)};
 });
}
export function candidateReduction({cases,responses}){
 const before=[],after=[],ratios=[];
 for(const entry of cases){
  const response=responses.find(item=>item.caseId===entry.caseId);
  if(!response||!Number.isFinite(response.candidateCount))continue;
  const from=response.candidateCount,to=response.results.length;
  before.push(from);after.push(to);ratios.push(from?(from-to)/from:null);
 }
 const ratioStats=stats(ratios.filter(value=>value!==null));
 return {cases:before.length,before:stats(before),after:stats(after),candidateReductionRatio:{median:ratioStats.median,p95:ratioStats.p95,min:ratioStats.min,max:ratioStats.max}};
}
export function tokenReduction({before,after}){
 const beforeStats=stats(before),afterStats=stats(after);
 const reduction=beforeStats.count&&afterStats.count&&beforeStats.total!==null&&afterStats.total!==null?(beforeStats.total-afterStats.total)/beforeStats.total:null;
 return {before:beforeStats,after:afterStats,totalReductionRatio:reduction,medianReductionRatio:beforeStats.median&&afterStats.median!==null?(beforeStats.median-afterStats.median)/beforeStats.median:null};
}
export function failureDecomposition({caseRows}){
 const counts=Object.fromEntries(retrievalFailureKinds.map(kind=>[kind,0]));
 const examples=[];
 let succeeded=0;
 for(const row of caseRows){
  if(!row.failure||row.failure==='NONE'){succeeded+=1;continue;}
  counts[row.failure]=(counts[row.failure]??0)+1;
  examples.push({caseId:row.caseId,failure:row.failure,detail:row.detail??null});
 }
 return {counts,succeeded,examples};
}
export function evaluateRetrievalGate({metrics,efficiency,safety,capability,gate}){
 const items={},passed={};
 for(const [name,key] of [['fabricatedSupport','fabricatedSupport'],['sourceSupportFidelity','sourceSupportFidelity'],['falseAccept','falseAccept'],['futureLeakage','futureLeakage'],['wrongSubject','wrongSubject'],['claimMutation','claimMutation']]){
  const expected=gate.safety[key];
  const actual=safety[key];
  items['safety.'+name]={expected,actual,passed:actual===expected};passed['safety.'+name]=actual===expected;
 }
 items['retrieval.goldRetrievalRecallAtK']={expected:'>= '+gate.retrieval.goldRetrievalRecallAtK,actual:metrics.recallAtK['recallAt'+gate.retrieval.k].rate,passed:metrics.recallAtK['recallAt'+gate.retrieval.k].rate!==null&&metrics.recallAtK['recallAt'+gate.retrieval.k].rate>=gate.retrieval.goldRetrievalRecallAtK};
 passed['retrieval.goldRetrievalRecallAtK']=items['retrieval.goldRetrievalRecallAtK'].passed;
 items['efficiency.candidateReductionMedian']={expected:'>= '+gate.efficiency.candidateReductionRatioMedian,actual:efficiency.candidateReductionRatio.median,passed:efficiency.candidateReductionRatio.median!==null&&efficiency.candidateReductionRatio.median>=gate.efficiency.candidateReductionRatioMedian};
 passed['efficiency.candidateReductionMedian']=items['efficiency.candidateReductionMedian'].passed;
 items['efficiency.tokenReductionTotal']={expected:'>= '+gate.efficiency.inputTokenReductionRatio,actual:efficiency.tokens.totalReductionRatio,passed:efficiency.tokens.totalReductionRatio!==null&&efficiency.tokens.totalReductionRatio>=gate.efficiency.inputTokenReductionRatio};
 passed['efficiency.tokenReductionTotal']=items['efficiency.tokenReductionTotal'].passed;
 // Only the retrieval arm is gated: the control arm re-measures the v0.10
 // baseline that the registered gate already tolerates at exactly maxTimeouts.
 const retrievalTimeouts=efficiency.timeouts.retrieval;
 items['efficiency.timeouts']={expected:'< '+gate.efficiency.maxTimeouts,actual:retrievalTimeouts,control:efficiency.timeouts.control,passed:Number.isFinite(retrievalTimeouts)&&retrievalTimeouts<gate.efficiency.maxTimeouts};
 passed['efficiency.timeouts']=items['efficiency.timeouts'].passed;
 for(const key of ['targetSelectionRate','candidateConversionRate']){
  const floor=gate.capability[key];
  const actual=capability[key]??null;
  items['capability.'+key]={expected:'>= '+floor,actual,passed:actual!==null&&actual>=floor};
  passed['capability.'+key]=items['capability.'+key].passed;
 }
 const ordered=Object.entries(passed).sort(([a],[b])=>a.localeCompare(b));
 const failed=ordered.filter(([,value])=>!value).map(([key])=>key);
 return {passed:failed.length===0,failed,items,gateHash:digest(gate)};
}
export function readRetrievalGate(filename=new URL('../eval/local-retrieval/phase-gate.json',import.meta.url)){
 return JSON.parse(readFileSync(filename,'utf8'));
}
