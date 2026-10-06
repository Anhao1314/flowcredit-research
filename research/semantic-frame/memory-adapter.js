// Research Memory -> SemanticFrame adapter.
//
// Evidence already carries recorded metric/value/unit/scope/time/source fields and
// can be materialized deterministically. Current Claim snapshots do not carry an
// executable predicate structure, so Claim semantics fail closed unless a separate
// explicit SemanticFrame binding is supplied.
import {createHash} from 'node:crypto';
import {assertSchema} from '../src/schema.js';
import {assertSemanticFrame,SEMANTIC_FRAME_VERSION} from './project.js';

const freeze=value=>{
 if(Array.isArray(value)){for(const item of value)freeze(item);return Object.freeze(value);}
 if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);return Object.freeze(value);}
 return value;
};
const idOf=value=>'SF-'+createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20);
const origin=(kind,path,transformation=null)=>freeze({kind,path,transformation});

export function projectMemoryEvidence(evidence,{source=null}={}){
 assertSchema('evidence',evidence);
 if(source){
  assertSchema('source',source);
  if(source.id!==evidence.sourceId)throw new Error('MEMORY_SEMANTIC_SOURCE_MISMATCH');
  if(source.subjectId!==evidence.subjectId)throw new Error('MEMORY_SEMANTIC_SUBJECT_MISMATCH');
 }
 const numeric=typeof evidence.normalizedValue==='number'&&Number.isFinite(evidence.normalizedValue);
 const valueOrigin=evidence.normalization==='identity'
  ?origin('RECORDED_FIELD','evidence.normalizedValue','identity')
  :origin('DERIVED_NORMALIZATION','evidence.normalizedValue',evidence.normalization);
 const core={
  version:SEMANTIC_FRAME_VERSION,
  kind:'EVIDENCE',
  subjectId:evidence.subjectId,
  statement:evidence.statement,
  evidenceRef:{evidenceId:evidence.id},
  proposition:{
   assertionType:numeric?'NUMERIC_OBSERVATION':'RECORDED_STATEMENT',
   metric:evidence.metric,
   comparator:null,
   objectValue:numeric?evidence.normalizedValue:null
  },
  qualifiers:{
   unit:evidence.unit,
   scope:evidence.scope,
   temporal:{
    periodStart:evidence.periodStart,
    periodEnd:evidence.periodEnd,
    observedAt:evidence.observedAt
   }
  },
  grounding:{
   sourceId:evidence.sourceId,
   sourceTitle:source?.title??null,
   sourceUrl:source?.url??null,
   sourceHash:evidence.provenance.sourceContentHash,
   section:evidence.section,
   page:evidence.page,
   location:evidence.location
  },
  fieldOrigins:{
   'proposition.metric':origin('RECORDED_FIELD','evidence.metric'),
   'proposition.objectValue':valueOrigin,
   'qualifiers.unit':origin('RECORDED_FIELD','evidence.unit'),
   'qualifiers.scope':origin('RECORDED_FIELD','evidence.scope'),
   'qualifiers.temporal':origin('RECORDED_FIELD','evidence.periodStart|periodEnd|observedAt'),
   'grounding':origin('RECORDED_FIELD','evidence.sourceId|section|page|location')
  }
 };
 const frame=freeze({...core,frameId:idOf(core)});
 assertSemanticFrame(frame);
 return frame;
}

export function inspectMemoryClaimSemantics(claim,{claimRevisionId=null,binding=null}={}){
 assertSchema('claim',claim);
 if(!binding){
  return freeze({
   state:'NOT_MATERIALIZED',
   reason:'CLAIM_SEMANTICS_NOT_RECORDED',
   claimId:claim.id,
   claimRevisionId,
   statement:claim.statement
  });
 }
 assertSemanticFrame(binding);
 if(binding.kind!=='CLAIM')throw new Error('MEMORY_CLAIM_BINDING_KIND_INVALID');
 if(binding.subjectId!==claim.subjectId)throw new Error('MEMORY_CLAIM_BINDING_SUBJECT_MISMATCH');
 if(binding.claimRef?.claimId&&binding.claimRef.claimId!==claim.id)throw new Error('MEMORY_CLAIM_BINDING_ID_MISMATCH');
 if(claimRevisionId&&binding.claimRef?.revisionId&&binding.claimRef.revisionId!==claimRevisionId)throw new Error('MEMORY_CLAIM_BINDING_REVISION_MISMATCH');
 return freeze({state:'PRESENT',reason:null,claimId:claim.id,claimRevisionId,frame:binding});
}

export function prepareMemorySemanticPair({claim,evidence,source=null,claimRevisionId=null,claimBinding=null}={}){
 const evidenceFrame=projectMemoryEvidence(evidence,{source});
 const claimProjection=inspectMemoryClaimSemantics(claim,{claimRevisionId,binding:claimBinding});
 if(claimProjection.state!=='PRESENT'){
  return freeze({
   ready:false,
   reason:claimProjection.reason,
   claimProjection,
   evidenceFrame
  });
 }
 return freeze({
  ready:true,
  reason:null,
  claimProjection,
  claimFrame:claimProjection.frame,
  evidenceFrame
 });
}
