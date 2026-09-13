import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../src/identity.js';
import {RetrievalIndex,defaultIndex} from '../retrieval/index.js';
import {ProposalStore} from '../analyst/store.js';
import {configuredProvider} from '../analyst-real/provider.js';
import {externalDirectory,claimsReader} from '../analyst-real/cli.js';
import {StagedStore} from '../analyst-staged/store.js';
import {buildGrounding,layoutParserVersion,groundingVersion} from './grounding.js';
import {SpanRegistry} from './registry.js';
import {GroundedAnalyst} from './layer.js';
import {reclassifyLockedGold} from './gold.js';
import {runEvaluation,groundingCases,sanitized,gate} from './eval.js';
import {selectionPromptVersion,interpretationPromptVersion} from './contract.js';
import {buildControlWorkspace,devCases} from './controls.js';
import {locked} from '../analyst-real/eval.js';

const repository=fileURLToPath(new URL('../../',import.meta.url));
export const defaultResults=resolve(repository,'..','fc-agent','research-grounding');
const OPT_IN='FC_GROUNDING_OPT_IN';
function codeHashes(){
 const files=['grounding.js','registry.js','renderer.js','contract.js','facts.js','layer.js','gold.js','eval.js','cli.js','controls.js','pdfspans.py','synthetic-pdf.py','selection-output.schema.json'].map(name=>[name,digest(readFileSync(new URL('./'+name,import.meta.url),'utf8'))]);
 return Object.fromEntries(files);
}
async function analyzeScenario(analyst,entry){
 const result=await analyst.analyzeCase({caseId:entry.caseId,documentId:entry.documentId,page:entry.page,subjectId:entry.subjectId,asOf:entry.asOf}),promotions=[];
 for(const selection of result.selections??[]){
  if(selection.proposal?.validationStatus!=='validated')continue;
  if(promotions.some(entry=>entry.status==='promoted')){promotions.push({proposalId:selection.proposal.id,status:'deferred'});continue;}
  try{const candidate=analyst.promote(selection.proposal.id);promotions.push({proposalId:selection.proposal.id,status:'promoted',candidateId:candidate?.id??null});}
  catch(error){promotions.push({proposalId:selection.proposal.id,status:'rejected',reason:String(error.message).slice(0,160)});}
 }
 return {caseId:result.caseId,scenario:entry.scenario,page:entry.page,status:result.status,fabricated:result.fabricated??[],selectedSpanIds:result.selectedSpanIds??[],selectionProposalId:result.selectionProposalId??null,selections:(result.selections??[]).map(selection=>({spanId:selection.spanId,factKind:selection.factKind,status:selection.status,findings:selection.findings??[],parse:selection.parser?{status:selection.parser.status,numeric:selection.parser.numeric?{status:selection.parser.numeric.status,normalizedValue:selection.parser.numeric.normalizedValue,rawUnit:selection.parser.numeric.rawUnit}:null,period:selection.parser.period?{status:selection.parser.period.status,end:selection.parser.period.end}:null}:null,proposal:selection.proposal?{id:selection.proposal.id,validationStatus:selection.proposal.validationStatus,validationFindings:selection.proposal.validationFindings}:null})),promotions};
}
function usageOf(provider){
 const receipts=(provider?.receipts??[]).filter(receipt=>receipt.usage);
 const sum=key=>receipts.length&&receipts.every(receipt=>Number.isFinite(receipt.usage?.[key]))?receipts.reduce((total,receipt)=>total+receipt.usage[key],0):null;
 const latencies=receipts.map(receipt=>receipt.latencyMs).sort((a,b)=>a-b);
 return {calls:receipts.length,inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),totalTokens:sum('totalTokens'),medianLatencyMs:latencies[Math.floor((latencies.length-1)/2)]??null,p95LatencyMs:latencies[Math.ceil(latencies.length*0.95)-1]??null};
}
export async function runCli(argv=process.argv.slice(2),{env=process.env,providerFactory=configuredProvider}={}){
 const mode=argv[0];
 if(!['gold','dev','injection'].includes(mode))throw new Error('Usage: cli.js <gold|dev|injection> --opt-in');
 if(!argv.includes('--opt-in')&&env[OPT_IN]!=='1')throw new Error('Explicit opt-in required before credential lookup');
 const results=externalDirectory(argv.includes('--results')?argv[argv.indexOf('--results')+1]:env.FC_GROUNDING_RESULTS??defaultResults);
 const provider=providerFactory({env});
 if(!provider)throw new Error('REAL_MODEL_BENCHMARK_BLOCKED: credentials missing');
 const runFolder=externalDirectory(resolve(results,'session-'+Date.now()));
 const indexPath=argv.includes('--index')?argv[argv.indexOf('--index')+1]:defaultIndex;
 const index=new RetrievalIndex(indexPath),store=new StagedStore(runFolder),proposals=new ProposalStore(resolve(runFolder,'proposals.sqlite'));
 let control=null,memory=null;
 try{
  const preregistration={registeredAt:new Date().toISOString(),mode,beforeLockedEvaluation:true,layoutParserVersion,groundingVersion,selectionPromptVersion,interpretationPromptVersion,codeHashes:codeHashes(),gateHash:digest(gate),goldHash:locked.goldHash};
  writeFileSync(resolve(runFolder,'preregistration.json'),JSON.stringify(preregistration,null,1));
  try{memory=claimsReader(env.FC_RESEARCH_MEMORY_DB??resolve(repository,'..','fc-agent','research-memory','v0.2-coreweave.sqlite'));}catch{memory=null;}
  let payload;
  if(mode==='gold'){
   if(gate.goldHash!==locked.goldHash)throw new Error('Registered gate Gold hash drift');
   const built=buildGrounding({}),registry=new SpanRegistry(built);
   const analyst=new GroundedAnalyst(index,registry,store,{proposals,provider,maxSpansPerCase:24});
   const cases=groundingCases(registry,index),annotation=reclassifyLockedGold(registry,cases);
   const result=await runEvaluation({registry,index,analyst,cases,annotation,provider,readClaimsSnapshot:memory?memory.read:null});
   payload={preregistration,annotation,result:sanitized(result)};
  }else{
   let registry,activeIndex=index;
   if(mode==='injection'){
    control=buildControlWorkspace(runFolder,{python:env.FC_GROUNDING_PYTHON,clock:()=>new Date().toISOString()});
    registry=control.registry;activeIndex=control.index;
   }
   const built=mode==='injection'?null:buildGrounding({});
   if(built){registry=new SpanRegistry(built);}
   const annotation=built?reclassifyLockedGold(registry,groundingCases(registry,index)):null;
   const cases=mode==='injection'?control.cases.map(entry=>({...entry,asOf:gate.asOf})):devCases(registry,annotation,{asOf:gate.asOf});
   const analyst=new GroundedAnalyst(activeIndex,registry,store,{proposals,provider,maxSpansPerCase:24});
   const before=memory?memory.read():null,runs=[];
   for(const entry of cases)runs.push(await analyzeScenario(analyst,entry));
   const after=memory?memory.read():null;
   payload={preregistration,cases,runs,usage:usageOf(provider),claimsProtection:{before,after,unchanged:before&&after?digest(before)===digest(after):null}};
  }
  const file=resolve(results,'GROUND-'+Date.now()+'.json');
  writeFileSync(file,JSON.stringify({mode,generatedAt:new Date().toISOString(),...payload},null,1));
  return {file,mode,payload};
 }finally{memory?.close();control?.close();proposals.close();store.close();index.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===realpathSync(process.argv[1])){
 runCli().then(({file,mode,payload})=>{
  const summary=mode==='gold'
   ?{runId:payload.result.runId,gatePassed:payload.result.gatePassed,metrics:payload.result.metrics,annotation:payload.annotation.totals,legacy:payload.annotation.legacyTableMapping,tokens:payload.result.tokens,latency:payload.result.latency}
   :{cases:payload.runs.map(run=>({caseId:run.caseId,status:run.status,selected:run.selectedSpanIds.length,fabricated:run.fabricated.length,proposals:run.selections.filter(selection=>selection.proposal).map(selection=>selection.proposal.validationStatus),promotions:run.promotions})),usage:payload.usage,claims:payload.claimsProtection.unchanged};
  console.log(JSON.stringify({file,summary},null,1));
 }).catch(error=>{console.error(error.message);process.exit(1);});
}
