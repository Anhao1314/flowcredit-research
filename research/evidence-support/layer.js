import {digest,stableId} from '../src/identity.js';
import {instant} from '../memory/time.js';
import {RetrievalLayer} from '../retrieval/layer.js';
import {sourceQuote,placeholderCell} from '../grounding/facts.js';
import {selectionInstructions,selectionSchema,selectionPromptVersion,selectionPromptHash,interpretationInstructions,interpretationPromptVersion,interpretationPromptHash,parseSelection,parseInterpretation,validateProvider} from './contract.js';
import {buildSelectionHandles,handleAt,parseHandleSelection,selectionHandlesInstructions,selectionHandlesPromptVersion,selectionHandlesPromptHash,selectionHandlesSchema,selectionHandleVersion} from '../selection-handles/handles.js';
import {tableSupportFromSpan,textSupportFromSpan,freezeSupport,supportHash} from './support.js';
import {validateSupportV2,validateFactV2,validationVersionV2,validatorV2Hash} from './validator.js';
import {buildProposalV2,provenanceOf,proposalFactV2} from './proposal.js';
import {interpretationSchema} from './schemas.js';
import {tableIdOfSpan} from './support.js';

function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
function escape(text){return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

// Longest whitespace-tolerant verbatim word run of text that also occurs in
// chunkText. The run is used only as a retrieval anchor; it is never the
// source truth of a fact.
export function longestVerbatimRun(text,chunkText,{minWords=4,minChars=24}={}){
 const words=text.split(/\s+/).filter(Boolean);
 for(let size=words.length;size>=minWords;size--){
  for(let start=0;start+size<=words.length;start++){
   const pattern=new RegExp(words.slice(start,start+size).map(escape).join('\\s+'));
   const match=pattern.exec(chunkText);
   if(match&&match[0].length>=minChars)return {run:match[0],words:size};
  }
 }
 return null;
}
// Candidate identity salt. One Candidate cannot admit two facts, so the fact
// digest has to separate deterministic query identities. The salt must never
// change lexical relevance: the BM25 stage filters rows by queryCoverage over
// distinct query terms, and a hash written as ordinary text pushes one- or
// two-word table anchors below the 0.6 coverage threshold, hiding the anchored
// chunk from Candidate creation. Encoding the digest as punctuation keeps it
// invisible to tokenize() while the raw query string, and with it queryId and
// Candidate identity, still differs per fact.
const saltSymbols='#%()*+,-./:;<=>?';
export function identitySalt(value){
 const hex=String(value).replace(/^sha256:/,'').toLowerCase();
 if(!/^[0-9a-f]+$/.test(hex))throw new Error('Identity salt requires a hex digest');
 return [...hex].map(char=>saltSymbols[parseInt(char,16)]).join('');
}
// The identity line is the only model-facing difference between the canonical
// interface (v0.10/v0.11: "SPAN <id>") and the handle interface (v0.11.1:
// "[S3]"). The body of a span is rendered identically in both.
export function renderSupport(support,{handle=null}={}){
 if(support.type==='table'){
  const lines=[handle?'['+handle+']':'SPAN '+support.spanId,'TABLE: '+(support.tableTitle??'table row'),'ROW: '+(support.rowLabel||'(none)'),'COLUMN: '+support.headerPath.join(', '),'VALUE: '+support.cellText];
  if(support.unitContext)lines.push('UNIT CONTEXT: '+support.unitContext.match);
  return lines.join('\n');
 }
 return [handle?'['+handle+']':'SPAN '+support.spanId,'TEXT: '+support.text].join('\n');
}
export function supportCandidates(sentenceIndex,tableIndex,{documentId,page}){
 const sentences=sentenceIndex.list({documentId,page}).sort((a,b)=>a.documentCharStart-b.documentCharStart||a.id.localeCompare(b.id));
 const tableSpans=tableIndex.list({documentId,page}).flatMap(table=>[...table.cells.values()]).filter(span=>!placeholderCell.test(span.cellText)).sort((a,b)=>a.locator.tableIndex-b.locator.tableIndex||a.locator.rowIndex-b.locator.rowIndex||a.locator.columnIndex-b.locator.columnIndex);
 const supports=[...sentences.map(textSupportFromSpan),...tableSpans.map(span=>tableSupportFromSpan(span,tableIndex.get(tableIdOfSpan(span))))];
 return supports.map(freezeSupport);
}

export class EvidenceSupportAnalyst {
 #index;#registry;#sentences;#tables;#store;#provider;#metadata;#clock;#timeout;#maxSpansPerCase;#retrieve;#onCall;#selectionInterface;
 constructor(index,registry,{sentences,tables,store,provider=null,clock=()=>new Date().toISOString(),timeoutMs=60000,maxSpansPerCase=24,retrieve=null,onCall=null,selectionInterface='spans'}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new Error('Bounded timeout required');
  if(!Number.isInteger(maxSpansPerCase)||maxSpansPerCase<1||maxSpansPerCase>60)throw new Error('Bounded interpretation budget required');
  if(retrieve!==null&&typeof retrieve!=='function')throw new Error('Retrieval hook must be a function');
  if(onCall!==null&&typeof onCall!=='function')throw new Error('Progress hook must be a function');
  if(!['spans','handles'].includes(selectionInterface))throw new Error('Unknown selection interface');
  this.#index=index;this.#registry=registry;this.#sentences=sentences;this.#tables=tables;this.#store=store;this.#clock=clock;this.#timeout=timeoutMs;this.#maxSpansPerCase=maxSpansPerCase;this.#retrieve=retrieve;this.#selectionInterface=selectionInterface;
  this.#onCall=onCall;
  this.#provider=provider?validateProvider(provider):null;this.#metadata=provider?structuredClone(provider.metadata):null;
 }
 get provider(){return this.#metadata;}
 #caseContext({documentId,page,subjectId,asOf,timeMode='replay'}){
  const document=this.#registry.document(documentId);
  if(!document||document.subjectId!==subjectId)throw new Error('SOURCE_IDENTITY_INVALID');
  if(!Number.isInteger(page)||page<document.firstPage||page>document.pageCount)throw new Error('PAGE_OUT_OF_RANGE');
  if(!['replay','audit'].includes(timeMode))throw new Error('Unknown time mode');
  const at=instant(this.#clock());
  if(document.availableAt&&instant(document.availableAt,{query:true})>at)throw new Error('TEMPORAL_INVALID');
  return {document,context:{subjectId,asOf:instant(asOf,{query:true}),timeMode},at};
 }
 chunksFor(document,page){return this.#index.list('chunk').filter(chunk=>chunk.sourceId===document.sourceId&&chunk.page===page);}
 async #call(input,name,{caseId=null,spanId=null}={}){
  if(!this.#provider)return {status:'unavailable',error:'PROVIDER_UNAVAILABLE'};
 const frozen=freeze(input),inputHash=digest(frozen),started=performance.now(),controller=new AbortController();let timer,raw=null,error=null;
  this.#onCall?.({event:'start',phase:name,caseId,candidateCount:input.data?.availableSpanIds?.length??input.data?.availableHandles?.length??null,contextChars:input.data?.context?.length??null});
  try{raw=await Promise.race([this.#provider.analyzeEvidence(frozen,{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('PROVIDER_TIMEOUT'));},this.#timeout);})]);
   if(digest(frozen)!==inputHash||digest(this.#provider.metadata)!==digest(this.#metadata))throw new Error('INPUT_OR_PROVIDER_MUTATION');
  }catch(caught){error=/^(?:PROVIDER_[A-Z_]+|INPUT_OR_PROVIDER_MUTATION)$/.test(caught.message)?caught.message:'PROVIDER_ERROR';}finally{clearTimeout(timer);}
 const latencyMs=performance.now()-started,run={id:stableId('SUPPORT-RUN',{name,caseId,spanId,inputHash,rawHash:typeof raw==='string'?digest(raw):null,at:this.#clock()}),name,caseId,spanId,provider:this.#metadata,promptVersion:name==='selection'?selectionPromptVersion:interpretationPromptVersion,inputHash,outputHash:typeof raw==='string'?digest(raw):null,latencyMs,status:error?'provider_error':'completed',error,createdAt:this.#clock()};
 this.#store.save('providerRun',run);
  const receipts=this.#provider.receipts?.slice(-1)??[];
  this.#onCall?.({event:'end',phase:name,caseId,elapsedMs:latencyMs,status:error?'provider_error':'completed',error,inputTokens:receipts.at(-1)?.usage?.inputTokens??null,outputTokens:receipts.at(-1)?.usage?.outputTokens??null});
  return {status:error?'provider_error':'completed',raw,error,receipts,latencyMs,run};
 }
 async analyzeCase({caseId=null,documentId,page,subjectId,asOf,timeMode='replay'}){
  const {document,context}=this.#caseContext({documentId,page,subjectId,asOf,timeMode});
  const candidates=supportCandidates(this.#sentences,this.#tables,{documentId,page});
  if(!candidates.length)throw new Error('NO_SPANS');
  // Optional pre-model narrowing. Retrieval only reorders and bounds the already
  // verified SourceSupports of this page; it never edits a support, never changes
  // the prompt contract and never touches validation downstream.
  let supports=candidates,retrieval=null;
  if(this.#retrieve){
   const outcome=await this.#retrieve({candidates,documentId,page,subjectId,asOf:context.asOf,timeMode:context.timeMode,caseId,document});
   supports=outcome?.supports??candidates;retrieval=outcome?.receipt??null;
  }
  if(!supports.length){
   const abstained={caseId,documentId,page,subjectId,asOf:context.asOf,timeMode:context.timeMode,status:'RETRIEVAL_ABSTAINED',candidateCount:candidates.length,retrievedCount:0,retrieval,selectionRun:null,fabricated:[],selectedSpanIds:[],selections:[],errors:[]};
   this.#store.save('case',abstained);return abstained;
  }
  // v0.11.1: the model selects invocation-local handles (S1..SN over the frozen
  // candidate order) instead of copying canonical span ids. The canonical set is
  // still what the prompt is built from and still what every downstream record
  // carries; only the model-facing label changes.
  const handleMode=this.#selectionInterface==='handles';
  const handles=handleMode?buildSelectionHandles(supports.map(support=>support.spanId)):null;
  const handleOfSpan=handleMode?new Map(handles.entries.map(entry=>[entry.spanId,entry.handle])):null;
  const availableSpanIds=supports.map(support=>support.spanId);
  const selectionContext=handleMode?supports.map((support,index)=>renderSupport(support,{handle:handleAt(index+1)})).join('\n\n'):supports.map(renderSupport).join('\n\n');
  const selectionInput=handleMode?{instructions:selectionHandlesInstructions,outputSchema:selectionHandlesSchema(handles.availableHandles),promptVersion:selectionHandlesPromptVersion,promptHash:selectionHandlesPromptHash,data:{subjectId,asOf:context.asOf,timeMode:context.timeMode,generatedAt:this.#clock(),document:{id:document.id,sourceId:document.sourceId,page},page,availableHandles:handles.availableHandles,context:selectionContext}}:{instructions:selectionInstructions,outputSchema:selectionSchema,promptVersion:selectionPromptVersion,promptHash:selectionPromptHash,data:{subjectId,asOf:context.asOf,timeMode:context.timeMode,generatedAt:this.#clock(),document:{id:document.id,sourceId:document.sourceId,page},page,availableSpanIds,context:selectionContext}};
  const selectionRun=await this.#call(selectionInput,'selection',{caseId});
  const caseRecord={caseId,documentId,page,subjectId,asOf:context.asOf,timeMode:context.timeMode,selectionRun:selectionRun.run,candidateCount:candidates.length,retrievedCount:supports.length,retrieval,fabricated:[],invalidHandles:[],selectedSpanIds:[],selections:[],errors:[]};
  if(handleMode)caseRecord.selectionInterface={version:selectionHandleVersion,handles:handles.entries.map(entry=>({handle:entry.handle,spanId:entry.spanId,rank:entry.rank}))};
  if(selectionRun.status==='provider_error'){caseRecord.status=selectionRun.error;this.#store.save('case',caseRecord);return caseRecord;}
  let parsed,items;
  try{
   if(handleMode){parsed=parseHandleSelection(selectionRun.raw,handles);items=parsed.selections.map(selection=>({spanIds:[selection.spanId],factKind:selection.factKind}));}
   else{parsed=parseSelection(selectionRun.raw,availableSpanIds);items=parsed.value;}
  }catch(error){
   caseRecord.status=error.message==='INVALID_SPAN_REFERENCE'?'FABRICATED_SPAN':['INVALID_SELECTION_HANDLE','DUPLICATE_SELECTION_HANDLE'].includes(error.message)?error.message:'SPAN_SCHEMA_ERROR';
   if(error.fabricated)caseRecord.fabricated=error.fabricated;
   if(error.invalid)caseRecord.invalidHandles=error.invalid;
   caseRecord.rawResponse=selectionRun.raw;this.#store.save('case',caseRecord);return caseRecord;
  }
  caseRecord.wrapperRemoved=parsed.wrapperRemoved;
  const bySpan=new Map(supports.map(support=>[support.spanId,support]));
  const seen=new Set(),queue=[];
  for(const item of items)for(const spanId of item.spanIds)if(!seen.has(spanId)){seen.add(spanId);queue.push({spanId,factKind:item.factKind});}
  if(queue.length>this.#maxSpansPerCase)queue.length=this.#maxSpansPerCase;
  caseRecord.selectedSpanIds=queue.map(entry=>entry.spanId);
  const selectionProposal={id:stableId('SUPPSEL',{caseId,documentId,page,inputHash:selectionRun.run.inputHash,outputHash:selectionRun.run.outputHash,ids:queue.map(q=>q.spanId)}),caseId,subjectId,documentId,page,interface:handleMode?'handles':'spans',spanIds:queue.map(entry=>entry.spanId),handles:handleMode?queue.map(entry=>({handle:handleOfSpan.get(entry.spanId),spanId:entry.spanId})):null,factKind:queue[0]?.factKind??null,provider:this.#metadata?.provider??null,model:this.#metadata?.model??null,promptVersion:handleMode?selectionHandlesPromptVersion:selectionPromptVersion,promptHash:handleMode?selectionHandlesPromptHash:selectionPromptHash,inputHash:selectionRun.run.inputHash,outputHash:selectionRun.run.outputHash,createdAt:this.#clock()};
  this.#store.save('selectionProposal',selectionProposal);
  caseRecord.selectionProposalId=selectionProposal.id;
  for(const {spanId,factKind} of queue){
   const support=bySpan.get(spanId);
   const supportVerdict=validateSupportV2({registry:this.#registry,sentenceIndex:this.#sentences,tableIndex:this.#tables},support,{subjectId,asOf:context.asOf,timeMode,documentId});
   if(!supportVerdict.valid){caseRecord.errors.push({spanId,error:'SUPPORT_INVALID',findings:supportVerdict.findings});continue;}
   const interpretationSpan=handleMode?{handle:handleOfSpan.get(support.spanId),spanType:support.type,page:support.page,factKind}:{id:support.spanId,spanType:support.type,page:support.page,factKind};
   const interpretationInput={instructions:interpretationInstructions,outputSchema:interpretationSchema,promptVersion:interpretationPromptVersion,promptHash:interpretationPromptHash,data:{subjectId,asOf:context.asOf,timeMode:context.timeMode,span:interpretationSpan,evidenceText:handleMode?renderSupport(support,{handle:handleOfSpan.get(support.spanId)}):renderSupport(support),source:{id:document.sourceId,documentDate:document.availableAt}}};
   const interpretation=await this.#call(interpretationInput,'interpretation',{caseId,spanId});
   const record={spanId,factKind,supportType:support.type,run:interpretation.run};
   if(interpretation.status==='provider_error'){record.status=interpretation.error;caseRecord.selections.push(record);continue;}
   let fact;
   try{fact=parseInterpretation(interpretation.raw);}
   catch{record.status='INTERPRETATION_SCHEMA_ERROR';record.rawResponseHash=digest(interpretation.raw);caseRecord.selections.push(record);continue;}
   const validated=validateFactV2(support,fact.value);
   const factRecord={id:stableId('SUPPORT-FACT',{caseId,spanId,outputHash:interpretation.run.outputHash}),caseId,spanId,supportType:support.type,factKind,metricOrCategory:fact.value.metricOrCategory,metric:fact.value.metric,rawValueText:fact.value.rawValueText,rawUnitText:fact.value.rawUnitText,periodText:fact.value.periodText,actualOrGuidance:fact.value.actualOrGuidance,explicitOrDerived:fact.value.explicitOrDerived,parse:validated.parse,validation:{status:validated.status,findings:validated.findings},promptVersion:interpretationPromptVersion,promptHash:interpretationPromptHash,inputHash:interpretation.run.inputHash,outputHash:interpretation.run.outputHash,createdAt:this.#clock()};
   this.#store.save('factV2',factRecord);
   record.factId=factRecord.id;record.status='interpreted';record.findings=validated.findings;record.value=fact.value;
   record.parse={status:validated.status,findings:validated.findings,numeric:validated.parse.numeric,period:validated.parse.period};
   // Provenance records the interface that actually produced the selection, so a
   // handle-mode proposal can never claim to come from the canonical prompt.
   const selectionPrompt=handleMode?{version:selectionHandlesPromptVersion,hash:selectionHandlesPromptHash}:{version:selectionPromptVersion,hash:selectionPromptHash};
   const provenance=provenanceOf(this.#metadata??{provider:'unavailable',model:'unavailable',modelVersion:'unavailable',kind:'test',temperature:0},{parserVersion:support.parserVersion,groundingVersion:support.groundingVersion,segmentationVersion:support.type==='text'?support.segmentationVersion:null,selection:selectionPrompt,interpretation:{version:interpretationPromptVersion,hash:interpretationPromptHash}});
   const proposal=buildProposalV2({support,fact:fact.value,validated,provenance,createdAt:this.#clock(),outputHash:interpretation.run.outputHash,inputHash:digest({selection:selectionRun.run.inputHash,interpretation:interpretation.run.inputHash,support:support.supportHash})});
   this.#store.save('proposalV2',proposal);
   record.proposal={id:proposal.id,validationStatus:proposal.validation.status,validationFindings:proposal.validation.findings};
   caseRecord.selections.push(record);
  }
  caseRecord.status=caseRecord.selections.some(entry=>entry.proposal?.validationStatus==='validated')?'generated':'abstained_or_unsupported';
  this.#store.save('case',caseRecord);
  return caseRecord;
 }
 promote(proposalId,{asOf,timeMode='replay'}={}){
  if(typeof asOf!=='string'||!asOf)throw new Error('Explicit asOf required for promotion');
  const proposal=this.#store.get('proposalV2',proposalId);
  if(!proposal)throw new Error('Proposal missing');
  const support=proposal.support;
  const supportVerdict=validateSupportV2({registry:this.#registry,sentenceIndex:this.#sentences,tableIndex:this.#tables},support,{subjectId:proposal.subjectId,asOf,timeMode});
  if(!supportVerdict.valid)throw new Error('Support invalid: '+supportVerdict.findings.join(','));
  const factVerdict=validateFactV2(support,{metric:proposal.metric,metricOrCategory:proposal.category,rawValueText:proposal.rawValueText,rawUnitText:proposal.rawUnitText,periodText:proposal.periodText,actualOrGuidance:proposal.fact.actualOrGuidance,explicitOrDerived:proposal.fact.explicitOrDerived});
  if(factVerdict.status!=='validated')throw new Error('Fact not validated: '+factVerdict.findings.join(','));
  const document=this.#registry.document(support.documentId);
  const chunks=this.chunksFor(document,support.page);
  let anchor=null;
  for(const chunk of chunks){
   const found=support.type==='text'?longestVerbatimRun(support.text,chunk.text):(()=>{const run=sourceQuote(chunk.text,{spanType:'table',cellText:support.cellText,rowLabel:support.rowLabel});return run?{run,words:run.split(/\s+/).length}:null;})();
   if(found){anchor={chunk,run:found.run};break;}
  }
  if(!anchor)throw new Error('NO_RETRIEVAL_ANCHOR');
  const query=anchor.run.slice(0,1800)+' '+identitySalt(digest(proposalFactV2(proposal)));
  const candidate=new RetrievalLayer(this.#index,{clock:this.#clock}).createCandidate(anchor.chunk.id,{query,subjectId:support.subjectId,asOf,timeMode,mode:'lexical',quotedText:anchor.run});
  if(candidate.validationStatus!=='valid')throw new Error('Candidate citation invalid: '+(candidate.errors??[]).join(','));
  const id=stableId('SCAND',{candidateId:candidate.id,supportHash:support.supportHash}),existing=this.#store.get('supportCandidate',id);
  if(existing)return {proposalId,supportCandidateId:existing.id,candidateId:existing.candidateId,anchor:existing.anchor,admissionRequired:'Explicit human review through v0.4; no Evidence written',idempotent:true};
  const record={id,proposalId,candidateId:candidate.id,subjectId:support.subjectId,supportVersion:support.supportVersion,support,supportHash:support.supportHash,anchor:{chunkId:anchor.chunk.id,quotedText:anchor.run,words:anchor.words??anchor.run.split(/\s+/).length},fact:proposalFactV2(proposal),validation:{version:validationVersionV2,validatorHash:validatorV2Hash,findings:[]},createdAt:this.#clock(),admissionRequired:true,evidenceWritten:false};
  const saved=this.#store.save('supportCandidate',record);
  return {proposalId,supportCandidateId:saved.id,candidateId:saved.candidateId,anchor:saved.anchor,admissionRequired:'Explicit human review through v0.4; no Evidence written',idempotent:false};
 }
 cases(){return this.#store.list('case');}
 case(id){return this.#store.list('case').find(record=>record.caseId===id)??null;}
 proposals(){return this.#store.list('proposalV2');}
 facts(){return this.#store.list('factV2');}
 supportCandidates(){return this.#store.list('supportCandidate');}
}
