import { assertSchema } from '../src/schema.js';
import { normalizeSource } from '../src/normalize-source.js';
import { validateEvidence } from '../src/extract-evidence.js';
import { validateClaims } from '../src/build-claims.js';
import { canonical, digest, stableId } from '../src/identity.js';
import { validateMemory } from './validation.js';
import { instant, visible, requireAvailable } from './time.js';
import { diffStates } from './diff.js';

const semantic = claim => {
  const { createdAt,updatedAt,...rest }=claim;
  return canonical({...rest,supportingEvidenceIds:[...rest.supportingEvidenceIds].sort(),counterEvidenceIds:[...rest.counterEvidenceIds].sort()});
};
const added = (next,previous) => next.filter(id=>!previous.includes(id));
export class ResearchMemory {
  constructor(backend,{clock=()=>new Date().toISOString()}={}) {
    for(const method of ['get','list','append','transaction','close']) if(typeof backend?.[method]!=='function') throw new Error(`Missing storage interface: ${method}`);
    this.backend=backend;this.clock=clock;
  }
  now() { return instant(this.clock()); }
  transaction(fn) { return this.backend.transaction(()=>fn(this)); }
  #read(fn) { return this.backend.transaction(fn,{write:false}); }
  #row(kind,id) { return this.backend.get(kind,id); }
  #all(kind,subjectId) { return this.backend.list(kind).filter(row=>subjectId===undefined || row.payload.subjectId===subjectId); }
  putSource(source) {
    return this.transaction(()=> {
      assertSchema('source',source);
      if(normalizeSource(source).id!==source.id) throw new Error('Source identity mismatch');
      const existing=this.#row('source',source.id);
      if(existing) {
        const comparable=value=>{ const {retrievedAt,...rest}=value;return rest; };
        if(digest(comparable(existing.payload))!==digest(comparable(source))) throw new Error('Immutable Source conflict; replacement requires a new explicit identity');
        return existing;
      }
      const now=this.now();
      if(instant(source.retrievedAt)>now) throw new Error('Source retrieval after memory creation');
      this.backend.append('source',source,now);
      return this.#row('source',source.id);
    });
  }
  putEvidence(evidence) {
    return this.transaction(()=> {
      const existing=this.#row('evidence',evidence.id);
      if(existing) {
        const comparable=value=>{const {createdAt,...rest}=value;return rest;};
        if(digest(comparable(existing.payload))!==digest(comparable(evidence))) throw new Error('Immutable Evidence conflict; append a correction');
        assertSchema('evidence',evidence);return existing;
      }
      const source=this.#row('source',evidence.sourceId),now=this.now();
      requireAvailable(source,now,'Source');
      validateEvidence([source.payload],[evidence]);
      if(instant(evidence.createdAt)>now) throw new Error('Evidence extraction after memory creation');
      this.backend.append('evidence',evidence,now,[{kind:'source',id:evidence.sourceId,role:'source'}]);
      return this.#row('evidence',evidence.id);
    });
  }
  #corrections(id,at) { return this.#all('correction').filter(row=>visible(row,at) && (row.payload.supersedesEvidenceId===id || row.payload.replacementEvidenceId===id)).map(row=>row.payload); }
  #evidenceNode(row,at) {
    requireAvailable(row,at,'Evidence');
    const source=this.#row('source',row.payload.sourceId);requireAvailable(source,at,'Source');
    return { evidence:row.payload,createdAt:row.createdAt,source:{source:source.payload,createdAt:source.createdAt},corrections:this.#corrections(row.payload.id,at) };
  }
  getSource(id) { return this.#read(()=>this.#row('source',id)); }
  getEvidence(id,{asOf=this.now()}={}) {
    const at=instant(asOf,{query:true});
    return this.#read(()=>{const row=this.#row('evidence',id);return row && visible(row,at)?this.#evidenceNode(row,at):null;});
  }
  listEvidence(subjectId,{asOf=this.now(),includeSuperseded=true}={}) {
    const at=instant(asOf,{query:true});
    return this.#read(()=>this.#all('evidence',subjectId).filter(row=>visible(row,at)).filter(row=>includeSuperseded || !this.#corrections(row.payload.id,at).some(c=>c.supersedesEvidenceId===row.payload.id)).map(row=>this.#evidenceNode(row,at)));
  }
  #history(id) { return this.#all('revision').filter(row=>row.payload.claimId===id).sort((a,b)=>a.payload.version-b.payload.version); }
  #writeRevision(identity,claim,previous,{effectiveAt,revisionReason,note='',staleEvaluation=null}) {
    const now=this.now(),at=instant(effectiveAt??now);
    requireAvailable(identity,at,'Claim identity');
    if(at>now) throw new Error('Future effectiveAt is not supported');
    if(previous && (at<previous.payload.effectiveAt || now<previous.createdAt)) throw new Error('Revision temporal order violation');
    const snapshot={...claim,id:identity.payload.id,subjectId:identity.payload.subjectId,createdAt:identity.createdAt,updatedAt:now};
    if(claim.id!==identity.payload.id || claim.subjectId!==identity.payload.subjectId) throw new Error('Claim identity/subject cannot change');
    const references=[...snapshot.supportingEvidenceIds,...snapshot.counterEvidenceIds];
    const evidence=references.map(id=>{
      const row=this.#row('evidence',id);requireAvailable(row,at,'Evidence');
      requireAvailable(this.#row('source',row.payload.sourceId),at,'Source');
      if(this.#corrections(id,now).some(c=>c.supersedesEvidenceId===id)) throw new Error('New revision cannot depend on superseded evidence');
      return row.payload;
    });
    validateClaims(evidence,[snapshot]);
    if(snapshot.status==='partially_supported' && !snapshot.supportingEvidenceIds.length) throw new Error('Partially supported revision requires supporting Evidence');
    if(snapshot.status==='disputed' && (!snapshot.supportingEvidenceIds.length || !snapshot.counterEvidenceIds.length)) throw new Error('Disputed revision requires supporting and counter Evidence');
    if(revisionReason==='stale_evidence') {
      const latest=evidence.map(item=>item.observedAt).sort().at(-1);
      if(snapshot.status!=='stale' || !latest || !staleEvaluation || staleEvaluation.referenceDate!==at || staleEvaluation.latestObservedAt!==latest || !Number.isInteger(staleEvaluation.maxAgeDays) || staleEvaluation.maxAgeDays<0 || (Date.parse(at)-Date.parse(latest))/86400000<=staleEvaluation.maxAgeDays) throw new Error('stale_evidence requires a valid explicit age evaluation');
    } else if(staleEvaluation!==null) throw new Error('Stale evaluation only applies to stale_evidence revisions');
    const old=previous?.payload.claim;
    if(revisionReason==='new_counter_evidence' && (!old || !added(snapshot.counterEvidenceIds,old.counterEvidenceIds).length)) throw new Error('new_counter_evidence requires a new counter reference');
    if(revisionReason==='new_supporting_evidence' && (!old || !added(snapshot.supportingEvidenceIds,old.supportingEvidenceIds).length)) throw new Error('new_supporting_evidence requires a new supporting reference');
    if(revisionReason==='evidence_corrected') {
      const oldRefs=old?[...old.supportingEvidenceIds,...old.counterEvidenceIds]:[];
      if(!this.#all('correction').some(row=>visible(row,at) && oldRefs.includes(row.payload.supersedesEvidenceId) && references.includes(row.payload.replacementEvidenceId))) throw new Error('evidence_corrected requires a recorded replacement reference');
    }
    const version=previous?previous.payload.version+1:1;
    const revision={id:`${identity.payload.id}:v${version}`,subjectId:identity.payload.subjectId,claimId:identity.payload.id,version,previousVersion:previous?.payload.version??null,previousRevisionId:previous?.payload.id??null,claim:snapshot,effectiveAt:at,createdAt:now,revisionReason,note,staleEvaluation};
    validateMemory('revision',revision);
    if(previous && revisionReason==='initial_ingest') throw new Error('initial_ingest is only valid for v1');
    const links=[{kind:'identity',id:identity.payload.id,role:'identity'},...snapshot.supportingEvidenceIds.map(id=>({kind:'evidence',id,role:'support'})),...snapshot.counterEvidenceIds.map(id=>({kind:'evidence',id,role:'counter'}))];
    if(previous) links.push({kind:'revision',id:previous.payload.id,role:'previous'});
    this.backend.append('revision',revision,now,links);
    return revision;
  }
  createClaim(claim,{revisionReason='initial_ingest',note=''}={}) {
    return this.transaction(()=> {
      assertSchema('claim',claim);
      const existing=this.#row('identity',claim.id);
      if(existing) {
        const first=this.#history(claim.id)[0];
        if(!first || digest(semantic(first.payload.claim))!==digest(semantic(claim))) throw new Error('Claim identity already exists; use reviseClaim');
        return first.payload;
      }
      const now=this.now();
      if(instant(claim.createdAt)>now || instant(claim.updatedAt)>now) throw new Error('Claim extraction after memory creation');
      const identity={id:claim.id,subjectId:claim.subjectId,createdAt:now};validateMemory('identity',identity);
      this.backend.append('identity',identity,now);
      return this.#writeRevision(this.#row('identity',claim.id),claim,null,{effectiveAt:now,revisionReason,note});
    });
  }
  reviseClaim(id,changes,options) {
    return this.transaction(()=> {
      const identity=this.#row('identity',id),previous=this.#history(id).at(-1);
      if(!identity || !previous) throw new Error('Unknown Claim');
      if(!options?.revisionReason) throw new Error('Revision requires structured reason');
      if(options.expectedVersion!==undefined && options.expectedVersion!==previous.payload.version) throw new Error('Claim version conflict');
      const claim={...previous.payload.claim,...changes};
      assertSchema('claim',claim);
      return this.#writeRevision(identity,claim,previous,options);
    });
  }
  correctEvidence(oldId,replacement,{correctionReason,note,claimRevisions=[]}) {
    return this.transaction(()=> {
      const now=this.now(),old=this.#row('evidence',oldId);requireAvailable(old,now,'Old Evidence');
      if(replacement.id===oldId) throw new Error('Correction must create a new Evidence identity');
      if(old.payload.subjectId!==replacement.subjectId || old.payload.sourceId!==replacement.sourceId || old.payload.metric!==replacement.metric) throw new Error('Correction must preserve source/subject/metric');
      const id=stableId('CORRECTION',{oldId,replacementId:replacement.id});
      const existing=this.#row('correction',id);
      if(existing) {
        if(existing.payload.correctionReason!==correctionReason || existing.payload.note!==note) throw new Error('Immutable correction conflict');
        this.putEvidence(replacement);
        if(claimRevisions.length) throw new Error('Repeated correction cannot reapply revisions; inspect history');
        return existing.payload;
      }
      if(this.#corrections(oldId,now).some(c=>c.supersedesEvidenceId===oldId) || this.#corrections(replacement.id,now).length) throw new Error('Correction lineage conflict');
      this.putEvidence(replacement);
      const correction={id,subjectId:replacement.subjectId,supersedesEvidenceId:oldId,replacementEvidenceId:replacement.id,correctionReason,note,createdAt:now,effectiveAt:now};
      validateMemory('correction',correction);
      this.backend.append('correction',correction,now,[{kind:'evidence',id:oldId,role:'supersedes'},{kind:'evidence',id:replacement.id,role:'replacement'}]);
      for(const revision of claimRevisions) this.reviseClaim(revision.claimId,revision.changes,{revisionReason:'evidence_corrected',note:revision.note??note,effectiveAt:now});
      return correction;
    });
  }
  #expand(row,at) {
    const revision=row.payload;
    return {...revision,provenance:{supporting:revision.claim.supportingEvidenceIds.map(id=>this.#evidenceNode(this.#row('evidence',id),at)),counter:revision.claim.counterEvidenceIds.map(id=>this.#evidenceNode(this.#row('evidence',id),at))}};
  }
  getClaimHistory(id) { return this.#read(()=>this.#history(id).map(row=>this.#expand(row,row.createdAt))); }
  #state(subjectId,at) {
    return this.#all('identity',subjectId).filter(row=>visible(row,at)).map(identity=>this.#history(identity.payload.id).filter(row=>visible(row,at)).at(-1)).filter(Boolean).map(row=>this.#expand(row,at));
  }
  getClaimsAsOf(subjectId,asOf) { const at=instant(asOf,{query:true});return this.#read(()=>this.#state(subjectId,at)); }
  getClaim(id,{asOf=this.now(),version}={}) {
    const at=instant(asOf,{query:true});
    return this.#read(()=> {
      const row=this.#history(id).filter(row=>visible(row,at) && (version===undefined || row.payload.version===version)).at(-1);
      return row?this.#expand(row,at):null;
    });
  }
  provenance(id,options) { const claim=this.getClaim(id,options);if(!claim) throw new Error('Claim unavailable for requested version/as-of');return claim; }
  ingest({sources,evidence,claims}) {
    return this.transaction(()=>{for(const item of sources)this.putSource(item);for(const item of evidence)this.putEvidence(item);for(const item of claims)this.createClaim(item);return this.counts();});
  }
  diffClaims(subjectId,{from,to}) {
    const start=instant(from,{query:true}),end=instant(to,{query:true});
    if(start>end) throw new Error('Diff from must not follow to');
    return this.#read(()=> {
      const result=diffStates(this.#state(subjectId,start),this.#state(subjectId,end));
      for(const change of result.changes) change.interveningRevisions=this.#history(change.claimId).filter(row=>visible(row,end) && !visible(row,start)).map(row=>({version:row.payload.version,revisionReason:row.payload.revisionReason,note:row.payload.note,createdAt:row.createdAt,effectiveAt:row.payload.effectiveAt}));
      return {subjectId,from:start,to:end,...result};
    });
  }
  counts() { return this.#read(()=>Object.fromEntries(['source','evidence','identity','revision','correction'].map(kind=>[kind,this.#all(kind).length]))); }
  markStale(subjectId,{evaluationDate,maxAgeDays}) {
    const at=instant(evaluationDate,{query:true});
    if(!Number.isInteger(maxAgeDays) || maxAgeDays<0) throw new Error('Explicit nonnegative integer maxAgeDays required');
    return this.transaction(()=> {
      if(at>this.now()) throw new Error('Staleness evaluation cannot be in the future');
      const changed=[];
      for(const revision of this.#state(subjectId,at)) {
        const current=this.#history(revision.claimId).at(-1).payload;
        if(current.id!==revision.id) throw new Error('Cannot apply stale evaluation to a superseded Claim revision');
        const refs=[...revision.provenance.supporting,...revision.provenance.counter];
        const latest=refs.map(node=>Date.parse(node.evidence.observedAt)).sort((a,b)=>a-b).at(-1);
        if(revision.claim.status!=='stale' && latest!==undefined && (Date.parse(at)-latest)/86400000>maxAgeDays) changed.push(this.reviseClaim(revision.claimId,{status:'stale'},{effectiveAt:at,revisionReason:'stale_evidence',staleEvaluation:{referenceDate:at,maxAgeDays,latestObservedAt:new Date(latest).toISOString().slice(0,10)},note:`Evaluated at ${at}; latest observation ${new Date(latest).toISOString()}; maxAgeDays=${maxAgeDays}`}));
      }
      return changed;
    });
  }
  close() { this.backend.close(); }
}
export { semantic as semanticClaim };
