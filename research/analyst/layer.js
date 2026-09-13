import {digest,stableId} from '../src/identity.js';
import {proposalIdentity} from './identity.js';
import {instant} from '../memory/time.js';
import {RetrievalLayer,cutoffVisible} from '../retrieval/layer.js';
import {instructions,outputSchema,promptVersion,promptHash,parseOutput,validateProvider,assertProposal} from './contract.js';
import {freshChunk,validateProposal,proposalFact,validationVersion,validatorHash} from './validation.js';
function freeze(v){if(v && typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
export class EvidenceAnalyst {
 #index;#store;#provider;#metadata;#clock;#timeout;
 constructor(index,store,{provider=null,clock=()=>new Date().toISOString(),timeoutMs=30000}={}){
  if(!Number.isInteger(timeoutMs) || timeoutMs<1 || timeoutMs>60000)throw new Error('Bounded timeout required');
  this.#index=index;this.#store=store;this.#clock=clock;this.#timeout=timeoutMs;this.#provider=provider?validateProvider(provider):null;this.#metadata=provider?structuredClone(provider.metadata):null;
 }
 #context(options={}){
  if(Object.keys(options).some(k=>!['subjectId','asOf','timeMode','limit'].includes(k)) || !options.subjectId)throw new Error('Explicit subject and supported context only; no Claim state');
  const timeMode=options.timeMode??'audit';if(!['audit','replay'].includes(timeMode))throw new Error('Unknown temporal mode');
  const limit=options.limit??5;if(!Number.isInteger(limit) || limit<1 || limit>10)throw new Error('limit must be 1..10');
  return {subjectId:options.subjectId,asOf:instant(options.asOf??this.#clock(),{query:true}),timeMode,limit};
 }
 #select(ids,context,generatedAt){
  const validator=new RetrievalLayer(this.#index);
  return this.#index.transaction(()=>ids.map(id=>{
   const chunk=this.#index.get('chunk',id),doc=chunk?this.#index.get('document',chunk.documentId):null;
   if(!chunk || !doc || chunk.subjectId!==context.subjectId || doc.subjectId!==context.subjectId || doc.source.subjectId!==context.subjectId)throw new Error('Wrong subject or missing chunk');
   if(instant(doc.createdAt)>generatedAt || instant(doc.retrievedAt)>generatedAt)throw new Error('Analysis before discovery/indexing');
   if(!cutoffVisible(chunk,context.asOf,context.timeMode) || !cutoffVisible(doc,context.asOf,context.timeMode))throw new Error('temporal_cutoff: ineligible provider input');
   if(freshChunk(this.#index,id,context,validator).validation.validationStatus!=='valid')throw new Error('citation_invalid: source cannot reach provider');
   const source={id:doc.source.id,subjectId:doc.source.subjectId,title:doc.source.title,publisher:doc.source.publisher,sourceType:doc.source.sourceType,documentDate:doc.source.documentDate,fiscalPeriod:doc.source.fiscalPeriod,fiscalYear:doc.source.fiscalYear,isPrimarySource:doc.source.isPrimarySource};
   return {id:chunk.id,documentId:doc.id,source,text:chunk.text,contentHash:chunk.contentHash,documentHash:doc.contentHash,locator:chunk.locator,availableAt:chunk.availableAt};
  }),{write:false});
 }
 async #run(ids,context,mode,query){
  if(!this.#provider)return {status:'unavailable',reason:'Real LLM extraction benchmark unavailable; no provider configured',proposals:[]};
  const generatedAt=instant(this.#clock()),chunks=this.#select(ids,context,generatedAt);
  const input=freeze({instructions,outputSchema,promptVersion,promptHash,data:{subjectId:context.subjectId,asOf:context.asOf,timeMode:context.timeMode,generatedAt,mode,query:query??null,chunks}}),inputHash=digest(input);
  if(!chunks.length)return {status:'abstained',proposals:[],inputHash,inputChunkIds:[],provider:this.#metadata};
  const controller=new AbortController();let timer,raw;
  try{raw=await Promise.race([this.#provider.analyzeEvidence(input,{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Analyst provider timeout'));},this.#timeout);})]);}
  finally{clearTimeout(timer);}
  if(digest(input)!==inputHash)throw new Error('Provider input mutated');
  if(digest(this.#provider.metadata)!==digest(this.#metadata))throw new Error('Provider metadata mutated');
  if(typeof raw!=='string' || Buffer.byteLength(raw)>200000)throw new Error('Invalid/oversized structured response');
  const outputHash=digest(raw),completedAt=instant(this.#clock());
  if(completedAt<generatedAt)throw new Error('Analyst clock moved backwards');
  let output;try{output=parseOutput(raw);}catch(error){const run={id:stableId('ANALYSIS-INVALID',{inputHash,outputHash}),...this.#metadata,promptVersion,promptHash,inputHash,outputHash,rawResponseHash:outputHash,rawResponse:raw,inputSnapshot:input,createdAt:completedAt,status:'invalid_output',error:'structured_output_invalid',proposalIds:[]};this.#store.saveRun(run,[]);throw error;}
  const provenance={validationVersion,validatorHash,modelProvider:this.#metadata.provider,modelName:this.#metadata.model,modelVersion:this.#metadata.modelVersion,providerKind:this.#metadata.kind,temperature:this.#metadata.temperature,promptVersion,promptHash};
  const validator=new RetrievalLayer(this.#index);
  const proposals=output.map(item=>{
   const validated=validateProposal(this.#index,item,input,validator),identity=proposalIdentity(item,provenance,item.chunkIds.map(id=>chunks.find(c=>c.id===id)?.contentHash??null),validated.validationStatus);
   return assertProposal({id:stableId('PROP',identity),...item,...provenance,inputHash,outputHash,rawResponseHash:outputHash,createdAt:completedAt,...validated,inputSnapshot:input});
  });
  const run={id:stableId('ANALYSIS',{inputHash,outputHash,...provenance}),...provenance,inputHash,outputHash,rawResponseHash:outputHash,rawResponse:raw,inputSnapshot:input,createdAt:completedAt,proposalIds:[...new Set(proposals.map(p=>p.id))]};
  const saved=this.#store.saveRun(run,proposals);
  return {status:output.length?'generated':'abstained',...saved,inputChunkIds:ids,provider:this.#metadata};
 }
 async analyzeChunk(id,options){const context=this.#context(options);return this.#run([id],context,'direct_chunk',null);}
 async analyze(query,options){const context=this.#context(options),response=new RetrievalLayer(this.#index,{clock:this.#clock}).searchLexical(query,context);return this.#run(response.results.map(r=>r.chunkId),context,'retrieval_assisted',query);}
 proposal(id){const p=this.#store.get(id);if(!p)throw new Error('Proposal missing');return {...p,lifecycle:this.#store.promotion(id)?'converted_to_candidate':p.validationStatus,promotion:this.#store.promotion(id)};}
 proposals(subject){return this.#store.list(subject).map(p=>this.proposal(p.id));}
 promoteProposalToCandidate(id){
  const p=this.#store.get(id);if(!p)throw new Error('Proposal missing');
  const at=instant(this.#clock());if(at<instant(p.createdAt))throw new Error('Promotion before Proposal creation');
  if(p.validatorHash!==validatorHash)throw new Error('Validation policy changed; regenerate Proposal');
  if(digest(p.inputSnapshot)!==p.inputHash)throw new Error('input_hash_mismatch');
  const validation=validateProposal(this.#index,p,p.inputSnapshot);if(validation.validationStatus!=='validated' || p.validationStatus!=='validated')throw new Error('not_admissible: '+validation.validationFindings.join(','));
  const context=p.inputSnapshot.data;
  const baseQuery=context.mode==='retrieval_assisted'?context.query:p.quotedText;
  // One Candidate cannot admit two facts. An unmatched context token separates
  // deterministic query identities without changing the retrieval engine.
  const query=baseQuery.slice(0,1800)+' '+digest(proposalFact(p));
  const candidate=new RetrievalLayer(this.#index,{clock:this.#clock}).createCandidate(p.chunkIds[0],{query,subjectId:p.subjectId,asOf:context.asOf,timeMode:context.timeMode,mode:'lexical',quotedText:p.quotedText});
  if(candidate.validationStatus!=='valid')throw new Error('Candidate citation invalid');
  const old=this.#store.promotion(id),event={proposalId:id,candidateId:candidate.id,candidateHash:digest(this.#index.get('candidate',candidate.id)),promotedAt:instant(this.#clock()),fact:proposalFact(p)};
  if(event.promotedAt<at)throw new Error('Promotion clock moved backwards');
  const saved=this.#store.promote(event);return {proposalId:id,candidateId:saved.candidateId,event:saved,idempotent:!!old,admissionRequired:'Explicit human review through v0.4; no Evidence written'};
 }
 // Pass only a read capability, never AdmissionLayer or Memory, for optional review linkage.
 reviewLineage(id,{readCandidateHistory}={}){const p=this.proposal(id);if(typeof readCandidateHistory!=='function')throw new Error('Read-only Candidate history capability required');return {...p,reviewHistory:p.promotion?readCandidateHistory(p.promotion.candidateId):null};}
}
