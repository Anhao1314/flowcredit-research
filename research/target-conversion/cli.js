import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {digest} from '../src/identity.js';
import {stats} from '../local-retrieval/eval.js';
import {supportCandidates} from '../evidence-support/layer.js';
import {scoreCase} from '../evidence-support/eval.js';
import {SupportStore} from '../evidence-support/store.js';
import {claimsReader,externalDirectory} from '../analyst-real/cli.js';
import {configuredLocalProvider,withRemoteNetworkGuard} from '../local-model/provider.js';
import {validateSupportV2,validateFactV2} from '../evidence-support/validator.js';
import {createIntent,intentSchema,boundSchema,sidecarSchema,intentVersion,interpretationVersion,promptVersion,promptHash} from './contract.js';
import {contextFor} from './context.js';
import {convertTarget} from './layer.js';
import {runDev} from './dev.js';
import {decide,failureKinds} from './eval.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),artifacts=resolve(root,'research/eval/target-conversion'),runtime=resolve(root,'../fc-agent/research-target-conversion');
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const historyPath=resolve(root,'research/eval/selector-ranking/results.json'),gatePath=resolve(artifacts,'phase-gate.json'),devPath=resolve(artifacts,'development.json');
export function frozenHashes(){const paths=execFileSync('git',['ls-tree','-r','--name-only','c2e4e18','assets','agent/src','research/selector-ranking','research/selection-handles','research/local-retrieval','research/local-model','research/evidence-support','research/grounding','research/analyst-staged','research/admission','research/eval'],{cwd:root,encoding:'utf8'}).trim().split('\n');return Object.fromEntries(paths.map(p=>[p,digest(readFileSync(resolve(root,p),'utf8'))]));}
export function conversionHashes(){return Object.fromEntries(['contract.js','checks.js','domain.js','extraction.js','layer.js','cli.js','eval.js','context.js','research-plan.json'].map(p=>[p,digest(readFileSync(new URL('./'+p,import.meta.url),'utf8'))]));}
export async function preregister(){
 if(existsSync(gatePath)||existsSync(resolve(runtime,'locked/run.json')))throw Error('GATE_ALREADY_FROZEN');
 const development=read(devPath);if(!development.passed||!development.offline)throw Error('DEV_NOT_PASS');
 const oldGate=read(resolve(root,'research/eval/selector-ranking/phase-gate.json'));
 const gate={version:'target-conversion-gate/v0.11.3',registeredAt:new Date().toISOString(),beforeLockedInference:true,intentVersion,interpretationVersion,promptVersion,promptHash,schemaHash:digest({intentSchema,boundSchema,sidecarSchema}),developmentHash:digest(development),historyHash:digest(read(historyPath)),codeHashes:conversionHashes(),frozenHashes:frozenHashes(),model:oldGate.model,asOf:read(resolve(root,'research/eval/local-retrieval/phase-gate.json')).asOf,safety:{fabricatedSupport:0,invalidHandle:0,sourceFidelity:1,falseAccept:0,futureLeakage:0,wrongSubject:0,claimMutation:0,providerTimeout:0,providerError:0},capability:{minimumStrictTargetConversions:10,minimumConditionalTargetConversion:10/14,maximumValidButWrongTargetCandidates:0},rationale:'Independent synthetic fixtures establish source/target checks, abstention and bounded fallback without model calls. Require recommended 10/16 and 10/14 reachable, zero wrong-target Candidates; theoretical ranking ceiling stays 14/16. No post-lock threshold changes.',resourceRule:'Offline development and no real smoke. One interpretation-only locked run over stored v0.11.2 ranked handles. No retrieval/embedding/ranking calls.'};
 save(gatePath,gate);return gate;
}
export async function lockedRun(){
 const gate=read(gatePath),history=read(historyPath),folder=externalDirectory(resolve(runtime,'locked')),path=resolve(folder,'run.json'),context=contextFor(),memory=claimsReader(resolve(root,'../fc-agent/research-memory/v0.2-coreweave.sqlite'));
 if(digest(frozenHashes())!==digest(gate.frozenHashes)||digest(conversionHashes())!==digest(gate.codeHashes)||gate.promptHash!==promptHash||gate.schemaHash!==digest({intentSchema,boundSchema,sidecarSchema})||gate.developmentHash!==digest(read(devPath))||gate.historyHash!==digest(history))throw Error('FROZEN_RUN_DRIFT');
 const binding={gateHash:digest(gate),historyHash:digest(history)},before=memory.read();if(before.claims!==4||before.revisions!==4||before.payloadHash!==history.claimsProtection.after.payloadHash)throw Error('CLAIMS_BASELINE_DRIFT');
 const state=existsSync(path)?read(path):{binding,before,startedAt:new Date().toISOString(),rows:[],receipts:[]};if(digest(state.binding)!==digest(binding))throw Error('RESUME_DRIFT');
 const provider=configuredLocalProvider();
 try{
  await provider.preflight();for(const key of ['model','modelVersion','temperature','contextLength','think','structuredOutputMode'])if(provider.metadata[key]!==gate.model[key])throw Error('MODEL_DRIFT');if(provider.metadata.modelInfo.quantization!=='Q4_K_M')throw Error('MODEL_DRIFT');
  const plan=read(new URL('./research-plan.json',import.meta.url)).requests;
  if(history.rows.length!==16||plan.length!==16)throw Error('LOCKED_CASE_COUNT_DRIFT');
  save(path,state);
  for(const [index,old] of history.rows.entries()){
   if(state.rows.some(r=>r.caseId===old.caseId))continue;
   const entry=context.cases.find(e=>e.caseId===old.caseId),intent=createIntent(plan[index].request,{createdAt:gate.registeredAt}),all=supportCandidates(context.sentences,context.tables,entry),supports=old.retrievedSpanIds.map(id=>{const s=all.find(x=>x.spanId===id);if(!s)throw Error('SUPPORT_DRIFT');return s;}),store=new SupportStore(resolve(folder,old.caseId)),receiptStart=provider.receipts.length,started=performance.now();
   console.log(JSON.stringify({event:'case',caseId:old.caseId,status:'start'}));
   const row={caseId:old.caseId,requestId:plan[index].requestId,intent,rankedHandles:old.rankedHandles,selectedSpanIds:old.selectedSpanIds,retrievedSpanIds:old.retrievedSpanIds,targetInTop3:old.selectedSpanIds.some(id=>old.expectedSpanIds.includes(id)),historicalRankingLatencyMs:old.rankingLatencyMs,candidateFoundAtRank:null,attempts:[]};
   try{
    Object.assign(row,await convertTarget({context,store,provider,supports,rankedHandles:old.rankedHandles,intent,documentId:entry.documentId,asOf:gate.asOf,onProgress:p=>console.log(JSON.stringify({event:'rank',caseId:old.caseId,...p}))}));
    const score=scoreCase(context.annotation.cases.find(a=>a.caseId===old.caseId),{selections:row.attempts.map(a=>({...a,factKind:'financial_metric',proposal:a.proposalId?{validationStatus:'validated'}:null})),errors:[]},{expected:entry.expected});
    row.targetScore=score;row.genericCandidate=row.candidateFoundAtRank!==null;row.targetCorrect=row.genericCandidate&&score.chainCorrect&&old.expectedSpanIds.includes(row.attempts.at(-1).spanId);
    row.failure=row.targetCorrect?'NONE':!row.targetInTop3?(old.retrievedSpanIds.some(id=>old.expectedSpanIds.includes(id))?'RANKING_MISS':'RETRIEVAL_MISS'):row.genericCandidate?'TARGET_MISMATCH':row.attempts.find(a=>old.expectedSpanIds.includes(a.spanId))?.status??row.attempts.at(-1)?.status??'UNKNOWN';
    row.contractFalseAccept=row.attempts.some(a=>a.status==='converted'&&(!validateSupportV2({registry:context.registry,sentenceIndex:context.sentences,tableIndex:context.tables},supports.find(s=>s.spanId===a.spanId),{subjectId:intent.subjectId,documentId:entry.documentId,asOf:gate.asOf}).valid||validateFactV2(supports.find(s=>s.spanId===a.spanId),a.value).status!=='validated'));
    row.fidelity=row.attempts.every(a=>validateSupportV2({registry:context.registry,sentenceIndex:context.sentences,tableIndex:context.tables},supports.find(s=>s.spanId===a.spanId),{subjectId:intent.subjectId,documentId:entry.documentId,asOf:gate.asOf}).valid);
    row.futureLeakage=supports.filter(s=>row.attempts.some(a=>a.spanId===s.spanId)&&s.availableAt>gate.asOf).length;row.wrongSubject=supports.filter(s=>row.attempts.some(a=>a.spanId===s.spanId)&&s.subjectId!==intent.subjectId).length;
   }catch(error){row.failure=error.message==='INVALID_SELECTION_HANDLE'?error.message:'PROVIDER_ERROR';row.error=error.message;row.genericCandidate=false;row.targetCorrect=false;row.fidelity=false;}finally{store.close();}
   row.endToEndLatencyMs=performance.now()-started;row.receipts=provider.receipts.slice(receiptStart);state.receipts.push(...row.receipts);state.rows.push(row);save(path,state);console.log(JSON.stringify({event:'case',caseId:row.caseId,status:'finished',failure:row.failure,targetCorrect:row.targetCorrect}));
  }
  const after=memory.read(),strict=state.rows.filter(r=>r.targetCorrect).length,wrong=state.rows.filter(r=>r.genericCandidate&&!r.targetCorrect).length,reachable=state.rows.filter(r=>r.targetInTop3);
  const metrics={cases:state.rows.length,retrievalCeiling:15,rankingCeiling:14,strictTargetConversion:strict,strictTargetConversionRate:strict/16,strictGivenTop3:{numerator:reachable.filter(r=>r.targetCorrect).length,denominator:14,rate:reachable.filter(r=>r.targetCorrect).length/14},validButWrongTargetCandidates:wrong,genericCandidateConversion:state.rows.filter(r=>r.genericCandidate).length,rankConversion:Object.fromEntries([1,2,3].map(k=>[k,state.rows.filter(r=>r.targetCorrect&&r.candidateFoundAtRank<=k).length]))};
  const safety={fabricatedSupport:state.rows.reduce((n,r)=>n+r.attempts.filter(a=>!r.selectedSpanIds.includes(a.spanId)).length,0),invalidHandle:state.rows.filter(r=>r.failure==='INVALID_SELECTION_HANDLE').length,sourceFidelity:state.rows.every(r=>r.fidelity)?1:0,falseAccept:state.rows.filter(r=>r.genericCandidate&&(!r.targetCorrect||r.contractFalseAccept)).length,futureLeakage:state.rows.reduce((n,r)=>n+(r.futureLeakage??0),0),wrongSubject:state.rows.reduce((n,r)=>n+(r.wrongSubject??0),0),claimMutation:digest(state.before)===digest(after)?0:1,providerTimeout:state.rows.flatMap(r=>r.attempts).filter(a=>a.status==='PROVIDER_TIMEOUT').length,providerError:state.rows.flatMap(r=>r.attempts).filter(a=>a.status==='PROVIDER_ERROR').length+state.rows.filter(r=>r.failure==='PROVIDER_ERROR').length};
  const gateResult=decide({metrics,safety,gate}),sum=k=>state.receipts.every(r=>Number.isFinite(r.usage?.[k]))?state.receipts.reduce((n,r)=>n+r.usage[k],0):null;
  const output={version:'target-conversion-results/v0.11.3',binding,registeredAt:gate.registeredAt,startedAt:state.startedAt,finishedAt:new Date().toISOString(),...gateResult,metrics,safety,provider:provider.metadata,claimsProtection:{before:state.before,after,unchanged:digest(state.before)===digest(after)},latency:{ranking:{historical:true,newModelCalls:0,...stats(state.rows.map(r=>r.historicalRankingLatencyMs))},targetMatchAndInterpretation:{sharedCall:true,...stats(state.rows.flatMap(r=>r.attempts.filter(a=>a.modelLatencyMs>0).map(a=>a.modelLatencyMs)))},targetMatch:'shared with interpretation; no invented separate measurement',interpretation:'shared with target match; one bounded model call per eligible rank',parserValidator:stats(state.rows.flatMap(r=>r.attempts.map(a=>a.parserValidatorLatencyMs))),endToEnd:{excludesFrozenRetrievalAndRanking:true,...stats(state.rows.map(r=>r.endToEndLatencyMs))}},tokens:{calls:state.receipts.length,input:sum('inputTokens'),output:sum('outputTokens'),total:sum('totalTokens')},resource:{offlineDevelopment:true,realSmokeCases:0,realLockedCases:16,retrievalCalls:0,embeddingCalls:0,rankingCalls:0,interpretationCalls:state.receipts.length,modelStartedOnlyAfterGate:true},paidInferenceApiCostUsd:0,paidEmbeddingApiCostUsd:0,paidInferenceApiCalls:0,paidEmbeddingApiCalls:0,failures:Object.fromEntries(failureKinds.map(f=>[f,state.rows.filter(r=>r.failure===f).length])),rows:state.rows};
  save(resolve(artifacts,'results.json'),output);save(path,{...state,finished:true});return {decision:output.decision,metrics,safety,tokens:output.tokens};
 }finally{context.index.close();memory.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv[2];
 if(mode==='dev'){const report=await runDev();save(devPath,report);console.log(JSON.stringify(report,null,2));}
 else if(mode==='register')console.log(JSON.stringify(await preregister(),null,2));
 else if(mode==='locked'&&process.argv[3]==='--opt-in')console.log(JSON.stringify(await withRemoteNetworkGuard(lockedRun),null,2));
 else throw Error('Usage: cli.js dev|register|locked --opt-in; no development model calls');
}
