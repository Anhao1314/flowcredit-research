import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../src/identity.js';
import {RetrievalIndex,defaultIndex} from '../retrieval/index.js';
import {configuredProvider} from '../analyst-real/provider.js';
import {externalDirectory,claimsReader} from '../analyst-real/cli.js';
import {buildGrounding,layoutParserVersion,groundingVersion} from '../grounding/grounding.js';
import {SpanRegistry} from '../grounding/registry.js';
import {locked} from '../analyst-real/eval.js';
import {SentenceSpanIndex,segmentationVersion} from './sentences.js';
import {TableIndex,supportVersion} from './support.js';
import {validationVersionV2} from './validator.js';
import {SupportStore} from './store.js';
import {EvidenceSupportAnalyst} from './layer.js';
import {selectionPromptVersion,interpretationPromptVersion} from './contract.js';
import {supportCases,annotateGold,runEvaluation,gate,sanitized} from './eval.js';
import {buildControlWorkspace,summarizeInjection,defaultPython} from './controls.js';

const repository=fileURLToPath(new URL('../../',import.meta.url));
export const defaultResults=resolve(repository,'..','fc-agent','research-evidence-support');
const OPT_IN='FC_EVIDENCE_SUPPORT_OPT_IN';
function codeHashes(){
 const files=['../grounding/pdfspans.py','../grounding/renderer.js','../grounding/facts.js','sentences.js','support.js','validator.js','proposal.js','contract.js','store.js','layer.js','gold.js','eval.js','controls.js','cli.js','synthetic-pdf-v2.py','selection-output.schema.json','proposal-v2.schema.json','../prompts/span-selection-v2.txt','../prompts/fact-interpretation-span-v2.txt'].map(name=>[name,digest(readFileSync(new URL('./'+name,import.meta.url),'utf8'))]);
 return Object.fromEntries(files);
}
async function analyzeScenario(analyst,entry){
 const result=await analyst.analyzeCase({caseId:entry.caseId,documentId:entry.documentId,page:entry.page,subjectId:entry.subjectId,asOf:entry.asOf}),promotions=[];
 for(const selection of result.selections??[]){
  if(selection.proposal?.validationStatus!=='validated')continue;
  if(promotions.some(entry=>entry.status==='promoted')){promotions.push({proposalId:selection.proposal.id,status:'deferred'});continue;}
  try{const promoted=analyst.promote(selection.proposal.id,{asOf:entry.asOf});promotions.push({proposalId:selection.proposal.id,status:'promoted',candidateId:promoted.candidateId,supportCandidateId:promoted.supportCandidateId});}
  catch(error){promotions.push({proposalId:selection.proposal.id,status:'rejected',reason:String(error.message).slice(0,160)});}
 }
 return {caseId:result.caseId,scenario:entry.scenario,page:entry.page,status:result.status,fabricated:result.fabricated??[],selectedSpanIds:result.selectedSpanIds??[],selectionProposalId:result.selectionProposalId??null,selections:(result.selections??[]).map(selection=>({spanId:selection.spanId,factKind:selection.factKind,supportType:selection.supportType,status:selection.status,findings:selection.findings??[],parse:selection.parse?{status:selection.parse.status,numeric:selection.parse.numeric?{status:selection.parse.numeric.status,normalizedValue:selection.parse.numeric.normalizedValue,rawUnit:selection.parse.numeric.rawUnit}:null,period:selection.parse.period?{status:selection.parse.period.status,end:selection.parse.period.end}:null}:null,proposal:selection.proposal?{id:selection.proposal.id,validationStatus:selection.proposal.validationStatus,validationFindings:selection.proposal.validationFindings}:null})),promotions};
}
function usageOf(provider){
 const receipts=(provider?.receipts??[]).filter(receipt=>receipt.usage);
 const sum=key=>receipts.length&&receipts.every(receipt=>Number.isFinite(receipt.usage?.[key]))?receipts.reduce((total,receipt)=>total+receipt.usage[key],0):null;
 const latencies=receipts.map(receipt=>receipt.latencyMs).sort((a,b)=>a-b);
 return {calls:receipts.length,inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),totalTokens:sum('totalTokens'),medianLatencyMs:latencies[Math.floor((latencies.length-1)/2)]??null,p95LatencyMs:latencies[Math.ceil(latencies.length*0.95)-1]??null};
}
export async function runCli(argv=process.argv.slice(2),{env=process.env,providerFactory=configuredProvider}={}){
 const mode=argv[0];
 if(!['gold','injection'].includes(mode))throw new Error('Usage: cli.js <gold|injection> --opt-in');
 if(!argv.includes('--opt-in')&&env[OPT_IN]!=='1')throw new Error('Explicit opt-in required before credential lookup');
 const results=externalDirectory(argv.includes('--results')?argv[argv.indexOf('--results')+1]:env.FC_EVIDENCE_SUPPORT_RESULTS??defaultResults);
 const provider=providerFactory({env});
 if(!provider)throw new Error('REAL_MODEL_BENCHMARK_BLOCKED: credentials missing');
 const runFolder=externalDirectory(resolve(results,'session-'+Date.now()));
 const indexPath=argv.includes('--index')?argv[argv.indexOf('--index')+1]:defaultIndex;
 const index=new RetrievalIndex(indexPath),store=new SupportStore(runFolder);
 let control=null,memory=null;
 try{
  const preregistration={registeredAt:new Date().toISOString(),mode,beforeLockedEvaluation:true,layoutParserVersion,groundingVersion,segmentationVersion,supportVersion,validationVersion:validationVersionV2,selectionPromptVersion,interpretationPromptVersion,codeHashes:codeHashes(),gateHash:digest(gate),goldHash:locked.goldHash};
  writeFileSync(resolve(runFolder,'preregistration.json'),JSON.stringify(preregistration,null,1));
  try{memory=claimsReader(env.FC_RESEARCH_MEMORY_DB??resolve(repository,'..','fc-agent','research-memory','v0.2-coreweave.sqlite'));}catch{memory=null;}
  let payload;
  if(mode==='gold'){
   if(gate.goldHash!==locked.goldHash)throw new Error('Registered gate Gold hash drift');
   const built=buildGrounding({}),registry=new SpanRegistry(built),sentences=new SentenceSpanIndex(registry),tables=new TableIndex(registry);
   const analyst=new EvidenceSupportAnalyst(index,registry,{sentences,tables,store,provider,maxSpansPerCase:24});
   const cases=supportCases(registry,index),annotation=annotateGold(registry,sentences,cases);
   const result=await runEvaluation({registry,sentenceIndex:sentences,tableIndex:tables,index,analyst,cases,annotation,provider,readClaimsSnapshot:memory?memory.read:null,promote:true});
   payload={preregistration,annotation,result:sanitized(result)};
  }else{
   control=buildControlWorkspace(runFolder,{python:env.FC_GROUNDING_PYTHON??defaultPython(),clock:()=>new Date().toISOString()});
   const analyst=new EvidenceSupportAnalyst(control.index,control.registry,{sentences:control.sentences,tables:control.tables,store,provider,maxSpansPerCase:24});
   const before=memory?memory.read():null,runs=[];
   for(const entry of control.cases)runs.push(await analyzeScenario(analyst,{...entry,asOf:gate.asOf}));
   const after=memory?memory.read():null;
   payload={preregistration,cases:control.cases,hostile:{tableSpans:control.hostileTableSpans,excludedTableSpans:control.excludedTableSpans,textSpans:control.hostileTextSpans},runs,summary:summarizeInjection({runs,workspace:control}),usage:usageOf(provider),claimsProtection:{before,after,unchanged:before&&after?digest(before)===digest(after):null}};
  }
  const file=resolve(results,'SUPPORT-'+Date.now()+'.json');
  writeFileSync(file,JSON.stringify({mode,generatedAt:new Date().toISOString(),...payload},null,1));
  return {file,mode,payload};
 }finally{memory?.close();control?.close();store.close();index.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 runCli().then(({file,mode,payload})=>{
  const summary=mode==='gold'
   ?{runId:payload.result.runId,gatePassed:payload.result.gatePassed,metrics:payload.result.metrics,splits:payload.result.splits,annotation:payload.annotation.totals,legacy:payload.annotation.legacyTableMapping,tokens:payload.result.tokens,latency:payload.result.latency,claims:payload.result.claimsProtection.unchanged}
   :{summary:payload.summary,usage:payload.usage,claims:payload.claimsProtection.unchanged};
  console.log(JSON.stringify({file,summary},null,1));
 }).catch(error=>{console.error(error.stack??error.message);process.exit(1);});
}
