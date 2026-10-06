// Offline agentic investigation loop.
//
// 1. evaluate pair
// 2. if safely abstained, formulate a missing-context question
// 3. retrieve prior comparable evidence from a controlled local Evidence pool
// 4. re-evaluate with the additional context
//
// No Claim mutation and no network/model call occurs.
import {evaluateRelation} from '../relation-runtime/runtime.js';
import {planInvestigation} from './planner.js';
import {retrievePriorComparable} from './local-retriever.js';

function step(type,detail){return Object.freeze({type,...detail});}

export function investigatePair({
 relationInput,material,metric,currentValue,currentPeriodEnd,currentUnit='percent',evidencePool=[]
}={}){
 const trace=[];
 const initial=evaluateRelation({relationInput,material});
 trace.push(step('RELATION_EVALUATED',{receiptId:initial.receiptId,status:initial.processingStatus,relation:initial.relation,reason:initial.reasonCodes?.[0]??null}));
 const plan=planInvestigation(initial,material);
 if(!plan)return Object.freeze({initial,plan:null,retrieved:null,final:initial,state:'NO_INVESTIGATION_REQUIRED',trace:Object.freeze(trace)});

 trace.push(step('INVESTIGATION_PLANNED',{investigationId:plan.investigationId,requirement:plan.requirement,question:plan.question}));
 const retrieved=retrievePriorComparable(plan,{metric,currentPeriodEnd,evidencePool});
 if(!retrieved){
  trace.push(step('CONTEXT_NOT_FOUND',{metric,currentPeriodEnd}));
  return Object.freeze({initial,plan,retrieved:null,final:initial,state:'NEEDS_MORE_EVIDENCE',trace:Object.freeze(trace)});
 }
 trace.push(step('CONTEXT_RETRIEVED',{
  evidenceId:retrieved.evidenceId,metric:retrieved.metric,value:retrieved.value,periodEnd:retrieved.periodEnd,sourceRef:retrieved.sourceRef??null
 }));

 const unit=currentUnit==='percent'?' percent':' '+currentUnit;
 const priorYear=String(retrieved.periodEnd).slice(0,4);
 const currentYear=String(currentPeriodEnd).slice(0,4);
 const augmentedMaterial={
  ...material,
  evidence:{
   ...material.evidence,
   statement:'The comparable '+metric.replaceAll('_',' ')+' was '+retrieved.value+unit+' in '+priorYear+' and '+currentValue+unit+' in '+currentYear+'.'
  }
 };
 const final=evaluateRelation({relationInput,material:augmentedMaterial});
 trace.push(step('RELATION_REEVALUATED',{receiptId:final.receiptId,status:final.processingStatus,relation:final.relation,reason:final.reasonCodes?.[0]??null}));
 return Object.freeze({
  initial,plan,retrieved:Object.freeze({...retrieved}),final,
  state:final.processingStatus==='RESOLVED'?'RESOLVED_AFTER_INVESTIGATION':'NEEDS_MORE_EVIDENCE',
  trace:Object.freeze(trace)
 });
}
