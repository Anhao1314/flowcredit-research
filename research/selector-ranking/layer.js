import {digest} from '../src/identity.js';
import {buildSelectionHandles,parseHandleSelection,selectionHandlesInstructions,selectionHandlesSchema,selectionHandlesPromptVersion} from '../selection-handles/handles.js';
import {instructions,promptVersion,promptHash,rankingSchema,parseRanking} from './contract.js';
import {renderSupport,EvidenceSupportAnalyst} from '../evidence-support/layer.js';
import {interpretationInstructions,interpretationPromptVersion,interpretationPromptHash,parseInterpretation} from '../evidence-support/contract.js';
import {interpretationSchema} from '../evidence-support/schemas.js';
import {validateSupportV2,validateFactV2} from '../evidence-support/validator.js';
import {buildProposalV2,provenanceOf} from '../evidence-support/proposal.js';

export async function select({provider,supports,question,subjectId,asOf,policy='ranked'}){
 const handles=buildSelectionHandles(supports.map(s=>s.spanId));
 if(policy==='retrieval')return {selectedSpanIds:supports.slice(0,3).map(s=>s.spanId),rankedHandles:handles.availableHandles.slice(0,3),latencyMs:0,handles,raw:null};
 const ranked=policy==='ranked',started=performance.now();
 const input={instructions:ranked?instructions:selectionHandlesInstructions,outputSchema:ranked?rankingSchema(handles.availableHandles):selectionHandlesSchema(handles.availableHandles),promptVersion:ranked?promptVersion:selectionHandlesPromptVersion,data:{subjectId,asOf,timeMode:'replay',availableHandles:handles.availableHandles,context:supports.map((s,i)=>renderSupport(s,{handle:'S'+(i+1)})).join('\n\n')}};
 // Arm B preserves the old question-free multi-select policy. Only Arm C gets
 // the requested fact; expected values/ids never enter either input.
 if(ranked)input.data.requestedFact=question;
 const raw=await provider.analyzeEvidence(input,{signal:AbortSignal.timeout(60000)});
 const parsed=ranked?parseRanking(raw,handles):{resolved:parseHandleSelection(raw,handles).selections};
 const selectedSpanIds=[...new Set(parsed.resolved.map(r=>r.spanId))];
 return {selectedSpanIds,rankedHandles:selectedSpanIds.map(id=>handles.entries.find(e=>e.spanId===id).handle),latencyMs:performance.now()-started,handles,raw,inputHash:digest(input)};
}

// The research policy sequences calls, while all support/fact/proposal and
// Candidate rules remain the existing frozen implementations.
export async function convertRanked({context,store,provider,selection,supports,entry,asOf,onCall=()=>{}}){
 const promoter=new EvidenceSupportAnalyst(context.index,context.registry,{sentences:context.sentences,tables:context.tables,store,provider,selectionInterface:'handles'});
 const attempts=[];let candidateFoundAtRank=null;
 for(const [position,id] of selection.selectedSpanIds.slice(0,3).entries()){
  const rank=position+1,support=supports.find(s=>s.spanId===id),handle=selection.handles.entries.find(e=>e.spanId===id).handle;
  const verdict=validateSupportV2({registry:context.registry,sentenceIndex:context.sentences,tableIndex:context.tables},support,{subjectId:entry.subjectId,asOf,timeMode:'replay',documentId:entry.documentId});
  const attempt={rank,spanId:id,latencyMs:0,status:'VALIDATOR_REJECT'};attempts.push(attempt);
  if(!verdict.valid){attempt.findings=verdict.findings;continue;}
  const document=context.registry.document(entry.documentId),input={instructions:interpretationInstructions,outputSchema:interpretationSchema,promptVersion:interpretationPromptVersion,promptHash:interpretationPromptHash,data:{subjectId:entry.subjectId,asOf,timeMode:'replay',span:{handle,spanType:support.type,page:support.page,factKind:'financial_metric'},evidenceText:renderSupport(support,{handle}),source:{id:document.sourceId,documentDate:document.availableAt}}};
  const started=performance.now();onCall({phase:'interpretation',rank,status:'start'});
  try{
   const raw=await provider.analyzeEvidence(input,{signal:AbortSignal.timeout(60000)});attempt.latencyMs=performance.now()-started;
   let fact;try{fact=parseInterpretation(raw).value;}catch{attempt.status='INTERPRETATION_ERROR';continue;}
   attempt.value=fact;
   const validated=validateFactV2(support,fact);attempt.parse=validated.parse;
   if(validated.status!=='validated'){attempt.status='PARSER_ERROR';attempt.findings=validated.findings;continue;}
   const provenance=provenanceOf(provider.metadata,{parserVersion:support.parserVersion,groundingVersion:support.groundingVersion,segmentationVersion:support.segmentationVersion??null,selection:{version:promptVersion,hash:promptHash},interpretation:{version:interpretationPromptVersion,hash:interpretationPromptHash}});
   const proposal=buildProposalV2({support,fact,validated,provenance,createdAt:new Date().toISOString(),outputHash:digest(raw),inputHash:digest({ranking:selection.inputHash,input})});
   store.save('proposalV2',proposal);
   attempt.proposalId=proposal.id;
   try{attempt.candidate=promoter.promote(proposal.id,{asOf,timeMode:'replay'});candidateFoundAtRank=rank;attempt.status='converted';break;}catch(error){attempt.status='VALIDATOR_REJECT';attempt.error=error.message;}
  }catch(error){attempt.latencyMs=performance.now()-started;attempt.status=/ABORT|TIMEOUT/.test(error.message)?'PROVIDER_TIMEOUT':'PROVIDER_ERROR';attempt.error=error.message;}
  finally{onCall({phase:'interpretation',rank,status:attempt.status,latencyMs:attempt.latencyMs});}
 }
 return {candidateFoundAtRank,attempts};
}
