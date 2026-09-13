import {readFileSync} from 'node:fs';
import {digest,stableId} from '../src/identity.js';
import {instant} from '../memory/time.js';
import {RetrievalLayer,cutoffVisible} from '../retrieval/layer.js';
import {EvidenceAnalyst} from '../analyst/layer.js';
import {assertProposal} from '../analyst/contract.js';
import {validateProposal,validationVersion,validatorHash} from '../analyst/validation.js';
import {proposalIdentity} from '../analyst/identity.js';
import {selectionInstructions,selectionSchema,selectionPromptVersion,selectionPromptHash,interpretationInstructions,interpretationPromptVersion,interpretationPromptHash,parseSelection,parseInterpretation,validateProvider} from './contract.js';
import {renderContext,renderSpan} from './renderer.js';
import {deriveSpanFact,sourceQuote,placeholderCell} from './facts.js';
import {groundingVersion} from './grounding.js';

function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
export const interpretationSchema=JSON.parse(readFileSync(new URL('../analyst-staged/interpretation-output.schema.json',import.meta.url),'utf8'));
export function selectionCandidates(spans){return spans.filter(span=>!(span.spanType==='table'&&placeholderCell.test(span.cellText)));}

export class GroundedAnalyst {
 #index;#registry;#store;#proposals;#provider;#metadata;#clock;#timeout;#maxSpansPerCase;
 constructor(index,registry,store,{proposals=null,provider=null,clock=()=>new Date().toISOString(),timeoutMs=60000,maxSpansPerCase=24}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new Error('Bounded timeout required');
  if(!Number.isInteger(maxSpansPerCase)||maxSpansPerCase<1||maxSpansPerCase>60)throw new Error('Bounded interpretation budget required');
  this.#index=index;this.#registry=registry;this.#store=store;this.#clock=clock;this.#timeout=timeoutMs;this.#maxSpansPerCase=maxSpansPerCase;
  this.#provider=provider?validateProvider(provider):null;this.#metadata=provider?structuredClone(provider.metadata):null;
  this.#proposals=proposals;
 }
 get provider(){return this.#metadata;}
 #caseContext({documentId,page,subjectId,asOf,timeMode='replay'}){
  const document=this.#registry.document(documentId);
  if(!document||document.subjectId!==subjectId)throw new Error('SOURCE_IDENTITY_INVALID');
  if(!Number.isInteger(page)||page<document.firstPage||page>document.pageCount)throw new Error('PAGE_OUT_OF_RANGE');
  if(!['replay','audit'].includes(timeMode))throw new Error('Unknown time mode');
  const at=instant(this.#clock());
  if(document.availableAt&&instant(document.availableAt,{query:true})>at)throw new Error('TEMPORAL_INVALID');
  const spans=this.#registry.findSpansByPage(documentId,page);
  if(!spans.length)throw new Error('NO_SPANS');
  for(const span of spans){const verified=this.#registry.verify(span.id);if(!verified.valid)throw new Error('SPAN_INTEGRITY_INVALID');}
  return {document,spans,context:{subjectId,asOf:instant(asOf,{query:true}),timeMode},at};
 }
 chunksFor(document,page){return this.#index.list('chunk').filter(chunk=>chunk.sourceId===document.sourceId&&chunk.page===page);}
 async #call(input,name,{caseId=null,spanId=null}={}){
  if(!this.#provider)return {status:'unavailable',error:'PROVIDER_UNAVAILABLE'};
  const frozen=freeze(input),inputHash=digest(frozen),started=performance.now(),controller=new AbortController();let timer,raw=null,error=null;
  try{raw=await Promise.race([this.#provider.analyzeEvidence(frozen,{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('PROVIDER_TIMEOUT'));},this.#timeout);})]);
   if(digest(frozen)!==inputHash||digest(this.#provider.metadata)!==digest(this.#metadata))throw new Error('INPUT_OR_PROVIDER_MUTATION');
  }catch(caught){error=/^(?:PROVIDER_[A-Z_]+|INPUT_OR_PROVIDER_MUTATION)$/.test(caught.message)?caught.message:'PROVIDER_ERROR';}finally{clearTimeout(timer);}
  const latencyMs=performance.now()-started,run={id:stableId('GROUND-RUN',{name,caseId,spanId,inputHash,rawHash:typeof raw==='string'?digest(raw):null,at:this.#clock()}),name,caseId,spanId,provider:this.#metadata,promptVersion:name==='selection'?selectionPromptVersion:interpretationPromptVersion,inputHash,outputHash:typeof raw==='string'?digest(raw):null,latencyMs,status:error?'provider_error':'completed',error,createdAt:this.#clock()};
  this.#store.save('providerRun',run);
  return {status:error?'provider_error':'completed',raw,error,receipts:this.#provider.receipts?.slice(-1)??[],latencyMs,run};
 }
 async analyzeCase({caseId=null,documentId,page,subjectId,asOf,timeMode='replay'}){
  const {document,spans,context}=this.#caseContext({documentId,page,subjectId,asOf,timeMode});
  const availableSpanIds=spans.map(span=>span.id),evidenceUnits=selectionCandidates(spans);
  const selectionContext=renderContext(evidenceUnits);
  const selectionInput={instructions:selectionInstructions,outputSchema:selectionSchema,promptVersion:selectionPromptVersion,promptHash:selectionPromptHash,data:{subjectId,asOf:context.asOf,timeMode:context.timeMode,generatedAt:this.#clock(),document:{id:document.id,sourceId:document.sourceId,page},page,availableSpanIds,context:selectionContext}};
  const selectionRun=await this.#call(selectionInput,'selection',{caseId});
  const caseRecord={caseId,documentId,page,subjectId,asOf:context.asOf,timeMode:context.timeMode,selectionRun:selectionRun.run,fabricated:[],selections:[],errors:[]};
  if(selectionRun.status==='provider_error'){caseRecord.status=selectionRun.error;this.#store.save('case',caseRecord);return caseRecord;}
  let parsed;
  try{parsed=parseSelection(selectionRun.raw,availableSpanIds);}
  catch(error){
   if(error.message==='INVALID_SPAN_REFERENCE'){caseRecord.status='FABRICATED_SPAN';caseRecord.fabricated=error.fabricated;}
   else if(error.message==='CONTRACT_SCHEMA_INVALID')caseRecord.status='SPAN_SCHEMA_ERROR';
   else caseRecord.status='SPAN_SCHEMA_ERROR';
   caseRecord.rawResponse=selectionRun.raw;this.#store.save('case',caseRecord);return caseRecord;
  }
  caseRecord.wrapperRemoved=parsed.wrapperRemoved;
  const chunks=this.chunksFor(document,page);
  const seen=new Set();const queue=[];
  for(const item of parsed.value)for(const spanId of item.spanIds)if(!seen.has(spanId)){seen.add(spanId);queue.push({spanId,factKind:item.factKind});}
  if(queue.length>this.#maxSpansPerCase)queue.length=this.#maxSpansPerCase;
  caseRecord.selectedSpanIds=queue.map(entry=>entry.spanId);
  const selectionProposal={id:stableId('SPANSEL',{caseId,documentId,page,inputHash:selectionRun.run.inputHash,outputHash:selectionRun.run.outputHash,ids:queue.map(q=>q.spanId)}),caseId,subjectId,documentId,page,spanIds:queue.map(entry=>entry.spanId),factKind:queue[0]?.factKind??null,provider:this.#metadata?.provider??null,model:this.#metadata?.model??null,promptVersion:selectionPromptVersion,promptHash:selectionPromptHash,inputHash:selectionRun.run.inputHash,outputHash:selectionRun.run.outputHash,createdAt:this.#clock()};
  this.#store.save('selectionProposal',selectionProposal);
  caseRecord.selectionProposalId=selectionProposal.id;
  for(const {spanId,factKind} of queue){
   const span=this.#registry.get(spanId),verified=this.#registry.verify(spanId);
   if(!verified.valid){caseRecord.errors.push({spanId,error:'SPAN_INTEGRITY_INVALID'});continue;}
   const interpretationInput={instructions:interpretationInstructions,outputSchema:interpretationSchema,promptVersion:interpretationPromptVersion,promptHash:interpretationPromptHash,data:{subjectId,asOf:context.asOf,timeMode:context.timeMode,span:{id:span.id,spanType:span.spanType,page:span.page,factKind},evidenceText:renderSpan(span),source:{id:document.sourceId,documentDate:document.availableAt}}};
   const interpretation=await this.#call(interpretationInput,'interpretation',{caseId,spanId});
   const record={spanId,factKind,run:interpretation.run};
   if(interpretation.status==='provider_error'){record.status=interpretation.error;caseRecord.selections.push(record);continue;}
   let fact;
   try{fact=parseInterpretation(interpretation.raw);}
   catch{record.status='INTERPRETATION_SCHEMA_ERROR';record.rawResponseHash=digest(interpretation.raw);caseRecord.selections.push(record);continue;}
   const derived=deriveSpanFact(span,fact.value);
   const factRecord={id:stableId('GROUND-FACT',{caseId,spanId,outputHash:interpretation.run.outputHash}),caseId,spanId,spanType:span.spanType,factKind,metricOrCategory:fact.value.metricOrCategory,metric:fact.value.metric,rawValueText:fact.value.rawValueText,rawUnitText:fact.value.rawUnitText,periodText:fact.value.periodText,actualOrGuidance:fact.value.actualOrGuidance,explicitOrDerived:fact.value.explicitOrDerived,parser:{status:derived.status,findings:derived.findings,numeric:derived.numeric,period:derived.period},promptVersion:interpretationPromptVersion,promptHash:interpretationPromptHash,inputHash:interpretation.run.inputHash,outputHash:interpretation.run.outputHash,createdAt:this.#clock()};
   this.#store.save('fact',factRecord);
   record.factId=factRecord.id;record.status='interpreted';record.findings=derived.findings;record.value=fact.value;
   record.parser={status:derived.status,findings:derived.findings,numeric:derived.numeric,period:derived.period};
   if(derived.status==='parsed'){
    const chunk=chunks.find(candidate=>sourceQuote(candidate.text,span));
    if(!chunk){record.status='NO_SOURCE_RANGE';record.findings=[...derived.findings,'NO_SOURCE_RANGE'];}
    else record.proposal=this.#buildProposal({span,fact:fact.value,derived,chunk,document,context,caseId});
   }
   caseRecord.selections.push(record);
  }
  caseRecord.status=caseRecord.selections.some(entry=>entry.proposal)?'generated':'abstained_or_unsupported';
  this.#store.save('case',caseRecord);
  return caseRecord;
 }
 #buildProposal({span,fact,derived,chunk,document,context,caseId}){
  const quote=sourceQuote(chunk.text,span),createdAt=this.#clock(),unit=derived.numeric;
  const rawValue=unit.numericValue,proposedNormalizedValue=unit.normalizedValue;
  const item={subjectId:document.subjectId,sourceIds:[document.sourceId],chunkIds:[chunk.id],statement:quote,quotedText:quote,researchField:fact.metricOrCategory,category:fact.metricOrCategory,metric:fact.metric,scope:'consolidated_company',factType:fact.explicitOrDerived,rawValue,proposedNormalizedValue,rawUnit:unit.rawUnit,unit:unit.unit,normalization:unit.normalization,observedAt:derived.period.observedAt,periodStart:derived.period.start,periodEnd:derived.period.end,periodStatus:derived.period.status==='known'?'known':'unknown',periodBasis:'quote'};
  const sentChunk={id:chunk.id,source:{id:document.sourceId},contentHash:chunk.contentHash,locator:chunk.locator,documentHash:document.contentHash};
  const validationInput={data:{subjectId:document.subjectId,asOf:context.asOf,timeMode:context.timeMode,generatedAt:createdAt,chunks:[sentChunk]}};
  const validated=validateProposal(this.#index,item,validationInput,new RetrievalLayer(this.#index));
  const provenance={validationVersion,validatorHash,modelProvider:this.#metadata.provider,modelName:this.#metadata.model,modelVersion:this.#metadata.modelVersion,providerKind:this.#metadata.kind,temperature:this.#metadata.temperature,promptVersion:interpretationPromptVersion,promptHash:interpretationPromptHash};
  const identity=proposalIdentity(item,provenance,[chunk.contentHash],validated.validationStatus);
  const proposal=assertProposal({id:stableId('PROP-GROUND',identity),...item,...provenance,inputHash:digest(validationInput),outputHash:digest(quote),rawResponseHash:digest(quote),createdAt,inputSnapshot:validationInput,...validated});
  const stored=this.#proposals?this.#proposals.saveRun({id:stableId('GROUND-ANALYSIS',{proposalId:proposal.id}),subjectId:document.subjectId,caseId,documentId:document.id,page:span.page,spanId:span.id,spanType:span.spanType,groundingVersion,selectionProposalId:null,quote,createdAt,proposalIds:[proposal.id]},[proposal]):{proposals:[proposal]};
  return stored.proposals[0];
 }
 promote(proposalId){
  if(!this.#proposals)throw new Error('Proposal store required');
  const analyst=new EvidenceAnalyst(this.#index,this.#proposals,{provider:null,clock:this.#clock});
  return analyst.promoteProposalToCandidate(proposalId);
 }
 case(id){return this.#store.list('case').find(record=>record.caseId===id)??null;}
 cases(){return this.#store.list('case');}
 selections(){return this.#store.list('selectionProposal');}
 facts(){return this.#store.list('fact');}
}
