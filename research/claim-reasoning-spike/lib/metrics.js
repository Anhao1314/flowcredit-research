// Metric computation for spike relation runs.
export const relations=['SUPPORTS','COUNTERS','NEUTRAL','AMBIGUOUS'];
export function scoreRows(rows){ // rows: [{expected, predicted|null, decidedBy}]
 const n=rows.length;
 const correct=rows.filter(r=>r.predicted===r.expected).length;
 const byClass=Object.fromEntries(relations.map(c=>{
  const subset=rows.filter(r=>r.expected===c);
  const hit=subset.filter(r=>r.predicted===c).length;
  const predicted=rows.filter(r=>r.predicted===c);
  const tp=hit;
  const precision=predicted.length?tp/predicted.length:null;
  const recall=subset.length?tp/subset.length:null;
  const f1=precision!==null&&recall!==null&&precision+recall>0?2*precision*recall/(precision+recall):null;
  return [c,{support:subset.length,tp,precision,recall,f1}];
 }));
 const macroF1=relations.map(c=>byClass[c].f1??0).reduce((a,b)=>a+b,0)/relations.length;
 const coverage=rows.filter(r=>r.predicted!==null).length/n;
 const abstention=rows.filter(r=>r.predicted==='AMBIGUOUS').length/n;
 const falseSupport=rows.filter(r=>r.expected==='COUNTERS'&&r.predicted==='SUPPORTS').length;
 const falseCounter=rows.filter(r=>r.expected==='SUPPORTS'&&r.predicted==='COUNTERS').length;
 const confusion={};
 for(const r of rows){const k=`${r.expected}->${r.predicted??'ABSTAIN'}`;confusion[k]=(confusion[k]||0)+1;}
 return {cases:n,accuracy:correct/n,correct,macroF1,byClass,coverage,abstention,falseSupportRate:falseSupport/n,falseCounterRate:falseCounter/n,confusion};
}
