export const failureKinds=['RETRIEVAL_MISS','RANKING_MISS','MODEL_ABSTENTION','INTERPRETATION_ERROR','PARSER_ERROR','VALIDATOR_REJECT','INVALID_SELECTION_HANDLE','PROVIDER_TIMEOUT','PROVIDER_ERROR'];
export function rankingMetrics(rows,{ordered=true,ks=[1,2,3]}={}){
 const positive=rows.filter(r=>r.expectedSpanIds.length),ranks=positive.map(r=>{const at=r.selectedSpanIds.findIndex(id=>r.expectedSpanIds.includes(id));return at<0?null:at+1;});
 const selected=rows.reduce((s,r)=>s+r.selectedSpanIds.length,0),targets=rows.reduce((s,r)=>s+r.selectedSpanIds.filter(id=>r.expectedSpanIds.includes(id)).length,0);
 return {cases:rows.length,positiveCases:positive.length,hitAtK:ordered?Object.fromEntries(ks.map(k=>[k,positive.length?ranks.filter(r=>r!==null&&r<=k).length/positive.length:null])):'unavailable: unordered multi-select',mrr:ordered&&positive.length?ranks.reduce((s,r)=>s+(r?1/r:0),0)/positive.length:ordered?null:'unavailable: unordered multi-select',targetHitRate:positive.length?ranks.filter(Boolean).length/positive.length:null,selectionPrecision:selected?targets/selected:null,totalSelections:selected,targetSelections:targets,nonTargetSelections:selected-targets,averageSelectedHandles:rows.length?selected/rows.length:null,abstentionRate:rows.length?rows.filter(r=>!r.selectedSpanIds.length).length/rows.length:null};
}
export function selectorDecision({baseline,ranked,safety,gate}){
 if(Object.entries(gate.safety).some(([k,v])=>safety[k]!==v))return 'STAY ON SELECTOR CALIBRATION';
 const m=ranked.mrr-baseline.mrr,h=ranked.hitAtK[1]-baseline.hitAtK[1];
 if(m>=gate.value.minimumAbsoluteMrrUplift&&h>=gate.value.minimumAbsoluteHit1Uplift)return 'SELECTOR READY';
 if(baseline.mrr>=ranked.mrr&&baseline.hitAtK[1]>=ranked.hitAtK[1])return 'BYPASS LLM SELECTOR';
 return 'STAY ON SELECTOR CALIBRATION';
}
