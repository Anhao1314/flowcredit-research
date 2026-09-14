// Composes the spike architectures from stored provider outputs.
// No model calls happen here; the Qwen outputs come from one preregistered run.
export const DEFAULT_PARAMS={tauSupport:0.5,tauCounter:0.5,tauNeutral:0.5,margin:0.0,minicheckVeto:true};
export const CALIBRATED_PARAMS={tauSupport:0.5,tauCounter:0.5,tauNeutral:0.4,margin:0.15,minicheckVeto:true};
// Layered hybrid policy, calibrated on the frozen dev set only (never on the locked 18):
// the NLI evidence is trusted only where it is both specific and near-certain.
export const LAYERED_POLICY={contradictionGate:0.9,minicheckSupportGate:0.5};

export function nliDecision({mnli,minicheck},params=DEFAULT_PARAMS){
 if(!mnli)return 'ABSTAIN';
 const p={SUPPORTS:mnli.entailment,COUNTERS:mnli.contradiction,NEUTRAL:mnli.neutral};
 const order=Object.entries(p).sort((a,b)=>b[1]-a[1]);
 const [top,second]=order;
 if(top[1]<0.5)return 'AMBIGUOUS';
 if(top[1]-second[1]<params.margin)return 'AMBIGUOUS';
 if(top[0]==='SUPPORTS'&&params.minicheckVeto&&minicheck!==null&&minicheck<0.5)return 'AMBIGUOUS';
 if(top[0]==='SUPPORTS'&&top[1]<params.tauSupport)return 'AMBIGUOUS';
 if(top[0]==='COUNTERS'&&top[1]<params.tauCounter)return 'AMBIGUOUS';
 if(top[0]==='NEUTRAL'&&top[1]<params.tauNeutral)return 'AMBIGUOUS';
 return top[0];
}

export function aggregateBundle(relations){
 const has=r=>relations.includes(r);
 if(has('COUNTERS')&&has('SUPPORTS'))return 'CONFLICT';
 if(has('COUNTERS'))return 'COUNTER_DOMINANT';
 if(has('SUPPORTS'))return 'SUPPORT_DOMINANT';
 if(relations.every(r=>r==='NEUTRAL'))return 'NO_RELEVANT_EVIDENCE';
 return 'INSUFFICIENT';
}

export function compose({pairs,deterministic,nli,qwen,params=DEFAULT_PARAMS}){
 return pairs.map(p=>{
  const det=deterministic[p.id]??null;
  if(det&&det.relation)return {id:p.id,expected:p.expected,predicted:det.relation,decidedBy:'deterministic',receipt:det};
  const nliRow=nli[p.id]??null;
  const nliRel=nliRow?.relation??nliDecision(nliRow??{},params);
  const qwenRow=qwen[p.id]??null;
  const hybridNoQwen=nliRel==='ABSTAIN'?null:nliRel;
  const hybridWithQwen=nliRel==='ABSTAIN'?(qwenRow?qwenRow.relation:null):nliRel;
  return {
   id:p.id,expected:p.expected,
   deterministic:null,
   nli:nliRel==='ABSTAIN'?null:nliRel,
   qwen:qwenRow?qwenRow.relation:null,
   hybridNoQwen,
   hybridWithQwen,
   decidedByHybrid:nliRel!=='ABSTAIN'?'nli':(qwenRow?'qwen':'none'),
   nliProbs:nliRow,
   qwenReason:qwenRow?.reason??null
  };
 });
}

// Layered hybrid: deterministic -> high-confidence NLI contradiction / MiniCheck
// textual support -> Qwen fallback for everything else.
export function layeredDecision({det,nliRow,qwenRow,policy=LAYERED_POLICY}){
 if(det&&det.relation)return {relation:det.relation,decidedBy:'deterministic',receipt:det};
 if(nliRow&&nliRow.mnli&&nliRow.mnli.contradiction>=policy.contradictionGate)return {relation:'COUNTERS',decidedBy:'nli-contradiction',receipt:{rule:'L1_NLI_CONTRADICTION',detail:nliRow.mnli.contradiction.toFixed(3)}};
 if(nliRow&&typeof nliRow.minicheck==='number'&&nliRow.minicheck>=policy.minicheckSupportGate)return {relation:'SUPPORTS',decidedBy:'minicheck-support',receipt:{rule:'L2_MINICHECK_SUPPORT',detail:nliRow.minicheck.toFixed(3)}};
 if(qwenRow&&qwenRow.relation)return {relation:qwenRow.relation,decidedBy:'qwen',receipt:{rule:'L3_QWEN_FALLBACK',detail:qwenRow.reason??''}};
 return {relation:null,decidedBy:'none',receipt:null};
}
