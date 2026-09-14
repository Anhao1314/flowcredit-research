import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFile,execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {arch,platform,release,totalmem,cpus,homedir} from 'node:os';
import {digest} from '../src/identity.js';
import {RetrievalIndex,defaultIndex} from '../retrieval/index.js';
import {buildGrounding,layoutParserVersion,groundingVersion} from '../grounding/grounding.js';
import {SpanRegistry} from '../grounding/registry.js';
import {locked} from '../analyst-real/eval.js';
import {externalDirectory,claimsReader} from '../analyst-real/cli.js';
import {SentenceSpanIndex,segmentationVersion} from '../evidence-support/sentences.js';
import {TableIndex,supportVersion} from '../evidence-support/support.js';
import {validationVersionV2} from '../evidence-support/validator.js';
import {SupportStore} from '../evidence-support/store.js';
import {EvidenceSupportAnalyst,supportCandidates,renderSupport} from '../evidence-support/layer.js';
import {selectionInstructions,selectionSchema,selectionPromptVersion,interpretationPromptVersion} from '../evidence-support/contract.js';
import {supportCases,annotateGold,runEvaluation,gate} from '../evidence-support/eval.js';
import {buildControlWorkspace,summarizeInjection,defaultPython} from '../evidence-support/controls.js';
import {configuredLocalProvider} from '../local-model/provider.js';
import {futureLeakageOf,scanForbiddenOutput} from '../local-model/eval.js';
import {configuredEmbeddingProvider} from './provider.js';
import {SpanEmbeddingIndex,spanIndexVersion} from './index.js';
import {SpanRetrievalLayer,embedSupports,defaultRetrievalLimit,retrievalText} from './layer.js';
import {spanRenderVersion} from './render.js';
import {lockedRetrievalCases,coreweaveSpanQueries,negativeRetrievalCases,questionHash} from './queries.js';
import {retrievalMetrics,candidateReduction,stats,tokenReduction,retrievalRecallKs,retrievalTopKs,failureDecomposition,evaluateRetrievalGate,readRetrievalGate,retrievalFailureKinds,similaritySensitivity} from './eval.js';
import {assembleHandleRun} from '../selection-handles/assembly.js';
import {classifyCase} from '../selection-handles/eval.js';
import {selectionHandlesPromptVersion} from '../selection-handles/handles.js';

const repository=fileURLToPath(new URL('../../',import.meta.url));
export const defaultResults=resolve(repository,'..','fc-agent','research-local-retrieval');
// Artifacts are committed; a machine-absolute runtime path is not portable and is reported in home-relative form.
export function portablePath(path){const home=homedir();return path===home?'~':path.startsWith(home+'/')?'~'+path.slice(home.length):path;}
export const defaultArtifacts=resolve(repository,'research','eval','local-retrieval');
export const OPT_IN='FC_LOCAL_RETRIEVAL_OPT_IN';
const modes=['preflight','index','benchmark','locked'];
const flagKeys=new Set(['results','artifacts','index','span-index','limit','mode','label','set','topk','model','rebuild','tokens','strategy','resume','selection','gate','arms']);
function parseFlags(argv){
 const flags={};
 for(let n=0;n<argv.length;n+=1){
  const token=argv[n];
  if(token==='--opt-in'){flags.optIn=true;continue;}
  if(token==='--rebuild'){flags.rebuild=true;continue;}
  if(!token.startsWith('--')||!flagKeys.has(token.slice(2)))throw new Error('Invalid explicit option: '+token);
  const key=token.slice(2),value=argv[n+1];
  if(value===undefined||value.startsWith('--'))throw new Error('Option requires a value: '+token);
  if(flags[key]!==undefined)throw new Error('Duplicate option: '+token);
  flags[key]=value;n+=1;
 }
 return flags;
}
function codeHashes(){
 return Object.fromEntries(['provider.js','index.js','render.js','lexical.js','search.js','layer.js','queries.js','eval.js','cli.js','../eval/local-retrieval/phase-gate.json','../evidence-support/layer.js','../evidence-support/validator.js','../evidence-support/contract.js','../evidence-support/support.js','../evidence-support/sentences.js','../evidence-support/eval.js','../evidence-support/controls.js','../local-model/provider.js','../prompts/span-selection-v2.txt','../prompts/fact-interpretation-span-v2.txt'].map(name=>{
  try{return [name,digest(readFileSync(new URL('./'+name,import.meta.url),'utf8'))];}
  catch{return [name,null];}
 }));
}
function rate(values){const list=values.filter(value=>Number.isFinite(value)).sort((a,b)=>a-b);if(!list.length)return {count:0,median:null,p95:null,min:null,max:null};return {count:list.length,median:list[Math.floor((list.length-1)/2)],p95:list[Math.ceil(list.length*0.95)-1],min:list[0],max:list.at(-1)};}
function resourceSample(){
 return new Promise(done=>{
  const finish=()=>done({ollamaRssBytes:null,ollamaProcesses:0,reason:'process listing unavailable'});
  let child;
  try{child=execFile('/bin/ps',['-axo','rss=,comm='],{maxBuffer:8*1024*1024,timeout:5000},(error,stdout)=>{
   if(error||typeof stdout!=='string'){finish();return;}
   let rss=0,count=0;
   for(const line of stdout.split('\n')){
    const match=/^\s*(\d+)\s+(.+)$/.exec(line);
    if(!match)continue;
    if(/(?:^|\/)ollama/.test(match[2])){rss+=Number(match[1])*1024;count+=1;}
   }
   done({ollamaRssBytes:count?rss:null,ollamaProcesses:count});
  });}catch{finish();return;}
  child.on('error',finish);
 });
}
function swapUsedBytes(){
 try{const text=execFileSync('/usr/sbin/sysctl',['-n','vm.swapusage'],{encoding:'utf8'});const match=/used\s*=\s*([\d.]+)([MG])/.exec(text);if(!match)return null;const value=Number(match[1]);return Math.round(value*(match[2]==='G'?1073741824:1048576));}
 catch{return null;}
}
function startSampler({intervalMs=5000}={}){
 const samples=[];
 const tick=async()=>{const sample=await resourceSample();samples.push({at:new Date().toISOString(),...sample,swapUsedBytes:swapUsedBytes()});};
 return {start(){void tick();this.timer=setInterval(()=>{void tick();},intervalMs);},
  async stop(){if(this.timer)clearInterval(this.timer);this.timer=null;await tick();const values=samples.filter(sample=>Number.isFinite(sample.ollamaRssBytes)).map(sample=>sample.ollamaRssBytes);const swaps=samples.map(sample=>sample.swapUsedBytes).filter(value=>Number.isFinite(value));return {samples:samples.length,ollamaRssBytes:{first:values[0]??null,peak:values.length?Math.max(...values):null,last:values.at(-1)??null},swapUsedBytes:{first:swaps[0]??null,peak:swaps.length?Math.max(...swaps):null,last:swaps.at(-1)??null},swapDeltaBytes:swaps.length?swaps.at(-1)-swaps[0]:null};}}};
function hardwareSnapshot(){
 const memory=process.memoryUsage();
 return {platform:platform(),release:release(),arch:arch(),cpuModel:cpus()[0]?.model??null,cpuCount:cpus().length,totalMemoryBytes:totalmem(),node:process.version,process:{rssBytes:memory.rss,heapUsedBytes:memory.heapUsed},swapUsedBytes:swapUsedBytes()};
}
function usageOfReceipts(receipts=[]){
 const list=(receipts??[]).filter(receipt=>receipt.usage);
 const sum=key=>list.length&&list.every(receipt=>Number.isFinite(receipt.usage?.[key]))?list.reduce((total,receipt)=>total+receipt.usage[key],0):null;
 return {calls:list.length,inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),totalTokens:sum('totalTokens'),callLatency:rate(list.map(receipt=>receipt.latencyMs)),tokensPerSecond:rate(list.map(receipt=>receipt.tokensPerSecond)),failureCodes:list.filter(receipt=>receipt.status==='provider_error').map(receipt=>receipt.errorCode)};
}
function usageOf(provider){return usageOfReceipts(provider?.receipts??[]);}
export function scanningProvider(provider,findings){
 if(!provider)return null;
 return {...provider,async analyzeEvidence(input,options){
  const raw=await provider.analyzeEvidence(input,options);
  for(const finding of scanForbiddenOutput(raw))findings.push({finding,phase:/span-selection/.test(input.instructions)?'selection':'interpretation'});
  return raw;
 }};
}
function allSupports({registry,sentences,tables}){
 const supports=[];
 for(const document of registry.documents)for(let page=document.firstPage;page<=document.pageCount;page+=1)supports.push(...supportCandidates(sentences,tables,{documentId:document.id,page}));
 return supports;
}
function retrievalFor({layer,question,entry,subjectId,asOf,timeMode='replay'}){
 return layer.retrieve({supports:entry.supports,query:question,subjectId,asOf,timeMode,caseId:entry.caseId});
}
function decomposeCase({caseRecord,score,expectedSpanIds,retrievalReceipt}){
 const run=caseRecord?.selectionRun??null;
 if(caseRecord?.status==='RETRIEVAL_ABSTAINED')return {failure:'RETRIEVAL_MISS',detail:'retrieval abstained before the model call'};
 if(run?.status==='provider_error')return {failure:'PROVIDER_TIMEOUT',detail:run.error};
 if(retrievalReceipt){
  const retrieved=new Set((retrievalReceipt.results??[]).map(row=>row.spanId));
  if(!expectedSpanIds.some(spanId=>retrieved.has(spanId)))return {failure:'RETRIEVAL_MISS',detail:'expected span never entered the Top-K'};
 }
 if(!score?.targetSelected)return {failure:'MODEL_SELECTION_ERROR',detail:'target span was available but not selected'};
 if(!score.chainParseOnly)return {failure:'PARSER_ERROR',detail:(score.findings??[]).join(',')||'deterministic parse did not reach the expected fact'};
 if(!score.proposalValidated)return {failure:'VALIDATOR_REJECT',detail:(score.findings??[]).join(',')||'validator rejected an otherwise correct chain'};
 return {failure:'NONE',detail:null};
}
function contextCharsFor({supports}){return supports.reduce((total,support)=>total+renderSupport(support).length+2,0);}
function payloadFor({label,limit,retrieval,provider,caseRows,tokens,latency,resource,claimsProtection,extra={}}){
 return {label,extra,retrieval:{version:'span-hybrid-retrieval/v1',mode:retrieval?.mode??'off',limit:limit??null,rendererVersion:spanRenderVersion,indexVersion:spanIndexVersion},provider:provider?.metadata??null,caseRows,tokens,latency,resource,claimsProtection};
}
async function buildContext({env,flags,store,artifacts}){
 const index=new RetrievalIndex(flags.index??env.FC_RETRIEVAL_INDEX??defaultIndex);
 const built=buildGrounding({});
 const registry=new SpanRegistry(built),sentences=new SentenceSpanIndex(registry),tables=new TableIndex(registry);
 const cases=supportCases(registry,index),annotation=annotateGold(registry,sentences,cases);
 return {index,built,registry,sentences,tables,cases,annotation};
}
function measurementOf({result,caseRecords,provider,retrievalReceipts}){
 const scores=result.scores??[],results=result.results??[];
 const rows=scores.map((score,position)=>{
  const caseRecord=caseRecords.get(score.caseId)??null;
  const expected=result.annotationCases?.find(entry=>entry.caseId===score.caseId)?.expectedSpanIds??[];
  const receipt=caseRecord?.retrieval??null;
  const decomposition=decomposeCase({caseRecord,score,expectedSpanIds:expected,retrievalReceipt:receipt});
  return {caseId:score.caseId,failure:decomposition.failure,detail:decomposition.detail,status:results[position]?.status??null,candidateCount:caseRecord?.candidateCount??null,retrievedCount:caseRecord?.retrievedCount??null,selectedCount:score.selectedCount,targetSelected:score.targetSelected,chainCorrect:score.chainCorrect,converted:score.converted,retrievalLatencyMs:receipt?.latencyMs?.total??null,retrievalPhaseMs:receipt?.latencyMs??null,semanticStatus:receipt?.semanticStatus??null,inputTokens:(results[position]?.receipts?.selection?.usage?.inputTokens)??null};
 });
 return {metrics:result.metrics,splits:result.splits,gateResult:result.gateResult,gatePassed:result.gatePassed,failureBreakdown:result.failureBreakdown,claimsProtection:result.claimsProtection,providers:provider,rows,decomposition:failureDecomposition({caseRows:rows}),retrievalMetrics:retrievalReceipts?retrievalMetrics({cases:retrievalReceipts.cases,responses:retrievalReceipts.responses}):null,candidateReduction:retrievalReceipts?candidateReduction({cases:retrievalReceipts.cases,responses:retrievalReceipts.responses}):null};
}
export async function runLocalRetrievalCli(argv=process.argv.slice(2),{env=process.env}={}){
 const [mode,...rest]=argv,flags=parseFlags(rest);
 if(!modes.includes(mode))throw new Error('Usage: cli.js <preflight|index|benchmark|locked> --opt-in [--limit K] [--mode hybrid|lexical|semantic] [--set dev|locked|negatives|all] [--results DIR] [--artifacts DIR] [--span-index PATH] [--rebuild] [--label TEXT]');
 if(!flags.optIn&&env[OPT_IN]!=='1')throw new Error('Explicit opt-in required before local retrieval execution');
 const results=externalDirectory(flags.results??env.FC_LOCAL_RESULTS??defaultResults);
 const artifacts=resolve(flags.artifacts??env.FC_LOCAL_ARTIFACTS??defaultArtifacts);
 mkdirSync(artifacts,{recursive:true});
 const embedding=configuredEmbeddingProvider({env});
 const chat=configuredLocalProvider({env});
 const spanIndexPath=flags.spanIndex??env.FC_SPAN_INDEX??resolve(results,'span-index.sqlite');
 if(mode==='preflight'){
  const embeddingInfo=await embedding.preflight();
  const chatInfo=await chat.preflight();
  const warm=await chat.warmUp();
  const sample=await resourceSample();
  const probe=await embedding.embedMany(['CoreWeave revenue concentration for fiscal year 2025']);
  return {mode,status:'LOCAL_RETRIEVAL_READY',embedding:{info:embeddingInfo,metadata:embedding.metadata,probeDimension:probe[0].length,describe:embedding.describe()},chat:{info:chatInfo,metadata:chat.metadata,describe:chat.describe(),warm},memory:{...sample,swapUsedBytes:swapUsedBytes()}};
 }
 const runFolder=externalDirectory(resolve(results,'session-'+Date.now()));
 const store=new SupportStore(runFolder);
 const findings=[],scanning=scanningProvider(chat,findings);
 let sampler=null,memory=null,control=null;
 try{
  const context=await buildContext({env,flags,store,artifacts});
  const embeddingInfo=await embedding.preflight();
  const spanIndex=new SpanEmbeddingIndex(spanIndexPath);
  if(mode==='index'){
   sampler=startSampler();sampler.start();
   const supports=allSupports(context);
   const started=performance.now();
   const records=await embedSupports({supports,provider:embedding,index:spanIndex,onBatch:event=>progressStream({event:'index',...event})});
   let inserted=0,reused=0;
   for(const record of records){const outcome=spanIndex.put(record);if(outcome.inserted)inserted+=1;else reused+=1;}
   const buildMs=performance.now()-started;
   const resource=await sampler.stop();sampler=null;
   const payload={version:'local-retrieval-index/v0.11',generatedAt:new Date().toISOString(),embedding:{info:embeddingInfo,metadata:embedding.metadata,batches:embedding.receipts.length,batchLatencyMs:rate(embedding.receipts.filter(receipt=>receipt.status==='completed').map(receipt=>receipt.latencyMs)),promptEvalTokens:embedding.receipts.reduce((total,receipt)=>total+(receipt.promptEvalCount??0),0)},index:{path:portablePath(spanIndexPath),records:spanIndex.count(),inserted,reused,models:spanIndex.models().map(row=>({...row})),stale:spanIndex.stale().map(row=>({...row}))},build:{supports:supports.length,buildMs,perSpanMs:buildMs/supports.length,queryTimeRetrieval:'see benchmark mode'},resource,hardware:hardwareSnapshot()};
   writeFileSync(resolve(artifacts,'index-build.json'),JSON.stringify(payload,null,1));
   writeFileSync(resolve(runFolder,'index-build.json'),JSON.stringify(payload,null,1));
   spanIndex.close();
   return {mode,status:'LOCAL_RETRIEVAL_INDEX_OK',artifacts,runFolder,...payload};
  }
  const retrievalMode=flags.mode??'hybrid';
  const limit=Number(flags.limit??defaultRetrievalLimit);
  const layer=new SpanRetrievalLayer({provider:embedding,index:spanIndex,limit,mode:retrievalMode});
  if(mode==='benchmark'){
   const devCases=coreweaveSpanQueries({registry:context.registry,index:context.index,sentences:context.sentences,tables:context.tables});
   const lockedCases=lockedRetrievalCases({registry:context.registry,sentences:context.sentences,cases:context.cases,annotation:context.annotation});
   const negatives=negativeRetrievalCases({registry:context.registry,sentences:context.sentences,tables:context.tables,cases:context.cases,annotation:context.annotation});
   const wanted=flags.set??'all',sets=[];
   if(wanted==='all'||wanted==='dev'){
    sets.push({name:'dev-coreweave-v0.3',cases:devCases});
    sets.push({name:'dev-coreweave-v0.3-answerfree',cases:devCases.map(entry=>({...entry,question:entry.answerFreeQuestion}))});
   }
   if(wanted==='all'||wanted==='locked')sets.push({name:'locked-16',cases:lockedCases});
   if(wanted==='all'||wanted==='negatives')sets.push({name:'negatives',cases:negatives});
   sampler=startSampler();sampler.start();
   const report={version:'local-retrieval-benchmark/v0.11',generatedAt:new Date().toISOString(),embedding:{info:embeddingInfo,metadata:embedding.metadata},retrieval:{version:layer.mode,mode:retrievalMode,limit,rendererVersion:spanRenderVersion,indexVersion:spanIndexVersion,indexRecords:spanIndex.count()},queryTimeMs:[],sets:{}};
   const sweep=(flags.topk??retrievalTopKs.join(',')).split(',').map(Number);
   // The Benchmark scans a wider candidate list and evaluates every Top-K by rank
   // threshold, because the ranking of the first K results is prefix stable.
   const scanLimit=Math.max(limit,...sweep);
   for(const set of sets){
    const byMethod={};
    for(const method of ['lexical','semantic','hybrid']){
     const scoped=new SpanRetrievalLayer({provider:embedding,index:spanIndex,limit:scanLimit,mode:method});
     const responses=[];
     for(const entry of set.cases){
      const supports=supportCandidates(context.sentences,context.tables,{documentId:entry.documentId,page:entry.page});
      const started=performance.now();
      const outcome=await scoped.retrieve({supports,query:entry.question,subjectId:entry.subjectId,asOf:gate.asOf,timeMode:'replay',caseId:entry.caseId});
      report.queryTimeMs.push(performance.now()-started);
      responses.push({caseId:entry.caseId,candidateCount:outcome.candidateCount,visibleCount:outcome.visibleCount,abstained:outcome.abstained,results:outcome.results,filtered:outcome.filtered,latencyMs:outcome.latencyMs});
     }
     byMethod[method]=retrievalMetrics({cases:set.cases,responses});
     byMethod[method].sensitivity=method==='lexical'?[]:similaritySensitivity({cases:set.cases,responses});
    }
    const sweeps={};
    for(const k of sweep)for(const method of ['lexical','semantic','hybrid']){
     const metrics=byMethod[method];
     const hits=metrics.rows.filter(row=>row.expectedSpanCount>0&&row.firstRelevantRank!==null&&row.firstRelevantRank<=k).length;
     sweeps[k+':'+method]={k,method,numerator:hits,denominator:metrics.positiveCount,rate:metrics.positiveCount?hits/metrics.positiveCount:null,misses:metrics.rows.filter(row=>row.expectedSpanCount>0&&(row.firstRelevantRank===null||row.firstRelevantRank>k)).map(row=>row.caseId)};
    }
    const contextBefore=set.cases.reduce((total,entry)=>total+contextCharsFor({supports:supportCandidates(context.sentences,context.tables,{documentId:entry.documentId,page:entry.page})}),0);
    const frozenLayer=new SpanRetrievalLayer({provider:embedding,index:spanIndex,limit,mode:retrievalMode});
    const narrowedChars=await (async()=>{let total=0;for(const entry of set.cases){const supports=supportCandidates(context.sentences,context.tables,{documentId:entry.documentId,page:entry.page});const outcome=await frozenLayer.retrieve({supports,query:entry.question,subjectId:entry.subjectId,asOf:gate.asOf,timeMode:'replay',caseId:entry.caseId});total+=contextCharsFor({supports:outcome.supports});}return total;})();
    report.sets[set.name]={cases:set.cases.length,scanLimit,frozenLimit:limit,methods:byMethod,sweeps,context:{fullChars:contextBefore,retrievedChars:narrowedChars,reductionRatio:contextBefore?(contextBefore-narrowedChars)/contextBefore:null},byCase:byMethod[retrievalMode].rows.map(row=>({caseId:row.caseId,question:row.question,questionHash:questionHash(row.question),expectedSpanCount:row.expectedSpanCount,firstRelevantRank:row.firstRelevantRank,candidateCount:row.candidateCount,retrievedCount:row.retrievedCount,abstained:row.abstained,kind:row.kind}))};
   }
   const resource=await sampler.stop();sampler=null;
   report.queryTimeMs=rate(report.queryTimeMs);
   report.resource=resource;
   report.embedding.receipts=usageOfReceipts(embedding.receipts);
   writeFileSync(resolve(artifacts,'retrieval-benchmark.json'),JSON.stringify(report,null,1));
   writeFileSync(resolve(runFolder,'retrieval-benchmark.json'),JSON.stringify(report,null,1));
   spanIndex.close();
   return {mode,status:'LOCAL_RETRIEVAL_BENCHMARK_OK',artifacts,runFolder,retrieval:report.retrieval,sets:Object.fromEntries(Object.entries(report.sets).map(([name,set])=>[name,{cases:set.cases,recallAtK:set.methods.hybrid.recallAtK,recallAtKByMethod:Object.fromEntries(Object.entries(set.methods).map(([method,metrics])=>[method,metrics.recallAtK])),mrr:Object.fromEntries(Object.entries(set.methods).map(([method,metrics])=>[method,metrics.mrr.rate])),misses:set.methods.hybrid.misses,abstainedNegatives:set.methods.hybrid.abstainedNegatives,context:set.context,sweeps:set.sweeps}])),queryTimeMs:report.queryTimeMs,resource};
  }
  if(mode==='locked')return await runLockedBenchmark({env,flags,artifacts,runFolder,store,context,embedding,chat,scanning,findings,spanIndex,layer,limit,results,memory,sampler});
  throw new Error('Unknown mode: '+mode);
 }finally{control?.close();memory?.close();store.close();}
}
// Per-case token attribution. Receipts are pushed in call order and the analyst
// walks the cases in order, so each case consumes one selection call plus one
// interpretation call per processed selection. The reconstruction is asserted
// against the arm receipt window, so a silent drift would fail the run.
function attributeReceipts({receipts,caseRecords,caseOrder}){
 const attributed=new Map();
 let cursor=0;
 for(const caseId of caseOrder){
  const record=caseRecords.get(caseId);
  const calls=1+((record?.selections??[]).length);
  const slice=receipts.slice(cursor,cursor+calls);
  const usage=usageOfReceipts(slice);
  attributed.set(caseId,usage);
  cursor+=calls;
 }
 return {attributed,consumed:cursor,total:receipts.length};
}
function injectionRunOf({result,entry,promotions}){
 return {caseId:result.caseId,scenario:entry.scenario,page:entry.page,status:result.status,fabricated:result.fabricated??[],selectedSpanIds:result.selectedSpanIds??[],selections:(result.selections??[]).map(selection=>({spanId:selection.spanId,factKind:selection.factKind,supportType:selection.supportType,status:selection.status,findings:selection.findings??[],proposal:selection.proposal?{id:selection.proposal.id,validationStatus:selection.proposal.validationStatus,validationFindings:selection.proposal.validationFindings}:null})),promotions};
}
function phaseLatencyOf({caseRecords}){
 const selection=[],interpretation=[];
 for(const record of caseRecords.values()){
  if(record.selectionRun&&Number.isFinite(record.selectionRun.latencyMs))selection.push(record.selectionRun.latencyMs);
  for(const entry of record.selections??[])if(Number.isFinite(entry.run?.latencyMs))interpretation.push(entry.run.latencyMs);
 }
 return {selection:rate(selection),interpretation:rate(interpretation)};
}
function controlQueryFor(scenario){return scenario==='table_injection'?'synthetic revenue control evidence':'synthetic disclosure controls assessment';}
// A local run can last tens of minutes, so every phase reports progress on
// stderr while stdout stays the machine readable result.
function progressLine(event){
 const at=new Date().toISOString().slice(11,19),seconds=ms=>Number.isFinite(ms)?(ms/1000).toFixed(1)+'s':'-';
 if(event.event==='arm')return at+' [arm] '+event.label+' status='+event.status+(event.note?' '+event.note:'');
 if(event.event==='case')return at+' [case] '+event.position+'/'+event.total+' '+event.caseId+' status='+event.status+' selections='+event.selectedCount+' elapsed='+seconds(event.elapsedMs);
 if(event.event==='start')return at+' [call] '+(event.caseId??'-')+' phase='+event.phase+' candidates='+(event.candidateCount??'-')+' contextChars='+(event.contextChars??'-');
 if(event.event==='end')return at+' [call] '+(event.caseId??'-')+' phase='+event.phase+' status='+event.status+' elapsed='+seconds(event.elapsedMs)+' inputTokens='+(event.inputTokens??'-')+' outputTokens='+(event.outputTokens??'-')+(event.error?' error='+event.error:'');
 if(event.event==='index')return at+' [index] batch '+event.batch+'/'+event.batches+' spans='+event.done+'/'+event.total+' batchMs='+Math.round(event.elapsedMs);
 return at+' '+JSON.stringify(event);
}
export const progressStream=event=>process.stderr.write(progressLine(event)+'\n');
// Resume refuses to reuse an arm unless every frozen input still matches, so a
// resumed artifact chain can never silently mix two configurations.
export function resumeDrift({stored,current}){
 const mismatches=[],compare=(label,left,right)=>{if(left!==right)mismatches.push(label+' '+String(left)+' != '+String(right));};
 compare('goldHash',stored.goldHash,current.goldHash);
 compare('gateHash',stored.gateHash,current.gateHash);
 compare('provider.modelVersion',stored.provider?.modelVersion,current.provider?.modelVersion);
 compare('embedding.modelDigest',stored.embedding?.modelDigest,current.embedding?.modelDigest);
 compare('retrieval.mode',stored.retrieval?.mode,current.retrieval?.mode);
 compare('retrieval.limit',stored.retrieval?.limit,current.retrieval?.limit);
 compare('frozenK',stored.frozenK,current.frozenK);
 for(const [key,value] of Object.entries(current.versions??{}))compare('version.'+key,stored[key],value);
 return mismatches;
}
export function loadArmCheckpoint({label,folder}){
 const read=name=>JSON.parse(readFileSync(resolve(folder,name),'utf8'));
 const raw=read('arm-'+label+'-raw.json'),full=read('arm-'+label+'.json'),extra=full.payload.extra??{};
 const result={runId:raw.runId??extra.runId??null,goldHash:raw.goldHash??extra.goldHash??null,metrics:raw.metrics??extra.metrics??null,splits:raw.splits??extra.splits??null,gateResult:raw.gateResult??extra.gateResult??null,gatePassed:raw.gatePassed??extra.gatePassed??null,failureBreakdown:raw.failureBreakdown??extra.failureBreakdown??null,latency:raw.latency??full.latency??null,claimsProtection:raw.claimsProtection??full.claimsProtection??null,scores:raw.scores??extra.scores??[],results:raw.results??[]};
 return {label,result,payload:full.payload,measurement:full.measurement,caseRows:full.caseRows,tokens:full.tokens,responses:full.responses,attribute:null,injectionRuns:full.injectionRuns,injectionUsage:full.injectionUsage,futureLeakage:full.futureLeakage,resumed:true};
}
// Per-case token comparison. A timed-out call reports no usage, so arm totals
// would compare different case sets (in the locked run: 13 control cases against
// 16 retrieval ones). Only cases with usage in both arms are paired, which is
// also the conservative choice because the control timeouts are the three
// largest prompts. Raw arm totals and counts stay in the artifact for audit.
export function tokenReductionOnMatchedCases({controlArm,retrievalArm}){
 const retrievalTokens=new Map((retrievalArm.payload.caseRows??[]).map(row=>[row.caseId,row.inputTokens]));
 const pairs=(controlArm.payload.caseRows??[]).filter(row=>Number.isFinite(row.inputTokens)&&Number.isFinite(retrievalTokens.get(row.caseId)));
 const reduction=tokenReduction({before:pairs.map(row=>row.inputTokens),after:pairs.map(row=>retrievalTokens.get(row.caseId))});
 return {...reduction,matchedCases:pairs.length,armTotals:{control:controlArm.payload.extra.tokenStats.total,retrieval:retrievalArm.payload.extra.tokenStats.total},armCounts:{control:controlArm.payload.extra.tokenStats.perCase.length,retrieval:retrievalArm.payload.extra.tokenStats.perCase.length}};
}
// Artifacts of a resumed run keep the machine and cost facts of the run that
// actually executed the inference; only the assembly is repeated here.
function readStoredArtifact(artifacts,name){
 try{return JSON.parse(readFileSync(resolve(artifacts,name),'utf8'));}catch{return null;}
}
async function runLockedBenchmark({env,flags,artifacts,runFolder,store,context,embedding,chat,scanning,findings,spanIndex,limit,results}){
 const phaseGate=readRetrievalGate(flags.gate?resolve(flags.gate):undefined);
 if(phaseGate.goldHash!==locked.goldHash)throw new Error('Registered gate Gold hash drift');
 if(flags.limit!==undefined&&Number(flags.limit)!==phaseGate.frozenK)throw new Error('Locked run requires the frozen Top-K from the registered gate');
 if(phaseGate.embedding.model!==embedding.metadata.model||phaseGate.embedding.modelDigest!==embedding.metadata.modelVersion)throw new Error('Embedding model drift against the registered gate');
 const frozenK=phaseGate.frozenK,retrievalMode=phaseGate.fusionMode,retrievalLimit=phaseGate.retrieval.limit??frozenK;
 // v0.11.1: the only experimental variable is the model-facing identity
 // representation. Retrieval, K, fusion, model and prompts' semantic task stay
 // frozen, and the canonical arm is the v0.11 measurement recorded in the gate.
 const selectionInterface=flags.selection??'spans';
 if(!['spans','handles'].includes(selectionInterface))throw new Error('Unknown selection interface: '+selectionInterface);
 const handleRun=selectionInterface==='handles',retrievalLabel=handleRun?'v0.11.1-handles':'v0.11-hybrid';
 const armPlan=(flags.arms??(handleRun?'retrieval':'control,retrieval')).split(',').map(name=>name.trim()).filter(Boolean);
 for(const name of armPlan)if(!['control','retrieval'].includes(name))throw new Error('Unknown arm: '+name);
 if(handleRun&&armPlan.includes('control'))throw new Error('Handle runs reuse the frozen v0.11 canonical arm; do not re-run it');
 if(!armPlan.length)throw new Error('At least one arm required');
 const selectionPromptVersionForRun=handleRun?selectionHandlesPromptVersion:selectionPromptVersion;
 const resumeFolder=flags.resume?externalDirectory(resolve(flags.resume)):null,progress=progressStream;
 const layer=new SpanRetrievalLayer({provider:embedding,index:spanIndex,limit:retrievalLimit,mode:retrievalMode});
 const lockedCases=lockedRetrievalCases({registry:context.registry,sentences:context.sentences,cases:context.cases,annotation:context.annotation});
 // The runtime probe is a loopback GET with no model call, so a resumed run still
 // verifies the provider digest instead of trusting the stored one.
 await chat.preflight();
 if(resumeFolder){
  const stored=JSON.parse(readFileSync(resolve(resumeFolder,'preregistration.json'),'utf8'));
  const drift=resumeDrift({stored,current:{goldHash:locked.goldHash,gateHash:digest(phaseGate),provider:chat.metadata,embedding:{modelDigest:embedding.metadata.modelVersion},retrieval:{mode:retrievalMode,limit:retrievalLimit},frozenK,versions:{layoutParserVersion,groundingVersion,segmentationVersion,supportVersion,validationVersion:validationVersionV2,selectionPromptVersion:selectionPromptVersionForRun,interpretationPromptVersion,spanRenderVersion,spanIndexVersion}}});
  if(drift.length)throw new Error('Resume refused, frozen input drift: '+drift.join('; '));
 }
 // A resumed run does not touch the model, so the machine facts (cold start,
 // model load, runtime sampling) are carried over from the run that did the
 // inference instead of being invented here.
 const storedHardware=resumeFolder?readStoredArtifact(artifacts,'hardware.json'):null;
 const warm=resumeFolder?{coldStartMs:storedHardware?.coldStartMs??null,loadMs:storedHardware?.modelLoadMs??null,note:storedHardware?null:'resumed run: the source run recorded no hardware facts'}:await chat.warmUp();
 let memory=null;
 try{memory=claimsReader(env.FC_RESEARCH_MEMORY_DB??resolve(repository,'..','fc-agent','research-memory','v0.2-coreweave.sqlite'));}catch{memory=null;}
 const preregistration={registeredAt:phaseGate.registeredAt,mode:'locked',beforeLockedEvaluation:true,resumedFrom:resumeFolder??null,selectionInterface,arms:armPlan,layoutParserVersion,groundingVersion,segmentationVersion,supportVersion,validationVersion:validationVersionV2,selectionPromptVersion:selectionPromptVersionForRun,interpretationPromptVersion,spanRenderVersion,spanIndexVersion,codeHashes:codeHashes(),gateHash:digest(phaseGate),goldHash:locked.goldHash,provider:chat.metadata,embedding:{model:embedding.metadata.model,modelDigest:embedding.metadata.modelVersion,dimension:embedding.metadata.dimension},retrieval:{mode:retrievalMode,limit:retrievalLimit,indexRecords:spanIndex.count()},frozenK};
 writeFileSync(resolve(runFolder,'preregistration.json'),JSON.stringify(preregistration,null,1));
 // A resumed run performs no inference, so it neither samples the runtime nor
 // rebuilds the synthetic control workspace: both come from the stored artifacts.
 const sampler=resumeFolder?null:startSampler();
 sampler?.start();
 const control=resumeFolder?null:buildControlWorkspace(resolve(runFolder,'control'),{python:env.FC_GROUNDING_PYTHON??defaultPython(),clock:()=>new Date().toISOString()});
 const caseOrder=context.cases.map(entry=>entry.caseId);
const runArm=async({label,retrieve,retrieveControl})=>{
  if(resumeFolder){progress?.({event:'arm',label,status:'resumed',note:'from '+resolve(resumeFolder)});return loadArmCheckpoint({label,folder:resumeFolder});}
  progress?.({event:'arm',label,status:'started'});
  const armStore=new SupportStore(resolve(runFolder,'arm-'+label));
  const analyst=new EvidenceSupportAnalyst(context.index,context.registry,{sentences:context.sentences,tables:context.tables,store:armStore,provider:scanning,maxSpansPerCase:24,retrieve,onCall:progress,selectionInterface});
  const receiptStart=chat.receipts.length;
  const result=await runEvaluation({registry:context.registry,sentenceIndex:context.sentences,tableIndex:context.tables,index:context.index,analyst,cases:context.cases,annotation:context.annotation,provider:scanning,readClaimsSnapshot:memory?memory.read:null,promote:true,onCase:progress?event=>progress({event:'case',...event}):null});
  const goldReceipts=chat.receipts.slice(receiptStart);
  const caseRecords=new Map(analyst.cases().map(record=>[record.caseId,record]));
  // An arm is tens of minutes of local inference. Persist the raw outcome before
  // any derived bookkeeping so a later failure cannot discard the whole arm.
  writeFileSync(resolve(runFolder,'arm-'+label+'-raw.json'),JSON.stringify({label,runId:result.runId,goldHash:result.goldHash,metrics:result.metrics,splits:result.splits,gateResult:result.gateResult,gatePassed:result.gatePassed,failureBreakdown:result.failureBreakdown,claimsProtection:result.claimsProtection,latency:result.latency,scores:result.scores,results:result.results,caseRecords:[...caseRecords.values()],receipts:goldReceipts},null,1));
  const attribute=attributeReceipts({receipts:goldReceipts,caseRecords,caseOrder});
  if(attribute.consumed!==attribute.total)throw new Error('Receipt attribution drift: '+attribute.consumed+'/'+attribute.total);
  const responses=lockedCases.map(entry=>{
   const record=caseRecords.get(entry.caseId)??null;
   const receipt=record?.retrieval??null;
   return receipt?{caseId:entry.caseId,candidateCount:receipt.candidateCount,visibleCount:receipt.visibleCount,abstained:receipt.abstained,results:receipt.results,filtered:receipt.filtered,latencyMs:receipt.latencyMs}:{caseId:entry.caseId,candidateCount:record?.candidateCount??null,visibleCount:null,abstained:record?.status==='RETRIEVAL_ABSTAINED',results:[],filtered:null,latencyMs:null};
  });
  const injectionStart=chat.receipts.length,injectionRuns=[];
  for(const entry of control.cases){
   const controlAnalyst=new EvidenceSupportAnalyst(control.index,control.registry,{sentences:control.sentences,tables:control.tables,store:new SupportStore(resolve(runFolder,'arm-'+label+'-injection')),provider:scanning,maxSpansPerCase:24,retrieve:retrieveControl,selectionInterface});
   const caseResult=await controlAnalyst.analyzeCase({caseId:entry.caseId,documentId:entry.documentId,page:entry.page,subjectId:entry.subjectId,asOf:gate.asOf});
   const promotions=[];
   for(const selection of caseResult.selections??[]){
    if(selection.proposal?.validationStatus!=='validated')continue;
    try{const promoted=controlAnalyst.promote(selection.proposal.id,{asOf:gate.asOf});promotions.push({proposalId:selection.proposal.id,status:'promoted',candidateId:promoted.candidateId,supportCandidateId:promoted.supportCandidateId});}
    catch(error){promotions.push({proposalId:selection.proposal.id,status:'rejected',reason:String(error.message).slice(0,160)});}
   }
   injectionRuns.push(injectionRunOf({result:caseResult,entry,promotions}));
  }
  const injectionUsage=usageOfReceipts(chat.receipts.slice(injectionStart));
  const classify=handleRun?classifyCase:decomposeCase;
  const caseRows=result.scores.map(score=>{
   const expected=context.annotation.cases.find(entry=>entry.caseId===score.caseId).expectedSpanIds;
   const record=caseRecords.get(score.caseId)??null;
   const decomposition=classify({caseRecord:record,score,expectedSpanIds:expected,retrievalReceipt:record?.retrieval??null});
   return {caseId:score.caseId,failure:decomposition.failure,detail:decomposition.detail};
  });
  progress?.({event:'arm',label,status:'finished',note:'cases='+result.scores.length+' timeouts='+caseRows.filter(row=>row.failure==='PROVIDER_TIMEOUT').length});
  const tokenStats=[...attribute.attributed.values()].map(usage=>usage.inputTokens).filter(Number.isFinite);
  const phaseLatencyMs=phaseLatencyOf({caseRecords});
  const inferenceLatency=[...attribute.attributed.values()].flatMap(usage=>usage.callLatency.count?[usage.callLatency.median]:[]);
  const payload=payloadFor({label,limit:retrieve?retrievalLimit:null,retrieval:retrieve?{mode:layer.mode}:null,provider:chat,caseRows:result.scores.map((score,index)=>({caseId:score.caseId,targetSelected:score.targetSelected,chainCorrect:score.chainCorrect,converted:score.converted,selectedCount:score.selectedCount,nonTargetSelections:score.nonTargetSelections,findings:score.findings,endToEndLatencyMs:result.results?.[index]?.endToEndLatencyMs??null,inputTokens:attribute.attributed.get(score.caseId)?.inputTokens??null,calls:attribute.attributed.get(score.caseId)?.calls??null})),tokens:usageOfReceipts(goldReceipts),latency:result.latency,resource:null,claimsProtection:result.claimsProtection,extra:{runId:result.runId,metrics:result.metrics,splits:result.splits,gateResult:result.gateResult,gatePassed:result.gatePassed,failureBreakdown:result.failureBreakdown,goldHash:result.goldHash,scores:result.scores,futureLeakage:futureLeakageOf({results:result.results},{asOf:gate.asOf}),tokenStats:{perCase:tokenStats,median:stats(tokenStats).median,p95:stats(tokenStats).p95,total:tokenStats.reduce((total,value)=>total+value,0)},inferenceLatencyMs:rate(inferenceLatency),phaseLatencyMs,injection:{summary:summarizeInjection({runs:injectionRuns,workspace:control,analyst:null}),usage:injectionUsage,runs:injectionRuns}}});
  const measurement=measurementOf({result:{...result,annotationCases:context.annotation.cases},caseRecords,provider:chat.metadata,retrievalReceipts:retrieve?{cases:lockedCases,responses}:null});
  // Checkpoint the arm immediately: an arm is 40 minutes of local inference and
  // must survive a later failure in the assembly step.
  writeFileSync(resolve(runFolder,'arm-'+label+'.json'),JSON.stringify({label,payload,measurement,caseRows,tokens:usageOfReceipts(goldReceipts),responses,injectionRuns,injectionUsage,metrics:result.metrics,splits:result.splits,gateResult:result.gateResult,latency:result.latency,claimsProtection:result.claimsProtection,futureLeakage:payload.extra.futureLeakage},null,1));
  armStore.close();
  return {label,result,payload,measurement,caseRows,tokens:usageOfReceipts(goldReceipts),responses,attribute,injectionRuns,injectionUsage,futureLeakage:payload.extra.futureLeakage,caseRecords};
 };
 const controlArm=armPlan.includes('control')?await runArm({label:'v0.10-control',retrieve:null,retrieveControl:null}):null;
 const retrievalArm=armPlan.includes('retrieval')?await runArm({label:retrievalLabel,retrieve:async request=>{
  const entry=lockedCases.find(item=>item.caseId===request.caseId);
  if(!entry)throw new Error('Missing retrieval question for '+request.caseId);
  const outcome=await layer.retrieve({supports:request.candidates,query:entry.question,subjectId:request.subjectId,asOf:request.asOf,timeMode:request.timeMode,caseId:request.caseId});
  return {supports:outcome.supports,receipt:outcome.receipt};
 },retrieveControl:async request=>{
  const outcome=await layer.retrieve({supports:request.candidates,query:controlQueryFor(request.caseId==='INJECTION-02'?'narrative_injection':'table_injection'),subjectId:request.subjectId,asOf:request.asOf,timeMode:request.timeMode,caseId:request.caseId});
  return {supports:outcome.supports,receipt:outcome.receipt};
 }}):null;
 const resource=sampler?await sampler.stop():(storedHardware?.resource??{samples:0,ollamaRssBytes:{first:null,peak:null,last:null},swapUsedBytes:{first:null,peak:null,last:null},swapDeltaBytes:null,note:'resumed run: no inference was executed'});
 if(handleRun){
  const assembledHandleRun=assembleHandleRun({arm:retrievalArm,gate:phaseGate,context,embedding,chat,spanIndex,findings,resource,warm,hardware:hardwareSnapshot(),sessionUsage:usageOf(chat)});
  const {resultsPayload:handleResults,comparison:handleComparison,runtimeCosts:handleCosts,hardware:handleHardware,decision:handleDecision,gateResult:handleGateResult,efficiency:handleEfficiency,safety:handleSafety,capability:handleCapability,decomposition:handleDecomposition,invalidHandles}=assembledHandleRun;
  writeFileSync(resolve(artifacts,'results.json'),JSON.stringify(handleResults,null,1));
  writeFileSync(resolve(artifacts,'comparison.json'),JSON.stringify(handleComparison,null,1));
  writeFileSync(resolve(artifacts,'runtime-costs.json'),JSON.stringify(handleCosts,null,1));
  writeFileSync(resolve(artifacts,'hardware.json'),JSON.stringify(handleHardware,null,1));
  writeFileSync(resolve(runFolder,'benchmark.raw.json'),JSON.stringify({preregistration,gate:handleGateResult,decision:handleDecision,arm:retrievalArm.payload,efficiency:handleEfficiency,safety:handleSafety,capability:handleCapability,invalidHandles,decomposition:handleDecomposition,comparison:handleComparison},null,1));
  control?.close();spanIndex.close();
  return {mode:'locked',status:'SELECTION_HANDLES_BENCHMARK_COMPLETE',artifacts,runFolder,decision:handleDecision,gate:handleGateResult,efficiency:handleEfficiency,safety:handleSafety,capability:handleCapability,invalidHandles,decomposition:handleDecomposition,selection:{interface:selectionInterface,promptVersion:selectionPromptVersionForRun},retrieval:{mode:retrievalMode,limit:retrievalLimit,recallAtK:handleResults.retrieval.recallAtK},arm:{targetSelectionRate:handleCapability.targetSelectionRate,candidateConversionRate:handleCapability.candidateConversionRate,tokens:retrievalArm.payload.extra.tokenStats,timeouts:handleEfficiency.timeouts},embedding:handleResults.embedding,forbiddenFindings:findings,resource};
 }
 const assembled=assembleLockedRun({controlArm,retrievalArm,context,phaseGate,embedding,chat,spanIndex,findings,resource,warm,decisions:{ready:'LOCAL HYBRID RETRIEVAL READY',stay:'STAY ON RETRIEVAL',throughput:'LOCAL MODEL THROUGHPUT STILL BLOCKING'}});
 const {resultsPayload,comparison,runtimeCosts,hardware,decision,gateResult,efficiency,safety,capability,decomposition,latencyDecomposition,retrievalMetricsReport}=assembled;
 const lockedRecall=retrievalMetricsReport.recallAtK['recallAt'+phaseGate.retrieval.k],candidateReductionReport=retrievalArm.measurement.candidateReduction;
 writeFileSync(resolve(artifacts,'results.json'),JSON.stringify(resultsPayload,null,1));
 writeFileSync(resolve(artifacts,'comparison.json'),JSON.stringify(comparison,null,1));
 const storedCosts=resumeFolder?readStoredArtifact(artifacts,'runtime-costs.json'):null;
 const runtimeCostsOut=storedCosts?{...runtimeCosts,total:storedCosts.total}:runtimeCosts;
 const hardwareOut=storedHardware?{...storedHardware,endpoint:hardware.endpoint,embeddingEndpoint:hardware.embeddingEndpoint}:hardware;
 writeFileSync(resolve(artifacts,'runtime-costs.json'),JSON.stringify(runtimeCostsOut,null,1));
 writeFileSync(resolve(artifacts,'hardware.json'),JSON.stringify(hardwareOut,null,1));
 writeFileSync(resolve(runFolder,'benchmark.raw.json'),JSON.stringify({preregistration,gate:gateResult,decision,control:controlArm.payload,retrieval:retrievalArm.payload,efficiency,safety,capability,retrievalMetrics:retrievalMetricsReport,comparison},null,1));
 control?.close();spanIndex.close();
 return {mode:'locked',status:'LOCAL_RETRIEVAL_BENCHMARK_COMPLETE',artifacts,runFolder,decision,gate:gateResult,efficiency,safety,capability,retrieval:{mode:retrievalMode,limit:retrievalLimit,recallAtK:lockedRecall,candidateReduction:candidateReductionReport,candidateReductionRatio:candidateReductionReport.candidateReductionRatio},control:{targetSelectionRate:controlArm.result.metrics.targetSelectionRate.rate,candidateConversionRate:controlArm.result.metrics.candidateConversionRate.rate,tokens:controlArm.payload.extra.tokenStats,latency:controlArm.result.latency},retrievalArm:{targetSelectionRate:retrievalArm.result.metrics.targetSelectionRate.rate,candidateConversionRate:retrievalArm.result.metrics.candidateConversionRate.rate,tokens:retrievalArm.payload.extra.tokenStats},decomposition,latencyDecomposition,embedding:resultsPayload.embedding,forbiddenFindings:findings,resource};
}
// Assembly of the locked-run artifacts. It is a pure function of the two finished
// arms so that a mistake here can be caught by an offline test rather than after
// another hour of local inference.
export function assembleLockedRun({controlArm,retrievalArm,context,phaseGate,embedding,chat,spanIndex,findings,resource,decisions,warm}){
 const decomposition={control:failureDecomposition({caseRows:controlArm.caseRows}),retrieval:failureDecomposition({caseRows:retrievalArm.caseRows})};
 const retrievalMetricsReport=retrievalArm.measurement.retrievalMetrics,candidateReductionReport=retrievalArm.measurement.candidateReduction;
 const lockedRecall=retrievalMetricsReport.recallAtK['recallAt'+phaseGate.retrieval.k];
 const efficiency={
  candidateReductionRatio:candidateReductionReport.candidateReductionRatio,
  tokens:tokenReductionOnMatchedCases({controlArm,retrievalArm}),
  timeouts:{control:controlArm.caseRows.filter(row=>row.failure==='PROVIDER_TIMEOUT').length,retrieval:retrievalArm.caseRows.filter(row=>row.failure==='PROVIDER_TIMEOUT').length}
 };
 const safety={fabricatedSupport:retrievalArm.result.metrics.fabricatedSupportRate.numerator,sourceSupportFidelity:retrievalArm.result.metrics.sourceSupportFidelity.rate,falseAccept:retrievalArm.result.metrics.validatorFalseAccepts,futureLeakage:retrievalArm.futureLeakage.count,wrongSubject:retrievalArm.responses.reduce((total,response)=>total+(response.filtered?.wrongSubject??0),0)+retrievalArm.result.metrics.fabricatedSupportRate.numerator*0,claimMutation:retrievalArm.result.claimsProtection.unchanged===true?0:1};
 const capability={targetSelectionRate:retrievalArm.result.metrics.targetSelectionRate.rate,candidateConversionRate:retrievalArm.result.metrics.candidateConversionRate.rate};
 const gateResult=evaluateRetrievalGate({metrics:retrievalMetricsReport,efficiency,safety,capability,gate:phaseGate});
 const decision=gateResult.passed?decisions.ready:(gateResult.failed.some(key=>key==='retrieval.goldRetrievalRecallAtK')?decisions.stay:(gateResult.failed.some(key=>key.startsWith('efficiency.timeout'))?decisions.throughput:decisions.stay));
 const latencyDecomposition={
  indexBuildMs:null,
  retrievalQueryMs:rate(retrievalArm.responses.map(response=>response.latencyMs?.total).filter(Number.isFinite)),
  embeddingQueryMs:rate(retrievalArm.responses.map(response=>response.latencyMs?.semantic).filter(Number.isFinite)),
  lexicalQueryMs:rate(retrievalArm.responses.map(response=>response.latencyMs?.lexical).filter(Number.isFinite)),
  phases:{control:controlArm.payload.extra.phaseLatencyMs,retrieval:retrievalArm.payload.extra.phaseLatencyMs},
  endToEnd:{control:controlArm.result.latency,retrieval:retrievalArm.result.latency}
 };
 const resultsPayload={version:'local-retrieval-results/v0.11',generatedAt:new Date().toISOString(),decision,status:decision,gate:gateResult,embedding:{model:embedding.metadata.model,modelDigest:embedding.metadata.modelVersion,dimension:embedding.metadata.dimension,rendererVersion:spanRenderVersion,indexVersion:spanIndexVersion,indexRecords:spanIndex.count()},retrieval:{mode:phaseGate.fusionMode,limit:phaseGate.retrieval.limit??phaseGate.frozenK,frozenK:phaseGate.frozenK,queryLatencyMs:latencyDecomposition.retrievalQueryMs,embeddingLatencyMs:latencyDecomposition.embeddingQueryMs,perCase:retrievalArm.responses.map(response=>({caseId:response.caseId,candidateCount:response.candidateCount,visibleCount:response.visibleCount,retrievedCount:response.results.length,abstained:response.abstained,latencyMs:response.latencyMs?.total??null,semanticMs:response.latencyMs?.semantic??null,lexicalMs:response.latencyMs?.lexical??null}))},arms:{control:{metrics:controlArm.result.metrics,splits:controlArm.result.splits,failureBreakdown:controlArm.result.failureBreakdown,tokens:controlArm.tokens,latency:controlArm.result.latency,tokensPerCase:controlArm.payload.extra.tokenStats,decomposition:decomposition.control,caseRows:controlArm.caseRows},retrieval:{metrics:retrievalArm.result.metrics,splits:retrievalArm.result.splits,failureBreakdown:retrievalArm.result.failureBreakdown,tokens:retrievalArm.tokens,latency:retrievalArm.result.latency,tokensPerCase:retrievalArm.payload.extra.tokenStats,decomposition:decomposition.retrieval,retrievalMetrics:retrievalMetricsReport,candidateReduction:candidateReductionReport,caseRows:retrievalArm.caseRows}},efficiency,safety,capability,latencyDecomposition,claimsProtection:retrievalArm.result.claimsProtection,futureLeakage:retrievalArm.futureLeakage,injection:{control:{summary:controlArm.payload.extra.injection.summary,usage:controlArm.injectionUsage},retrieval:{summary:retrievalArm.payload.extra.injection.summary,usage:retrievalArm.injectionUsage}},forbiddenFindings:findings,gateWithinV09Thresholds:{passed:controlArm.result.gatePassed,items:controlArm.result.gateResult,candidateConversionThreshold:gate.thresholds.candidateConversion},goldHash:locked.goldHash,cases:retrievalArm.result.scores.map((score,index)=>({caseId:score.caseId,expectedSupportType:score.expectedSupportType,targetSelected:score.targetSelected,numericCorrect:score.numericCorrect,unitCorrect:score.unitCorrect,periodCorrect:score.periodCorrect,categoryCorrect:score.categoryCorrect,chainParseOnly:score.chainParseOnly,chainCorrect:score.chainCorrect,proposalValidated:score.proposalValidated,converted:score.converted,conversionStatus:score.conversionStatus,validatorFalseReject:score.validatorFalseReject,selectedCount:score.selectedCount,nonTargetSelections:score.nonTargetSelections,findings:score.findings,candidateCount:retrievalArm.responses[index]?.candidateCount??null,retrievedCount:retrievalArm.responses[index]?.results?.length??null,inputTokens:retrievalArm.payload.extra.tokenStats.perCase[index]??null,endToEndLatencyMs:retrievalArm.result.results?.[index]?.endToEndLatencyMs??null,status:retrievalArm.result.results?.[index]?.status??null}))};
 const comparison={version:'local-retrieval-comparison/v0.11',generatedAt:new Date().toISOString(),subject:'locked 16 CoreWeave Gold, identical prompts, SourceSpans, SourceSupport, EvidenceProposal contract, Grounded Validator V2 and Candidate conversion; the only experimental variable is retrieval narrowing in front of the selection call',frozen:{v010:{runId:'local-model-v0.10',goldHash:phaseGate.goldHash,targetSelectionRate:0.6875,candidateConversionRate:0.6875,timeouts:3,inputTokens:166630,calls:142,selectionLatencyMs:{median:35566,p95:60000},artifacts:['research/eval/local-model/results.json','research/eval/local-model/comparison.json']}},inSession:{control:controlArm.label,controlTargetSelectionRate:controlArm.result.metrics.targetSelectionRate.rate,controlCandidateConversionRate:controlArm.result.metrics.candidateConversionRate.rate,controlTimeouts:efficiency.timeouts.control,controlInputTokens:controlArm.payload.extra.tokenStats.total,retrievalTargetSelectionRate:retrievalArm.result.metrics.targetSelectionRate.rate,retrievalCandidateConversionRate:retrievalArm.result.metrics.candidateConversionRate.rate,retrievalTimeouts:efficiency.timeouts.retrieval,retrievalInputTokens:retrievalArm.payload.extra.tokenStats.total},table:[['target selection',controlArm.result.metrics.targetSelectionRate.rate,retrievalArm.result.metrics.targetSelectionRate.rate],['table selection',controlArm.result.splits.table.targetSelection.rate,retrievalArm.result.splits.table.targetSelection.rate],['text selection',controlArm.result.splits.text.targetSelection.rate,retrievalArm.result.splits.text.targetSelection.rate],['numeric accuracy',controlArm.result.metrics.numericAccuracy.rate,retrievalArm.result.metrics.numericAccuracy.rate],['unit accuracy',controlArm.result.metrics.unitAccuracy.rate,retrievalArm.result.metrics.unitAccuracy.rate],['period accuracy',controlArm.result.metrics.periodAccuracy.rate,retrievalArm.result.metrics.periodAccuracy.rate],['full chain',controlArm.result.metrics.chainCorrectRate.rate,retrievalArm.result.metrics.chainCorrectRate.rate],['candidate conversion',controlArm.result.metrics.candidateConversionRate.rate,retrievalArm.result.metrics.candidateConversionRate.rate],['fabricated support',controlArm.result.metrics.fabricatedSupportRate.numerator,retrievalArm.result.metrics.fabricatedSupportRate.numerator],['validator false accept',controlArm.result.metrics.validatorFalseAccepts,retrievalArm.result.metrics.validatorFalseAccepts],['validator false reject',controlArm.result.metrics.validatorFalseRejects,retrievalArm.result.metrics.validatorFalseRejects],['timeouts',efficiency.timeouts.control,efficiency.timeouts.retrieval],['input tokens',controlArm.payload.extra.tokenStats.total,retrievalArm.payload.extra.tokenStats.total],['retrieval recall',null,lockedRecall.rate]].map(([metric,control,retrieval])=>({metric,control,retrieval,delta:typeof control==='number'&&typeof retrieval==='number'?retrieval-control:null})),retrieval:{mode:phaseGate.fusionMode,limit:phaseGate.retrieval.limit??phaseGate.frozenK,recallAtK:lockedRecall,retrievalMetrics:retrievalMetricsReport,candidateReduction:candidateReductionReport}};
 const runtimeCosts={version:'local-retrieval-runtime-costs/v0.11',generatedAt:new Date().toISOString(),provider:{provider:chat.metadata.provider,model:chat.metadata.model,modelDigest:chat.metadata.modelVersion,runtime:chat.metadata.runtime},embedding:{provider:embedding.metadata.provider,model:embedding.metadata.model,modelDigest:embedding.metadata.modelVersion,runtime:embedding.metadata.runtime,dimension:embedding.metadata.dimension},paidInferenceApiCostUsd:0,paidInferenceApiCalls:0,paidEmbeddingApiCostUsd:0,paidEmbeddingApiCalls:0,coldStartMs:warm.coldStartMs,modelLoadMs:warm.loadMs,gold:{control:controlArm.tokens,retrieval:retrievalArm.tokens},injection:{control:controlArm.injectionUsage,retrieval:retrievalArm.injectionUsage},total:{session:usageOf(chat)},phases:{control:controlArm.payload.extra.phaseLatencyMs,retrieval:retrievalArm.payload.extra.phaseLatencyMs},resource,note:'Paid inference API cost is zero and paid embedding API cost is zero because no paid inference or embedding API was called. Hardware, electricity, disk and elapsed time are not zero and are reported separately.'};
 const hardware={...hardwareSnapshot(),provider:chat.metadata,embedding:embedding.metadata,endpoint:chat.describe().endpoint,embeddingEndpoint:embedding.describe().endpoint,coldStartMs:warm.coldStartMs,modelLoadMs:warm.loadMs,resource};
 return {resultsPayload,comparison,runtimeCosts,hardware,decision,gateResult,efficiency,safety,capability,decomposition,latencyDecomposition,retrievalMetricsReport};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 runLocalRetrievalCli().then(result=>{console.log(JSON.stringify(result,null,1));}).catch(error=>{console.error(error.stack??error.message);process.exit(1);});
}
