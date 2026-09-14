import {digest} from '../src/identity.js';
import {renderSupport,EvidenceSupportAnalyst} from '../evidence-support/layer.js';
import {validateSupportV2,validateFactV2} from '../evidence-support/validator.js';
import {buildProposalV2,provenanceOf} from '../evidence-support/proposal.js';
import {buildSelectionHandles,resolveSelectionHandles} from '../selection-handles/handles.js';
import {assertIntent,boundSchema,parseBound,instructions,promptVersion,promptHash,createSidecar} from './contract.js';
import {precheck,checkTarget} from './checks.js';
import {extractCompound,bindSourceWhitespace} from './extraction.js';
export async function convertTarget({context,store,provider,supports,rankedHandles,intent,documentId,asOf,onProgress=()=>{}}){
 assertIntent(intent);
 if(rankedHandles.length>3||new Set(rankedHandles).size!==rankedHandles.length)throw Error('INVALID_SELECTION_HANDLE');
 const handles=buildSelectionHandles(supports.map(s=>s.spanId)),resolved=resolveSelectionHandles(rankedHandles,handles);
 const promoter=new EvidenceSupportAnalyst(context.index,context.registry,{sentences:context.sentences,tables:context.tables,store,provider,selectionInterface:'handles'});
 const attempts=[];let candidateFoundAtRank=null;
 for(const [position,item] of resolved.entries()){
  const rank=position+1,support=supports.find(s=>s.spanId===item.spanId),attempt={rank,spanId:support.spanId,handle:item.handle,targetMatch:null,status:null,modelLatencyMs:0,parserValidatorLatencyMs:0};attempts.push(attempt);
  const checkStart=performance.now();
  const supportVerdict=validateSupportV2({registry:context.registry,sentenceIndex:context.sentences,tableIndex:context.tables},support,{subjectId:intent.subjectId,documentId,asOf,timeMode:'replay'});
  if(!supportVerdict.valid){attempt.status='VALIDATOR_REJECT';attempt.findings=supportVerdict.findings;attempt.parserValidatorLatencyMs=performance.now()-checkStart;continue;}
  const before=precheck(intent,support);attempt.precheck=before;attempt.parserValidatorLatencyMs=performance.now()-checkStart;
  if(before.status!=='eligible'){attempt.status=before.status;onProgress({rank,status:attempt.status,modelSkipped:true});continue;}
  const input={instructions,outputSchema:boundSchema,promptVersion,promptHash,data:{researchIntent:intent,sourceSupport:{handle:item.handle,type:support.type,page:support.page},sourceData:renderSupport(support,{handle:item.handle})}};
  const modelStart=performance.now();onProgress({rank,phase:'target_match_and_interpretation',status:'start'});
  try{
   const raw=await provider.analyzeEvidence(input,{signal:AbortSignal.timeout(60000)});attempt.modelLatencyMs=performance.now()-modelStart;attempt.raw=raw;attempt.inputHash=digest(input);
   const bound=parseBound(raw);attempt.targetMatch=bound.targetMatch;attempt.bound=bound;
   if(bound.targetMatch!=='supported'){attempt.status=bound.targetMatch==='ambiguous'?'SUPPORT_AMBIGUOUS':'TARGET_MISMATCH';continue;}
   const deterministicStart=performance.now(),extracted=extractCompound(support,intent,bound.fact);
   attempt.extractionProof=extracted.proof;
   if(extracted.failure){attempt.status=extracted.failure;attempt.parserValidatorLatencyMs+=performance.now()-deterministicStart;continue;}
   const boundSource=bindSourceWhitespace(support,extracted.fact);attempt.whitespaceProof=boundSource.proof;extracted.fact=boundSource.fact;
   const validated=validateFactV2(support,extracted.fact);attempt.value=extracted.fact;attempt.parse=validated.parse;attempt.findings=validated.findings;
   const target=checkTarget(intent,support,{...bound,fact:extracted.fact},validated);attempt.targetVerdict=target;
   if(!target.valid){attempt.status=target.failure;attempt.parserValidatorLatencyMs+=performance.now()-deterministicStart;continue;}
   const provenance=provenanceOf(provider.metadata,{parserVersion:support.parserVersion,groundingVersion:support.groundingVersion,segmentationVersion:support.segmentationVersion??null,selection:{version:'span-ranking-handles/v1',hash:digest(instructionsFrozenRanking())},interpretation:{version:promptVersion,hash:promptHash}});
   const proposal=buildProposalV2({support,fact:extracted.fact,validated,provenance,createdAt:new Date().toISOString(),inputHash:digest(input),outputHash:digest(raw)});store.save('proposalV2',proposal);
   try{
    const candidate=promoter.promote(proposal.id,{asOf,timeMode:'replay'}),sidecar=createSidecar({candidate,intent,support,rank});store.save('intentSidecar',sidecar);store.save('researchIntent',{id:intent.intentId,...intent});
    attempt.candidate=candidate;attempt.proposalId=proposal.id;attempt.sidecar=sidecar;attempt.status='converted';candidateFoundAtRank=rank;
   }catch(error){attempt.status='VALIDATOR_REJECT';attempt.error=error.message;}
   attempt.parserValidatorLatencyMs+=performance.now()-deterministicStart;
   if(candidateFoundAtRank!==null)break;
  }catch(error){attempt.modelLatencyMs=performance.now()-modelStart;attempt.status=/ABORT|TIMEOUT/.test(error.message)?'PROVIDER_TIMEOUT':error.message==='INTERPRETATION_ERROR'?error.message:'PROVIDER_ERROR';attempt.error=error.message;}
  finally{onProgress({rank,status:attempt.status,modelLatencyMs:attempt.modelLatencyMs});}
 }
 return {candidateFoundAtRank,attempts};
}
import {readFileSync} from 'node:fs';
function instructionsFrozenRanking(){return readFileSync(new URL('../prompts/span-ranking-handles-v1.txt',import.meta.url),'utf8');}
