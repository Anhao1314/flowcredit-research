import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFile,execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {arch,platform,release,totalmem,cpus} from 'node:os';
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
import {supportCases,annotateGold,runEvaluation,gate,sanitized} from '../evidence-support/eval.js';
import {buildControlWorkspace,summarizeInjection,defaultPython} from '../evidence-support/controls.js';
import {configuredLocalProvider} from './provider.js';
import {localGate,evaluateLocalGate,comparisonOf,futureLeakageOf,scanForbiddenOutput,decisionOutcomes} from './eval.js';

const repository=fileURLToPath(new URL('../../',import.meta.url));
export const defaultResults=resolve(repository,'..','fc-agent','research-local-model');
export const defaultArtifacts=resolve(repository,'research','eval','local-model');
export const OPT_IN='FC_LOCAL_MODEL_OPT_IN';
const modes=['preflight','smoke','dev','benchmark'];
const flagKeys=new Set(['results','artifacts','index','think','format','model','label','cases','spans','timing']);
function parseFlags(argv){
 const flags={};
 for(let n=0;n<argv.length;n+=1){
  const token=argv[n];
  if(token==='--opt-in'){flags.optIn=true;continue;}
  if(!token.startsWith('--')||!flagKeys.has(token.slice(2)))throw new Error('Invalid explicit option: '+token);
  const key=token.slice(2),value=argv[n+1];
  if(value===undefined||value.startsWith('--'))throw new Error('Option requires a value: '+token);
  if(flags[key]!==undefined)throw new Error('Duplicate option: '+token);
  flags[key]=value;n+=1;
 }
 return flags;
}
function codeHashes(){
 return Object.fromEntries(['provider.js','cli.js','eval.js','HARDWARE_AUDIT.md','../eval/local-model/phase-gate.json','../evidence-support/layer.js','../evidence-support/validator.js','../evidence-support/contract.js','../evidence-support/support.js','../evidence-support/sentences.js','../evidence-support/eval.js','../evidence-support/controls.js','../prompts/span-selection-v2.txt','../prompts/fact-interpretation-span-v2.txt'].map(name=>[name,digest(readFileSync(new URL('./'+name,import.meta.url),'utf8'))]));
}
function rate(values){const list=values.filter(value=>Number.isFinite(value)).sort((a,b)=>a-b);if(!list.length)return {count:0,median:null,p95:null,min:null,max:null};return {count:list.length,median:list[Math.floor((list.length-1)/2)],p95:list[Math.ceil(list.length*0.95)-1],min:list[0],max:list.at(-1)};}
function resourceSample(){
 return new Promise(done=>{
  const finish=()=>done({ollamaRssBytes:null,ollamaProcesses:0,reason:'process listing unavailable'});
  let child;
  try{child=execFile('/bin/ps',['-axo','rss=,comm='],{maxBuffer:8*1024*1024},(error,stdout)=>{
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
  async stop(){if(this.timer)clearInterval(this.timer);this.timer=null;await tick();const values=samples.filter(sample=>Number.isFinite(sample.ollamaRssBytes)).map(sample=>sample.ollamaRssBytes);const swaps=samples.map(sample=>sample.swapUsedBytes).filter(value=>Number.isFinite(value));return {samples:samples.length,ollamaRssBytes:{first:values[0]??null,peak:values.length?Math.max(...values):null,last:values.at(-1)??null},swapUsedBytes:{first:swaps[0]??null,peak:swaps.length?Math.max(...swaps):null,last:swaps.at(-1)??null}};}};
}
function hardwareSnapshot(){
 const runtimeDir=resolve(repository,'..','fc-agent','tools','ollama');
 let runtimeBytes=null,diskFreeBytes=null;
 try{runtimeBytes=Number(execFileSync('/usr/bin/du',['-sk',runtimeDir],{encoding:'utf8'}).trim().split(/\s+/)[0])*1024;}catch{runtimeBytes=null;}
 try{diskFreeBytes=Number(execFileSync('/bin/df',['-k',resolve(repository)],{encoding:'utf8'}).trim().split('\n')[1].split(/\s+/)[3])*1024;}catch{diskFreeBytes=null;}
 let model=null,osVersion=null;
 try{model=execFileSync('/usr/sbin/sysctl',['-n','hw.model'],{encoding:'utf8'}).trim();}catch{model=null;}
 try{osVersion=execFileSync('/usr/bin/sw_vers',['-productVersion'],{encoding:'utf8'}).trim();}catch{osVersion=null;}
 return {platform:platform(),release:release(),arch:arch(),osVersion,hardwareModel:model,cpuModel:cpus()[0]?.model??null,cpuCores:cpus().length,memoryBytes:totalmem(),diskFreeBytes,runtimeDirectory:runtimeDir,runtimeBytes,gpuUtilization:'unavailable'};
}
function scanningProvider(provider,findings){
 let call=0;
 return {metadata:provider.metadata,receipts:provider.receipts,
  preflight:options=>provider.preflight(options),warmUp:options=>provider.warmUp(options),describe:()=>provider.describe?.(),
  async analyzeEvidence(input,options){
   call+=1;
   const phase=input.data?.span?'interpretation':'selection',started=performance.now();
   try{
    const raw=await provider.analyzeEvidence(input,options);
    for(const finding of scanForbiddenOutput(raw))findings.push({finding,phase,caseId:input.data?.document?.id??null,spanId:input.data?.span?.id??null,rawHash:digest(raw)});
    if(process.env.FC_LOCAL_TRACE!=='0')process.stderr.write(`[local] #${call} ${phase} ${Math.round(performance.now()-started)}ms out=${raw.length} chars\n`);
    return raw;
   }catch(error){
    if(process.env.FC_LOCAL_TRACE!=='0')process.stderr.write(`[local] #${call} ${phase} ${Math.round(performance.now()-started)}ms ERROR ${error.message}\n`);
    throw error;
   }
  }};
}
function usageOfReceipts(receipts=[]){
 const list=(receipts??[]).filter(receipt=>receipt.usage);
 const sum=key=>list.length&&list.every(receipt=>Number.isFinite(receipt.usage?.[key]))?list.reduce((total,receipt)=>total+receipt.usage[key],0):null;
 const latencies=list.map(receipt=>receipt.latencyMs);
 const speeds=list.map(receipt=>receipt.tokensPerSecond);
 const failureCodes=list.filter(receipt=>receipt.status==='provider_error').map(receipt=>receipt.errorCode);
 return {calls:list.length,inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),totalTokens:sum('totalTokens'),callLatency:rate(latencies),tokensPerSecond:rate(speeds),failureCodes};
}
function usageOf(provider){return usageOfReceipts(provider?.receipts??[]);}
function phaseStats(runs){
 const group=name=>{const group=runs.filter(run=>run.name===name);const latencies=group.map(run=>run.latencyMs);return {calls:group.length,errors:group.filter(run=>run.status!=='completed').length,latencyMs:rate(latencies)};};
 return {selection:group('selection'),interpretation:group('interpretation')};
}
function analyzeScenario(analyst,entry,{asOf}){
 return analyst.analyzeCase({caseId:entry.caseId,documentId:entry.documentId,page:entry.page,subjectId:entry.subjectId,asOf}).then(result=>{
  const promotions=[];
  for(const selection of result.selections??[]){
   if(selection.proposal?.validationStatus!=='validated')continue;
   if(promotions.some(item=>item.status==='promoted')){promotions.push({proposalId:selection.proposal.id,status:'deferred'});continue;}
   try{const promoted=analyst.promote(selection.proposal.id,{asOf});promotions.push({proposalId:selection.proposal.id,status:'promoted',candidateId:promoted.candidateId,supportCandidateId:promoted.supportCandidateId});}
   catch(error){promotions.push({proposalId:selection.proposal.id,status:'rejected',reason:String(error.message).slice(0,160)});}
  }
  return {caseId:result.caseId,scenario:entry.scenario,page:entry.page,status:result.status,fabricated:result.fabricated??[],selectedSpanIds:result.selectedSpanIds??[],selections:(result.selections??[]).map(selection=>({spanId:selection.spanId,factKind:selection.factKind,supportType:selection.supportType,status:selection.status,findings:selection.findings??[],parse:selection.parse?{status:selection.parse.status,numeric:selection.parse.numeric?{status:selection.parse.numeric.status,normalizedValue:selection.parse.numeric.normalizedValue,rawUnit:selection.parse.numeric.rawUnit}:null,period:selection.parse.period?{status:selection.parse.period.status,end:selection.parse.period.end}:null}:null,proposal:selection.proposal?{id:selection.proposal.id,validationStatus:selection.proposal.validationStatus,validationFindings:selection.proposal.validationFindings}:null})),promotions};
 });
}
function providerFor({env,flags,think}){
 const overrides={};
 if(flags.model)overrides.FC_LOCAL_MODEL=flags.model;
 if(flags.format)overrides.FC_LOCAL_FORMAT=flags.format;
 if(think!==undefined)overrides.FC_LOCAL_THINK=think?'true':'false';
 return configuredLocalProvider({env:{...env,...overrides}});
}
export async function runLocalCli(argv=process.argv.slice(2),{env=process.env,providerFactory=providerFor}={}){
 const [mode,...rest]=argv,flags=parseFlags(rest);
 if(!modes.includes(mode))throw new Error('Usage: cli.js <preflight|smoke|dev|benchmark> --opt-in [--think true|false] [--model TAG] [--results DIR] [--artifacts DIR] [--index PATH] [--label TEXT]');
 if(!flags.optIn&&env[OPT_IN]!=='1')throw new Error('Explicit opt-in required before local model execution');
 const provider=providerFactory({env,flags,think:mode==='preflight'?undefined:(flags.think===undefined?undefined:flags.think==='true')});
 if(mode==='preflight'){
  const info=await provider.preflight();
  const warm=await provider.warmUp();
  const sample=await resourceSample();
  return {mode,status:'LOCAL_MODEL_READY',endpoint:provider.describe().endpoint,info,warm,memory:sample};
 }
 const results=externalDirectory(flags.results??env.FC_LOCAL_RESULTS??defaultResults);
 const artifacts=resolve(flags.artifacts??env.FC_LOCAL_ARTIFACTS??defaultArtifacts);
 mkdirSync(artifacts,{recursive:true});
 const runFolder=externalDirectory(resolve(results,'session-'+Date.now()));
 const store=new SupportStore(runFolder);
 const findings=[],scanning=scanningProvider(provider,findings);
 let control=null,memory=null,sampler=null;
 try{
  const preflight=await provider.preflight();
  const warm=await provider.warmUp();
  try{memory=claimsReader(env.FC_RESEARCH_MEMORY_DB??resolve(repository,'..','fc-agent','research-memory','v0.2-coreweave.sqlite'));}catch{memory=null;}
  sampler=startSampler();sampler.start();
  const preregistration={registeredAt:new Date().toISOString(),mode,beforeLockedEvaluation:true,layoutParserVersion,groundingVersion,segmentationVersion,supportVersion,validationVersion:validationVersionV2,selectionPromptVersion,interpretationPromptVersion,codeHashes:codeHashes(),gateHash:digest(localGate),goldHash:locked.goldHash,provider:provider.metadata};
  writeFileSync(resolve(runFolder,'preregistration.json'),JSON.stringify(preregistration,null,1));
  if(mode==='smoke'){
   control=buildControlWorkspace(runFolder,{python:env.FC_GROUNDING_PYTHON??defaultPython(),clock:()=>new Date().toISOString()});
   const supports=supportCandidates(control.sentences,control.tables,{documentId:control.built.document.id,page:1});
   const started=performance.now();
   const raw=await provider.analyzeEvidence({instructions:selectionInstructions,outputSchema:selectionSchema,data:{subjectId:'synthetic',asOf:localGate.asOf,timeMode:'replay',generatedAt:new Date().toISOString(),document:{id:control.built.document.id,sourceId:control.source.id,page:1},page:1,availableSpanIds:supports.map(support=>support.spanId),context:supports.map(renderSupport).join('\n\n')}},{});
   const latencyMs=performance.now()-started;
   const resource=await sampler.stop();sampler=null;
   return {mode,status:'LOCAL_INFERENCE_SMOKE_OK',endpoint:provider.describe(),preflight,warm,latencyMs,outputHash:digest(raw),outputLength:raw.length,forbiddenFindings:findings,resource,file:null};
  }
  if(mode==='dev'){
   if(flags.think===undefined)throw new Error('Dev calibration requires explicit --think true|false');
   control=buildControlWorkspace(runFolder,{python:env.FC_GROUNDING_PYTHON??defaultPython(),clock:()=>new Date().toISOString()});
   const analyst=new EvidenceSupportAnalyst(control.index,control.registry,{sentences:control.sentences,tables:control.tables,store,provider:scanning,maxSpansPerCase:Number(flags.spans??6)});
   const before=memory?memory.read():null,runs=[];
   for(const entry of control.cases.slice(0,Number(flags.cases??control.cases.length)))runs.push(await analyzeScenario(analyst,{...entry,asOf:gate.asOf},{asOf:gate.asOf}));
   const after=memory?memory.read():null;
   const resource=await sampler.stop();sampler=null;
   const payload={version:'local-model-dev/v0.10',mode,generatedAt:new Date().toISOString(),label:flags.label??null,provider:provider.metadata,preflight,warm,think:flags.think==='true',runtime:{usage:usageOf(provider),phases:phaseStats(store.list('providerRun')),resource},runs,summary:summarizeInjection({runs,workspace:control}),forbiddenFindings:findings,claimsProtection:{before,after,unchanged:before&&after?digest(before)===digest(after):null}};
   const file=resolve(results,'dev-'+Date.now()+'.json');
   writeFileSync(file,JSON.stringify(payload,null,1));
   return {mode,file,status:'LOCAL_DEV_RUN_COMPLETE',think:payload.think,usage:payload.runtime.usage,phases:payload.runtime.phases,resource:payload.runtime.resource,summary:payload.summary,forbiddenFindings:findings,claimsProtection:payload.claimsProtection};
  }
  if(localGate.goldHash!==locked.goldHash)throw new Error('Registered gate Gold hash drift');
  control=buildControlWorkspace(runFolder,{python:env.FC_GROUNDING_PYTHON??defaultPython(),clock:()=>new Date().toISOString()});
  const injectionCaseIds=new Set(control.cases.map(entry=>entry.caseId));
  const injectionReceiptStart=provider.receipts.length;
  const injectionAnalyst=new EvidenceSupportAnalyst(control.index,control.registry,{sentences:control.sentences,tables:control.tables,store,provider:scanning,maxSpansPerCase:24});
  const before=memory?memory.read():null,injectionRuns=[];
  for(const entry of control.cases)injectionRuns.push(await analyzeScenario(injectionAnalyst,{...entry,asOf:gate.asOf},{asOf:gate.asOf}));
  const after=memory?memory.read():null;
  const injectionReceipts=provider.receipts.slice(injectionReceiptStart),injectionRunRecords=store.list('providerRun').filter(run=>injectionCaseIds.has(run.caseId));
  const injectionSummary=summarizeInjection({runs:injectionRuns,workspace:control});
  const injectionSafety={injectionFollowed:injectionSummary.cases.reduce((total,entry)=>total+entry.selectedInjectionSpans,0)+injectionSummary.forbiddenJudgmentFindings,fabricatedSpans:injectionSummary.fabricatedTotal,forbiddenJudgments:injectionSummary.forbiddenJudgmentFindings,secretsRequested:findings.filter(finding=>finding.finding==='SECRET_REQUEST').length,riskVerdicts:findings.filter(finding=>finding.finding==='RISK_VERDICT').length,promptDisclosures:findings.filter(finding=>finding.finding==='PROMPT_DISCLOSURE').length};
  const injectionPayload={version:'local-model-injection/v0.10',mode:'injection',generatedAt:new Date().toISOString(),provider:provider.metadata,hostile:{tableSpans:control.hostileTableSpans,excludedTableSpans:control.excludedTableSpans,textSpans:control.hostileTextSpans},cases:control.cases,runs:injectionRuns,summary:injectionSummary,safety:injectionSafety,usage:usageOfReceipts(injectionReceipts),phases:phaseStats(injectionRunRecords),forbiddenFindings:findings,claimsProtection:{before,after,unchanged:before&&after?digest(before)===digest(after):null}};
  writeFileSync(resolve(artifacts,'injection.json'),JSON.stringify(injectionPayload,null,1));
  writeFileSync(resolve(results,'injection-'+Date.now()+'.json'),JSON.stringify(injectionPayload,null,1));
  const index=new RetrievalIndex(flags.index??defaultIndex);
  const goldReceiptStart=provider.receipts.length;
  try{
   const built=buildGrounding({}),registry=new SpanRegistry(built),sentences=new SentenceSpanIndex(registry),tables=new TableIndex(registry);
   const goldAnalyst=new EvidenceSupportAnalyst(index,registry,{sentences,tables,store,provider:scanning,maxSpansPerCase:24});
   const cases=supportCases(registry,index),annotation=annotateGold(registry,sentences,cases);
   const result=await runEvaluation({registry,sentenceIndex:sentences,tableIndex:tables,index,analyst:goldAnalyst,cases,annotation,provider:scanning,readClaimsSnapshot:memory?memory.read:null,promote:true});
   const futureLeakage=futureLeakageOf(result,{asOf:localGate.asOf});
   const providerRuns=store.list('providerRun').filter(run=>!injectionCaseIds.has(run.caseId)),goldReceipts=provider.receipts.slice(goldReceiptStart),goldUsage=usageOfReceipts(goldReceipts);
   const resource=await sampler.stop();sampler=null;
   const config={endpoint:provider.describe().endpoint,model:provider.metadata.model,modelVersion:provider.metadata.modelVersion,contextLength:provider.metadata.contextLength,think:provider.metadata.think,structuredOutputMode:provider.metadata.structuredOutputMode,modelInfo:provider.metadata.modelInfo,runtime:provider.metadata.runtime,maxSpansPerCase:24,temperature:provider.metadata.temperature};
   const bench={...sanitized(result),futureLeakage,provider:provider.metadata,config};
   const gateResult=evaluateLocalGate({result:bench,injectionSafety});
   const comparison=comparisonOf(bench);
   const withinGate=result.metrics.candidateConversionRate.rate!==null&&result.metrics.candidateConversionRate.rate>=gate.thresholds.candidateConversion;
   const runtimeCosts={version:'local-model-runtime-costs/v0.10',generatedAt:new Date().toISOString(),provider:{provider:provider.metadata.provider,model:provider.metadata.model,modelDigest:provider.metadata.modelVersion,runtime:provider.metadata.runtime},paidInferenceApiCostUsd:0,paidInferenceApiCalls:0,coldStartMs:warm.coldStartMs,modelLoadMs:warm.loadMs,gold:goldUsage,injection:usageOfReceipts(injectionReceipts),total:usageOf(provider),phases:{gold:phaseStats(providerRuns),injection:phaseStats(injectionRunRecords)},resource,note:'Paid inference API cost is zero because no paid inference API was called. Hardware, electricity, disk and elapsed time are not zero and are reported separately. Gold and injection totals are reported separately; total covers both.'};
   const hardware={...hardwareSnapshot(),provider:provider.metadata,endpoint:provider.describe().endpoint,coldStartMs:warm.coldStartMs,modelLoadMs:warm.loadMs,resource};
   const resultsPayload={version:'local-model-results/v0.10',generatedAt:new Date().toISOString(),status:result.status,provider:provider.metadata,config,gate:gateResult,injection:{summary:injectionSummary,safety:injectionSafety},futureLeakage,claimsProtection:result.claimsProtection,metrics:result.metrics,splits:result.splits,failureBreakdown:result.failureBreakdown,tokens:goldUsage,latency:{...result.latency,phases:phaseStats(providerRuns),coldStartMs:warm.coldStartMs,modelLoadMs:warm.loadMs},gateWithinV09Thresholds:{passed:result.gatePassed,items:result.gateResult,candidateConversionThreshold:gate.thresholds.candidateConversion,note:withinGate?'Candidate conversion meets the frozen v0.9 threshold on the local runtime.':'Candidate conversion does not meet the frozen v0.9 threshold on the local runtime.'},annotation:annotation.totals,goldHash:result.goldHash,runId:result.runId,cases:(result.scores??[]).map((score,index)=>({caseId:score.caseId,expectedSupportType:score.expectedSupportType,targetSelected:score.targetSelected,numericCorrect:score.numericCorrect,unitCorrect:score.unitCorrect,periodCorrect:score.periodCorrect,categoryCorrect:score.categoryCorrect,chainParseOnly:score.chainParseOnly,chainCorrect:score.chainCorrect,proposalValidated:score.proposalValidated,converted:score.converted,conversionStatus:score.conversionStatus,validatorFalseReject:score.validatorFalseReject,selectedCount:score.selectedCount,nonTargetSelections:score.nonTargetSelections,findings:score.findings,endToEndLatencyMs:result.results?.[index]?.endToEndLatencyMs??null,status:result.results?.[index]?.status??null}))};
   writeFileSync(resolve(artifacts,'results.json'),JSON.stringify(resultsPayload,null,1));
   writeFileSync(resolve(artifacts,'comparison.json'),JSON.stringify(comparison,null,1));
   writeFileSync(resolve(artifacts,'runtime-costs.json'),JSON.stringify(runtimeCosts,null,1));
   writeFileSync(resolve(artifacts,'hardware.json'),JSON.stringify(hardware,null,1));
   writeFileSync(resolve(runFolder,'benchmark.raw.json'),JSON.stringify({preregistration,injection:injectionPayload,gold:bench,gate:gateResult,usage:{gold:goldUsage,total:usageOf(provider)}},null,1));
   return {mode,status:'LOCAL_BENCHMARK_COMPLETE',artifacts,runFolder,decision:gateResult.decision,safety:gateResult.safety,capability:gateResult.capability,metrics:result.metrics,splits:result.splits,usage:goldUsage,phases:phaseStats(providerRuns),resource,warm,injectionSafety,forbiddenFindings:findings,comparison:comparison.table,gateWithinV09Thresholds:resultsPayload.gateWithinV09Thresholds};
  }finally{index.close();}
 }finally{sampler?.stop().catch(()=>{});memory?.close();control?.close();store.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 runLocalCli().then(result=>{console.log(JSON.stringify(result,null,1));}).catch(error=>{console.error(error.stack??error.message);process.exit(1);});
}
