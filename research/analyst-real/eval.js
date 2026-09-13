import {readFileSync} from 'node:fs';
import {EvidenceAnalyst} from '../analyst/layer.js';
import {parseOutput,promptVersion,promptHash} from '../analyst/contract.js';
import {validatorHash,validationVersion} from '../analyst/validation.js';
import {buildGold} from '../analyst/gold.js';
import {digest} from '../src/identity.js';
import {compareProposal,summarize,rate} from './comparison.js';
export const locked=JSON.parse(readFileSync(new URL('../eval/evidence-analyst-real/locked.json',import.meta.url),'utf8'));
export function verifyLocked(index){const g=buildGold(index);if(g.goldHash!==locked.goldHash||g.goldEvidenceCount!==32||g.indexedGoldCount!==19||g.literalGoldCount!==16)throw new Error('Locked Gold drift');for(const c of locked.cases){const chunk=index.get('chunk',c.chunkId);if(!chunk||chunk.contentHash!==c.inputReference.contentHash||digest(chunk.locator)!==digest(c.inputReference.locator))throw new Error('Locked chunk drift');}return g;}
export async function evaluateReal({index,store,provider,controlCases=[],readClaimsSnapshot,allowTest=false,offlineCases=null,clock=()=>new Date().toISOString()}){
 if(!provider)return {status:'REAL_MODEL_BENCHMARK_BLOCKED',reason:'No legal real provider configured',eligibleGoldCases:16};
 if(provider.metadata.kind!=='real'&&!allowTest)throw new Error('Real evaluation cannot use test providers');
 if(offlineCases&&(!allowTest||provider.metadata.kind!=='test'))throw new Error('Offline cases require explicit test mode');
 const gold=offlineCases?{goldHash:'offline-test-only'}:verifyLocked(index),cases=offlineCases??locked.cases,before=readClaimsSnapshot?.()??null,rows=[],analyst=new EvidenceAnalyst(index,store,{provider,clock,timeoutMs:60000});
 const schedule=[...cases.map(c=>({...c,kind:'gold',index,store,analyst})),...controlCases,...(offlineCases?[]:locked.repeats).map(id=>({...cases.find(c=>c.caseId===id),kind:'gold',repeat:true,index,store,analyst}))];
 let demonstration=null;
 for(const c of schedule){
  const a=c.analyst??new EvidenceAnalyst(c.index,c.store,{provider,clock:c.clock??clock,timeoutMs:60000}),oldRuns=new Set(c.store.runs().map(r=>r.id)),receiptStart=provider.receipts?.length??0,chunk=c.index.get('chunk',c.chunkId);
  let result,error=null;try{result=await a.analyzeChunk(c.chunkId,{subjectId:c.subjectId,asOf:'2026-09-13',timeMode:'replay'});}catch{error='structured_output_or_provider_failure';}
  const run=result?.run??c.store.runs().find(r=>!oldRuns.has(r.id)),raw=run?.rawResponse??null;let output=null;try{if(raw!==null)output=parseOutput(raw);}catch{}
  const refs=c.kind==='gold'?cases.filter(x=>x.chunkId===c.chunkId):c.references??[];
  const comparisons=(result?.proposals??[]).map(p=>({proposalId:p.id,accepted:p.validationStatus==='validated',...compareProposal(p,chunk,refs,{negative:c.kind==='negative'})}));
  const row={caseId:c.caseId,goldEvidenceId:c.goldEvidenceId??null,kind:c.kind,expectedRawValue:c.expectedRawValue??null,repeat:!!c.repeat,chunkId:c.chunkId,inputHash:run?.inputHash??null,ModelOutput:{rawResponse:raw,rawResponseHash:raw===null?null:digest(raw),schemaValid:output!==null,proposals:output??[],runId:run?.id??null},ValidatorResult:(result?.proposals??[]).map(p=>({proposalId:p.id,status:p.validationStatus,reasons:p.validationFindings})),GoldComparison:comparisons,receipts:provider.receipts?.slice(receiptStart)??[],errorClassification:error?(run?.status==='invalid_output'?'MODEL_ERROR':'UNKNOWN'):null,errorCode:error?(run?.status==='invalid_output'?'schema_invalid':'provider_failure'):null};rows.push(row);
  // Real Candidate promotion requires independently correct output AND deterministic validation.
  const candidate=(result?.proposals??[]).find(p=>comparisons.some(x=>x.proposalId===p.id&&x.correct===true&&x.accepted));
  if(!demonstration&&candidate&&!c.repeat){demonstration={caseId:c.caseId,...a.promoteProposalToCandidate(candidate.id),stoppedAt:'Candidate',humanAdmission:false};}
 }
 const after=readClaimsSnapshot?.()??null;if(before!==null&&digest(before)!==digest(after))throw new Error('Claims protection failed');
 const receipts=rows.flatMap(r=>r.receipts),latencies=receipts.map(r=>r.latencyMs).filter(Number.isFinite).sort((a,b)=>a-b),usage=receipts.map(r=>r.usage).filter(Boolean),sum=k=>usage.every(u=>Number.isFinite(u[k]))?usage.reduce((s,u)=>s+u[k],0):null;
 const repeats=rows.filter(r=>r.repeat).map(r=>{const first=rows.find(x=>x.caseId===r.caseId&&!x.repeat),valid=r.ModelOutput.schemaValid&&first.ModelOutput.schemaValid;return {caseId:r.caseId,bothSchemaValid:valid,sameRawResponse:r.ModelOutput.rawResponseHash===first.ModelOutput.rawResponseHash,sameStructuredResult:valid?digest(r.ModelOutput.proposals)===digest(first.ModelOutput.proposals):null,sameQuotes:valid?digest(r.ModelOutput.proposals.map(p=>p.quotedText))===digest(first.ModelOutput.proposals.map(p=>p.quotedText)):null,sameNumericOutput:valid?digest(r.ModelOutput.proposals.map(p=>({value:p.rawValue,unit:p.rawUnit,start:p.periodStart,end:p.periodEnd})))===digest(first.ModelOutput.proposals.map(p=>({value:p.rawValue,unit:p.rawUnit,start:p.periodStart,end:p.periodEnd}))):null};});
 return {status:allowTest&&provider.metadata.kind==='test'?'OFFLINE_TEST_NOT_REAL':'REAL_MODEL_EVALUATED',runId:'REAL-'+Date.now(),runAt:clock(),provider:provider.metadata,promptVersion,promptHash,validationVersion,validatorHash,goldHash:gold.goldHash,goldTotal:32,indexedGold:19,literalEligible:16,metrics:summarize(rows,cases.length),stability:repeats,tokens:{input:sum('inputTokens'),output:sum('outputTokens'),total:sum('totalTokens'),averageTokensPerChunk:rate(sum('totalTokens'),receipts.length),averageProposalsPerChunk:rate(rows.reduce((s,r)=>s+r.ModelOutput.proposals.length,0),rows.length),providerReportedCost:receipts.every(r=>Number.isFinite(r.providerReportedCost))?receipts.reduce((s,r)=>s+r.providerReportedCost,0):null},latency:{sampleCount:latencies.length,medianMs:latencies.length?latencies[Math.floor((latencies.length-1)/2)]:null,p95Ms:latencies.length?latencies[Math.ceil(latencies.length*.95)-1]:null,exploratory:true},claimsProtection:{before,after,unchanged:before!==null?digest(before)===digest(after):null},demonstration,rows};
}
export function publicSummary(result){return {...result,rows:result.rows?.map(r=>({...r,ModelOutput:{...r.ModelOutput,rawResponse:undefined,proposals:r.ModelOutput.proposals.map(p=>({...p,statement:undefined,quotedText:undefined,quotedTextHash:digest(p.quotedText)}))}}))};}
