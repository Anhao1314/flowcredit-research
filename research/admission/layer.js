import { digest,stableId } from '../src/identity.js';
import { normalizeSource } from '../src/normalize-source.js';
import { validateEvidence } from '../src/extract-evidence.js';
import { instant } from '../memory/time.js';
import { RetrievalLayer } from '../retrieval/layer.js';
import { assertAdmission,rejectionReasons } from './validation.js';
import { mapCandidate,quotationFact,sameFact,admissionFactKey } from './mapping.js';
function fail(code,note){const error=new Error(code+': '+note);error.code=code;throw error;}
export function candidateHash(candidate){return digest(candidate);}
export class AdmissionLayer {
  #index;#memory;#reviews;#allowSystemTest;#clock;
  constructor(index,memory,{allowSystemTest=false,clock=()=>new Date().toISOString()}={}) {
    this.#index=index;this.#memory=memory;this.#clock=clock;this.#allowSystemTest=allowSystemTest;
    if(typeof memory.backend.admissionRecords!=='function')throw new Error('Backend lacks atomic Admission participant');
    this.#reviews=memory.backend.admissionRecords();
  }
  #history(id,at){return this.#reviews.list().filter(r=>r.candidateId===id && (!at || r.recordedAt<=at)).sort((a,b)=>a.version-b.version);}
  #context(id,expectedHash) {
    const candidate=this.#index.get('candidate',id);if(!candidate)fail('candidate_missing','No stored Candidate');
    if(candidateHash(candidate)!==expectedHash)fail('stale_candidate','Expected Candidate hash changed');
    const chunk=this.#index.get('chunk',candidate.chunkId),document=chunk?this.#index.get('document',chunk.documentId):null;
    const source=document?.source??null;
    const validation=new RetrievalLayer(this.#index,{clock:this.#clock}).validateCandidate(candidate);
    const snapshot={candidate,chunk,document:document?(({text,units,...metadata})=>metadata)(document):null,source};
    return {candidate,chunk,document,source,validation,snapshot,hash:digest(snapshot)};
  }
  #options(options,accepted) {
    const allowed=['candidateHash','subjectId','reviewerType','reviewerId','reasonCode','note','fact','existingEvidenceId','supersedesReviewId'];
    if(!options || Object.keys(options).some(k=>!allowed.includes(k)))fail('invalid_request','Unknown review fields; quote editing is forbidden');
    if(!/^sha256:[a-f\d]{64}$/.test(options.candidateHash??'') || typeof options.subjectId!=='string' || !options.subjectId.trim() || typeof options.reviewerId!=='string' || !options.reviewerId.trim() || typeof options.note!=='string' || !options.note.trim())fail('invalid_request','Explicit hash, subject, reviewer ID and note required');
    if(options.reviewerType!=='human' && !(options.reviewerType==='system_test' && this.#allowSystemTest))fail('reviewer_forbidden','Only human; system_test requires explicit test-enabled constructor');
    if(accepted && !['verified_primary_source','verified_existing_evidence'].includes(options.reasonCode) || !accepted && !rejectionReasons.includes(options.reasonCode))fail('invalid_reason','Structured reason required');
    if(!accepted && (options.fact!==undefined || options.existingEvidenceId!==undefined))fail('invalid_request','Reject cannot supply an Evidence mapping');
    if(options.fact!==undefined)assertAdmission('fact',options.fact);
    return digest({decision:accepted?'accepted':'rejected',...options});
  }
  #checkContext(context,at,{accepted,subjectId}) {
    const {candidate,document,source,validation}=context;
    if(candidate.subjectId!==subjectId)fail('wrong_subject','Review subject differs from Candidate');
    if(instant(candidate.createdAt)>at || document && (instant(document.createdAt)>at || instant(document.retrievedAt)>at))fail('temporal_invalid','Review before discovery/indexing');
    if(candidate.availableAt!==null && instant(candidate.availableAt)>at)fail('temporal_invalid','Public Source is future at review time');
    if(accepted) {
      if(validation.validationStatus!=='valid')fail(validation.errors.some(e=>/hash|identity|address|original|temporal/.test(e))?'stale_candidate':'citation_invalid',validation.errors.join(','));
      if(!source?.isPrimarySource || normalizeSource(source).id!==source.id || source.subjectId!==subjectId)fail('source_not_authoritative','Primary Source identity/provenance required');
    }
  }
  #matchExisting(context,mapped,existingId,at) {
    const all=this.#memory.listEvidence(context.candidate.subjectId,{asOf:at,includeSuperseded:false});
    const matches=all.filter(node=>node.evidence.sourceId===mapped.sourceId && node.evidence.page===mapped.page && sameFact(node.evidence,mapped));
    if(existingId && !matches.some(node=>node.evidence.id===existingId))fail('existing_evidence_mismatch','Source/page/explicit fact do not match supplied existing Evidence');
    if(!existingId && matches.length>1)fail('ambiguous_duplicate','Specify the matching existingEvidenceId');
    const match=existingId?matches.find(n=>n.evidence.id===existingId):matches[0];
    if(match)validateEvidence([context.source],[match.evidence]);
    return match??null;
  }
  #review(id,options,accepted) {
    const requestHash=this.#options(options,accepted);
    return this.#index.transaction(()=>this.#memory.transaction(()=>{
      const at=instant(this.#clock()),context=this.#context(id,options.candidateHash);
      this.#checkContext(context,at,{accepted,subjectId:options.subjectId});
      const history=this.#history(id),previous=history.at(-1);
      const repeated=history.find(r=>r.requestHash===requestHash);
      if(repeated){
        if(previous.id!==repeated.id)fail('review_conflict','Old operation was superseded; inspect history');
        return {outcome:repeated.outcome,evidenceId:repeated.resultingEvidenceId,review:repeated,idempotent:true};
      }
      if(previous && options.supersedesReviewId!==previous.id || !previous && options.supersedesReviewId)fail('review_conflict','Explicit latest supersedesReviewId required for a new review');
      let evidenceId=null,factKey=null,mapping=null,outcome='rejected',memoryCreatedAt=null;
      if(accepted) {
        let fact=options.fact;
        if(options.existingEvidenceId && !fact)fail('invalid_request','Existing Evidence match requires explicit reviewed fact');
        fact??=quotationFact(context.candidate,context.source);
        const mapped=mapCandidate(context.candidate,context.chunk,context.source,fact,at);
        factKey=admissionFactKey(context.candidate,mapped);mapping=fact;
        if(history.some(r=>r.decision==='accepted' && r.factKey!==factKey))fail('mapping_conflict','Accepted Candidate fact cannot change; generate a new Candidate');
        const linked=this.#reviews.fact(factKey),existing=this.#matchExisting(context,mapped,options.existingEvidenceId,at);
        if(options.reasonCode==='verified_existing_evidence' && !existing && !linked)fail('existing_evidence_mismatch','No existing Evidence for this reason');
        if(linked){
          const node=this.#memory.getEvidence(linked,{asOf:at});
          if(!node || node.corrections.some(c=>c.supersedesEvidenceId===linked))fail('superseded_evidence','Original admission was corrected; generate a new Candidate');
          if(existing && existing.evidence.id!==linked)fail('ambiguous_duplicate','Linked and existing facts differ');
          evidenceId=linked;memoryCreatedAt=node.createdAt;outcome='already_accepted';
        } else if(existing){evidenceId=existing.evidence.id;memoryCreatedAt=existing.createdAt;outcome='already_accepted';}
        else {
          this.#memory.putSource(context.source);
          const row=this.#memory.putEvidence(mapped);evidenceId=row.payload.id;memoryCreatedAt=row.createdAt;outcome='accepted';
        }
      }
      // A fresh validator, not the old session parse cache. Compare the entire
      // reviewed snapshot just before append; rollback Evidence on any change.
      const final=this.#context(id,options.candidateHash);
      if(final.hash!==context.hash || accepted && final.validation.validationStatus!=='valid')fail('stale_candidate','Reviewed content changed before commit');
      const recordedAt=instant(this.#clock());
      if(recordedAt<at || memoryCreatedAt && recordedAt<memoryCreatedAt)fail('temporal_invalid','Recording clock precedes review/Evidence');
      const version=(previous?.version??0)+1;
      const review={id:stableId('REVIEW',{candidateId:id,version,requestHash}),candidateId:id,subjectId:options.subjectId,version,previousReviewId:previous?.id??null,decision:accepted?'accepted':'rejected',reasonCode:options.reasonCode,reviewerType:options.reviewerType,reviewerId:options.reviewerId,reviewedAt:at,recordedAt,note:options.note,candidateHash:options.candidateHash,requestHash,validationSnapshot:context.validation,snapshot:context.snapshot,resultingEvidenceId:evidenceId,factKey,mapping,availableAt:context.candidate.availableAt,candidateCreatedAt:instant(context.candidate.createdAt),acceptedAt:accepted?recordedAt:null,evidenceMemoryCreatedAt:memoryCreatedAt,outcome};
      assertAdmission('review',review);this.#reviews.append(review);
      return {outcome,evidenceId,review,idempotent:false};
    }),{write:false});
  }
  acceptCandidate(id,options){return this.#review(id,options,true);}
  rejectCandidate(id,options){return this.#review(id,options,false);}
  reviewHistory(id,{asOf}={}) {
    const at=asOf===undefined?null:instant(asOf,{query:true});
    return this.#memory.backend.transaction(()=>{
      const reviews=this.#history(id,at),candidate=this.#index.get('candidate',id)??reviews.at(-1)?.snapshot.candidate;
      return {candidate:candidate && (!at || instant(candidate.createdAt)<=at)?candidate:null,reviews,evidence:reviews.filter(r=>r.resultingEvidenceId).map(r=>this.#memory.getEvidence(r.resultingEvidenceId,{asOf:at??instant(this.#clock())})).filter(Boolean)};
    },{write:false});
  }
  listCandidates(subjectId,{queryId,sourceId,createdFrom,createdTo,retrievalMethod,validationState,state,asOf}={}) {
    const at=instant(asOf??this.#clock(),{query:true}),from=createdFrom?instant(createdFrom,{query:true}):null,to=createdTo?instant(createdTo,{query:true}):null;
    if(state && !['pending','accepted','rejected','stale'].includes(state))fail('invalid_request','Unknown workflow state');
    return this.#memory.backend.transaction(()=>this.#index.transaction(()=>this.#index.list('candidate').filter(c=>c.subjectId===subjectId && instant(c.createdAt)<=at).map(candidate=>{
      const reviews=this.#history(candidate.id,at),latest=reviews.at(-1),validation=new RetrievalLayer(this.#index,{clock:this.#clock}).validateCandidate(candidate);
      const lifecycle=latest?.decision??(asOf!==undefined?'pending':validation.validationStatus==='valid'?'pending':'stale');
      return {candidate,candidateHash:candidateHash(candidate),state:lifecycle,validation,latestReviewId:latest?.id??null};
    }).filter(row=>(!queryId || row.candidate.queryId===queryId) && (!sourceId || row.candidate.sourceId===sourceId) && (!from || instant(row.candidate.createdAt)>=from) && (!to || instant(row.candidate.createdAt)<=to) && (!retrievalMethod || row.candidate.retrievalMethod===retrievalMethod) && (!validationState || row.validation.validationStatus===validationState) && (!state || row.state===state)),{write:false}),{write:false});
  }
  stats(subjectId,options){const rows=this.listCandidates(subjectId,options);return Object.fromEntries(['pending','accepted','rejected','stale'].map(state=>[state,rows.filter(r=>r.state===state).length]));}
  deepProvenance(evidenceId,{asOf}={}) {
    const at=instant(asOf??this.#clock(),{query:true});
    return this.#memory.backend.transaction(()=>{
      const evidence=this.#memory.getEvidence(evidenceId,{asOf:at});if(!evidence)fail('evidence_missing','Evidence unavailable at requested knowledge time');
      const inherited=new Set(),queue=[evidenceId];
      while(queue.length){const id=queue.shift(),node=this.#memory.getEvidence(id,{asOf:at});for(const correction of node?.corrections??[])if(correction.replacementEvidenceId===id && !inherited.has(correction.supersedesEvidenceId)){inherited.add(correction.supersedesEvidenceId);queue.push(correction.supersedesEvidenceId);}}
      const expand=review=>({review,candidate:review.snapshot.candidate,chunk:review.snapshot.chunk,document:review.snapshot.document,source:review.snapshot.source});
      const visible=this.#reviews.list().filter(r=>r.recordedAt<=at);
      return {...evidence,admissions:visible.filter(r=>r.resultingEvidenceId===evidenceId).map(expand),supersessionAdmissions:visible.filter(r=>inherited.has(r.resultingEvidenceId)).map(expand)};
    },{write:false});
  }
}
