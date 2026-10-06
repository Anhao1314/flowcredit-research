// Deterministic local Evidence-pool retriever used by the offline investigation test.
// It demonstrates the agent loop without introducing a network or model dependency.

const time=value=>{
 const parsed=Date.parse(String(value??''));
 return Number.isFinite(parsed)?parsed:null;
};

export function retrievePriorComparable(plan,{metric,currentPeriodEnd,evidencePool=[]}={}){
 if(plan?.requirement!=='PRIOR_COMPARABLE_RATE')return null;
 const current=time(currentPeriodEnd);
 if(!metric||current===null)return null;
 return evidencePool
  .filter(item=>item&&item.metric===metric&&typeof item.value==='number'&&time(item.periodEnd)!==null&&time(item.periodEnd)<current)
  .sort((a,b)=>time(b.periodEnd)-time(a.periodEnd))[0]??null;
}
