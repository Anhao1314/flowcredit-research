import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../src/identity.js';
import {RetrievalIndex,defaultIndex} from '../retrieval/index.js';
import {buildGrounding} from '../grounding/grounding.js';
import {SpanRegistry} from '../grounding/registry.js';
import {SentenceSpanIndex} from '../evidence-support/sentences.js';
import {TableIndex} from '../evidence-support/support.js';
import {supportCases,annotateGold,scoreCase} from '../evidence-support/eval.js';
import {supportCandidates} from '../evidence-support/layer.js';
import {SupportStore} from '../evidence-support/store.js';
import {coreweaveSpanQueries,lockedRetrievalCases} from '../local-retrieval/queries.js';
import {configuredLocalProvider,withRemoteNetworkGuard} from '../local-model/provider.js';
import {externalDirectory,claimsReader} from '../analyst-real/cli.js';
import {select,convertRanked} from './layer.js';
import {rankingMetrics,selectorDecision,failureKinds} from './metrics.js';
import {promptVersion,schemaVersion,promptHash} from './contract.js';
import {validateSupportV2,validateFactV2} from '../evidence-support/validator.js';
import {stats} from '../local-retrieval/eval.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const frozenFiles=['research/local-retrieval/layer.js','research/local-retrieval/search.js','research/local-retrieval/lexical.js','research/local-retrieval/provider.js','research/local-retrieval/render.js','research/local-retrieval/queries.js','research/evidence-support/layer.js','research/evidence-support/validator.js','research/evidence-support/support.js','research/evidence-support/proposal.js','research/evidence-support/contract.js','research/selection-handles/handles.js','research/local-model/provider.js','research/selector-ranking/contract.js','research/selector-ranking/layer.js','research/selector-ranking/metrics.js','research/selector-ranking/cli.js','research/selector-ranking/security.js','research/selector-ranking/ranking-output.schema.json'];
const codeHashes=()=>Object.fromEntries(frozenFiles.map(p=>[p,digest(readFileSync(resolve(root,p),'utf8'))]));
const artifact=resolve(root,'research/eval/selector-ranking');
const read=path=>JSON.parse(readFileSync(path,'utf8'));
function save(path,value){writeFileSync(path,JSON.stringify(value,null,2)+'\n');}
function contextFor(){const index=new RetrievalIndex(defaultIndex),registry=new SpanRegistry(buildGrounding({})),sentences=new SentenceSpanIndex(registry),tables=new TableIndex(registry),cases=supportCases(registry,index),annotation=annotateGold(registry,sentences,cases);return {index,registry,sentences,tables,cases,annotation};}
export async function run(mode,{runtime=resolve(root,'../fc-agent/research-selector-ranking'),env=process.env}={}){
 if(!['dev','locked'].includes(mode))throw Error('Usage: cli.js dev|locked --opt-in');
 const folder=externalDirectory(resolve(runtime,mode));mkdirSync(artifact,{recursive:true});
 const context=contextFor(),provider=configuredLocalProvider({env}),memory=claimsReader(resolve(root,'../fc-agent/research-memory/v0.2-coreweave.sqlite'));
 const before=memory.read(),gate=mode==='locked'?read(resolve(artifact,'phase-gate.json')):null;
 const frozenRetrieval=read(resolve(root,'research/eval/local-retrieval/phase-gate.json'));
 const benchmark=read(resolve(root,'research/eval/local-retrieval/retrieval-benchmark.json'));
 const allDev=coreweaveSpanQueries(context),locked=mode==='locked'?lockedRetrievalCases({...context,cases:context.cases,annotation:context.annotation}):[];
 // Page-fallback labels are not exact relevance judgements; retain them only in
 // the audit and exclude them from the primary selector comparison.
 const entries=mode==='dev'?allDev.filter(e=>e.expectedSpanIds.length&&!e.fallback).map(e=>({...e,question:e.answerFreeQuestion})):locked;
 const rankingRows=benchmark.sets[mode==='dev'?'dev-coreweave-v0.3-answerfree':'locked-16'].methods.hybrid.rows;
 const asOf=frozenRetrieval.asOf,policies=mode==='dev'?['retrieval','multi','ranked']:['ranked'];
 const binding={promptVersion,schemaVersion,promptHash,mode,entriesHash:digest(entries),retrievalArtifactHash:digest(benchmark),gateHash:gate?digest(gate):null};
 const receiptFile=resolve(folder,'run.json');
 if(existsSync(receiptFile)&&digest(read(receiptFile).binding)!==digest(binding))throw Error('RESUME_DRIFT');
 let state=existsSync(receiptFile)?read(receiptFile):{binding,registeredAt:new Date().toISOString(),rows:[],receipts:[],before};
 try{
  await provider.preflight();
  if(provider.metadata.model!=='qwen3.5:9b'||provider.metadata.modelInfo.quantization!=='Q4_K_M'||provider.metadata.temperature!==0||provider.metadata.think!==false||provider.metadata.modelVersion!=='6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7'||provider.metadata.contextLength!==8192||provider.describe().format!=='schema')throw Error('FROZEN_MODEL_DRIFT');
  if(gate&&digest(gate.codeHashes)!==digest(codeHashes()))throw Error('FROZEN_CODE_DRIFT');
  if(gate&&(gate.promptHash!==promptHash||gate.promptVersion!==promptVersion||gate.schemaVersion!==schemaVersion||gate.selectedPolicy!=='ranked'||!existsSync(resolve(artifact,'development.json'))||gate.developmentHash!==digest(read(resolve(artifact,'development.json')))))throw Error('POLICY_NOT_FROZEN');
  state.provider=provider.metadata;save(receiptFile,state);
  for(const entry of entries)for(const policy of policies){
   if(state.rows.some(r=>r.caseId===entry.caseId&&r.policy===policy))continue;
   const raw=rankingRows.find(r=>r.caseId===entry.caseId);if(!raw)throw Error('MISSING_RETRIEVAL_RECEIPT');
   const candidates=supportCandidates(context.sentences,context.tables,{documentId:entry.documentId,page:entry.page});
   const supports=raw.results.filter(r=>r.finalRank<=8).sort((a,b)=>a.finalRank-b.finalRank).map(r=>{const support=candidates.find(s=>s.spanId===r.spanId);if(!support)throw Error('CANONICAL_SUPPORT_DRIFT');return support;});
   if(supports.some(s=>s.subjectId!==entry.subjectId||s.availableAt>asOf))throw Error('FROZEN_FILTER_VIOLATION');
   const started=performance.now(),receiptStart=provider.receipts.length,row={caseId:entry.caseId,policy,expectedSpanIds:entry.expectedSpanIds,retrievedSpanIds:supports.map(s=>s.spanId),selectedSpanIds:[],rankingLatencyMs:0,retrievalLatencyMs:null,retrievalLatencyNote:'offline replay: no new retrieval; historical query latency not in ranking artifact',candidateFoundAtRank:null,attempts:[]};
   console.log(JSON.stringify({event:'case',mode,policy,caseId:entry.caseId,status:'start'}));
   try{
    if(!supports.length){row.failure='RETRIEVAL_MISS';}
    else{
     const selection=await select({provider,supports,question:entry.question,subjectId:entry.subjectId,asOf,policy});
     row.selectedSpanIds=selection.selectedSpanIds;row.rankedHandles=selection.rankedHandles;row.rankingLatencyMs=selection.latencyMs;row.raw=selection.raw;row.rankingInputHash=selection.inputHash??null;
     const targetRetrieved=entry.expectedSpanIds.some(id=>row.retrievedSpanIds.includes(id)),targetSelected=entry.expectedSpanIds.some(id=>row.selectedSpanIds.includes(id));
     row.failure=!targetRetrieved?'RETRIEVAL_MISS':!row.selectedSpanIds.length?'MODEL_ABSTENTION':!targetSelected?'RANKING_MISS':'NONE';
     if(mode==='locked'){
      const store=new SupportStore(resolve(folder,entry.caseId));
      try{Object.assign(row,await convertRanked({context,store,provider,selection,supports,entry,asOf,onCall:event=>console.log(JSON.stringify({event:'call',caseId:entry.caseId,...event}))}));}finally{store.close();}
      const gold=context.cases.find(c=>c.caseId===entry.caseId),annotation=context.annotation.cases.find(c=>c.caseId===entry.caseId);
      const selections=row.attempts.map(a=>({...a,status:a.value?'interpreted':a.status,factKind:'financial_metric',proposal:a.proposalId?{validationStatus:'validated'}:null}));
      row.targetScore=scoreCase(annotation,{selections,errors:[]},{expected:gold.expected});
      row.targetConverted=row.targetScore.chainCorrect&&row.attempts.some(a=>a.status==='converted'&&entry.expectedSpanIds.includes(a.spanId));
      if(row.failure==='NONE'&&!row.targetConverted)row.failure=row.attempts.find(a=>entry.expectedSpanIds.includes(a.spanId)&&a.status!=='converted')?.status??'INTERPRETATION_ERROR';
     }
    }
   }catch(error){row.failure=/ABORT|TIMEOUT/.test(error.message)?'PROVIDER_TIMEOUT':failureKinds.includes(error.message)?error.message:'PROVIDER_ERROR';row.error=error.message;}
   row.endToEndLatencyMs=performance.now()-started;
   row.receipts=provider.receipts.slice(receiptStart);state.receipts.push(...row.receipts);state.rows.push(row);save(receiptFile,state);
   console.log(JSON.stringify({event:'case',mode,policy,caseId:entry.caseId,status:'finished',failure:row.failure,selected:row.selectedSpanIds.length}));
  }
  const after=memory.read(),claimsProtection={before:state.before,after,unchanged:digest(state.before)===digest(after)};
  const metrics=Object.fromEntries(policies.map(p=>[p,rankingMetrics(state.rows.filter(r=>r.policy===p).map(r=>p==='retrieval'?{...r,selectedSpanIds:r.retrievedSpanIds}:r),{ordered:p!=='multi',ks:p==='retrieval'?[1,2,3,5,8]:[1,2,3]})]));
  const fidelity=state.rows.every(r=>r.selectedSpanIds.every(id=>r.retrievedSpanIds.includes(id)));
  const safety={invalidHandle:state.rows.filter(r=>r.failure==='INVALID_SELECTION_HANDLE').length,fabricatedCanonicalSupport:state.rows.reduce((n,r)=>n+r.selectedSpanIds.filter(id=>!r.retrievedSpanIds.includes(id)).length,0),sourceFidelity:fidelity?1:0,falseAccept:state.rows.reduce((n,r)=>{const entry=entries.find(e=>e.caseId===r.caseId),supports=supportCandidates(context.sentences,context.tables,entry);return n+r.attempts.filter(a=>{if(a.status!=='converted')return false;const support=supports.find(s=>s.spanId===a.spanId);return !a.proposalId||!a.candidate||!validateSupportV2({registry:context.registry,sentenceIndex:context.sentences,tableIndex:context.tables},support,{subjectId:entry.subjectId,asOf,timeMode:'replay'}).valid||validateFactV2(support,a.value).status!=='validated';}).length;},0),futureLeakage:state.rows.reduce((n,r)=>n+supportCandidates(context.sentences,context.tables,entries.find(e=>e.caseId===r.caseId)).filter(s=>r.selectedSpanIds.includes(s.spanId)&&s.availableAt>asOf).length,0),wrongSubject:state.rows.reduce((n,r)=>n+supportCandidates(context.sentences,context.tables,entries.find(e=>e.caseId===r.caseId)).filter(s=>r.selectedSpanIds.includes(s.spanId)&&s.subjectId!==entries.find(e=>e.caseId===r.caseId).subjectId).length,0),claimMutation:claimsProtection.unchanged?0:1,timeout:state.receipts.filter(r=>r.errorCode&&/ABORT|TIMEOUT/.test(r.errorCode)).length};
  const tokenSum=k=>state.receipts.every(r=>Number.isFinite(r.usage?.[k]))?state.receipts.reduce((s,r)=>s+r.usage[k],0):null;
  const output={version:'selector-ranking/v0.11.2',mode,binding,provider:provider.metadata,metrics,safety,claimsProtection,excludedDevelopmentCases:mode==='dev'?allDev.filter(e=>!e.expectedSpanIds.length||e.fallback).map(e=>({caseId:e.caseId,pageFallback:e.fallback})):[],conversion:mode==='locked'?{targetConverted:state.rows.filter(r=>r.targetConverted).length,rank1:state.rows.filter(r=>r.candidateFoundAtRank===1).length,rankLe2:state.rows.filter(r=>r.candidateFoundAtRank!==null&&r.candidateFoundAtRank<=2).length,rankLe3:state.rows.filter(r=>r.candidateFoundAtRank!==null).length}:null,latency:{ranking:stats(state.rows.filter(r=>r.policy==='ranked').map(r=>r.rankingLatencyMs)),interpretationByRank:Object.fromEntries([1,2,3].map(k=>[k,stats(state.rows.flatMap(r=>r.attempts.filter(a=>a.rank===k).map(a=>a.latencyMs)))])),endToEnd:stats(state.rows.map(r=>r.endToEndLatencyMs)),note:'offline replay excludes retrieval execution; end-to-end covers ranking, interpretation and validation only'},tokens:{calls:state.receipts.length,input:tokenSum('inputTokens'),output:tokenSum('outputTokens'),total:tokenSum('totalTokens')},paidInferenceApiCostUsd:0,paidEmbeddingApiCostUsd:0,paidInferenceApiCalls:0,paidEmbeddingApiCalls:0,rows:state.rows};
  if(mode==='locked'){
   const baselineRows=state.rows.map(r=>({...r,selectedSpanIds:r.retrievedSpanIds}));output.retrievalBaseline=rankingMetrics(baselineRows,{ks:[1,2,3,5,8]});
   const injectionFile=resolve(artifact,'injection.json');output.injection=existsSync(injectionFile)?read(injectionFile):null;
   output.decision=selectorDecision({baseline:output.retrievalBaseline,ranked:metrics.ranked,safety,gate});
   if(!output.injection?.passed||state.rows.length!==16||state.rows.some(r=>r.failure==='PROVIDER_ERROR'))output.decision='STAY ON SELECTOR CALIBRATION';
  }
  save(resolve(artifact,mode==='dev'?'development.json':'results.json'),output);save(receiptFile,{...state,finished:true});
  return {mode,metrics,safety,tokens:output.tokens,conversion:output.conversion,excluded:output.excludedDevelopmentCases,decision:output.decision};
 }finally{memory.close();context.index.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[3]!=='--opt-in')throw Error('Explicit local inference opt-in required');
 console.log(JSON.stringify(await withRemoteNetworkGuard(()=>run(process.argv[2])),null,2));
}
