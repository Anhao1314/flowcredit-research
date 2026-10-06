// Provenance-aware SemanticFrame development runtime.
//
// This materializes structured Claim / Evidence semantics from already-reviewed,
// recorded fields. It does not infer missing fields and does not call a model.
import {createHash} from 'node:crypto';

export const SEMANTIC_FRAME_VERSION='flowcredit.semantic_frame/dev-v0.2';

const freeze=value=>{
 if(Array.isArray(value)){for(const item of value)freeze(item);return Object.freeze(value);}
 if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);return Object.freeze(value);}
 return value;
};
const idOf=value=>'SF-'+createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20);

function origin(kind,path,{transformation=null}={}){
 return freeze({kind,path,transformation});
}
function normalizeValue(observation){
 if(typeof observation.rawValue!=='number')return {value:null,origin:origin('RECORDED_FIELD','observation.rawValue')};
 const unit=String(observation.rawUnit??'');
 if(unit==='USD_millions')return {value:observation.rawValue*1e6,origin:origin('DERIVED_NORMALIZATION','observation.rawValue',{transformation:'usd_millions_to_usd'})};
 if(unit==='USD_billions')return {value:observation.rawValue*1e9,origin:origin('DERIVED_NORMALIZATION','observation.rawValue',{transformation:'usd_billions_to_usd'})};
 return {value:observation.rawValue,origin:origin('RECORDED_FIELD','observation.rawValue',{transformation:observation.normalization??'identity'})};
}

export function projectClaim(claim,{subjectId='coreweave',claimId=null,revisionId=null}={}){
 if(!claim||typeof claim!=='object')throw new Error('SEMANTIC_CLAIM_REQUIRED');
 for(const key of ['metric','operator','unit','statement'])if(typeof claim[key]!=='string'||!claim[key])throw new Error('SEMANTIC_CLAIM_MISSING_'+key);
 if(typeof claim.threshold!=='number')throw new Error('SEMANTIC_CLAIM_THRESHOLD_REQUIRED');
 const core={
  version:SEMANTIC_FRAME_VERSION,
  kind:'CLAIM',
  subjectId,
  statement:claim.statement,
  claimRef:claimId?{claimId,revisionId:revisionId??null}:null,
  proposition:{
   assertionType:'QUANTITY_PREDICATE',
   metric:claim.metric,
   comparator:claim.operator,
   objectValue:claim.threshold
  },
  qualifiers:{
   unit:claim.unit,
   scope:null,
   temporal:{mode:'LATEST',maxAgeDays:claim.maxAgeDays??null}
  },
  grounding:null,
  fieldOrigins:{
   'proposition.metric':origin('CLAIM_DEFINITION','claim.metric'),
   'proposition.comparator':origin('CLAIM_DEFINITION','claim.operator'),
   'proposition.objectValue':origin('CLAIM_DEFINITION','claim.threshold'),
   'qualifiers.unit':origin('CLAIM_DEFINITION','claim.unit'),
   'qualifiers.temporal':origin('CLAIM_DEFINITION','claim.maxAgeDays')
  }
 };
 return freeze({...core,frameId:idOf(core)});
}

export function projectObservation(observation,{subjectId='coreweave',evidenceId=null,source=null}={}){
 if(!observation||typeof observation!=='object')throw new Error('SEMANTIC_OBSERVATION_REQUIRED');
 for(const key of ['metric','statement','scope'])if(typeof observation[key]!=='string'||!observation[key])throw new Error('SEMANTIC_OBSERVATION_MISSING_'+key);
 const normalized=normalizeValue(observation);
 const numeric=typeof normalized.value==='number'&&Number.isFinite(normalized.value);
 const core={
  version:SEMANTIC_FRAME_VERSION,
  kind:'EVIDENCE',
  subjectId,
  statement:observation.statement,
  evidenceRef:evidenceId?{evidenceId}:null,
  proposition:{
   assertionType:numeric?'NUMERIC_OBSERVATION':'RECORDED_STATEMENT',
   metric:observation.metric,
   comparator:null,
   objectValue:numeric?normalized.value:null
  },
  qualifiers:{
   unit:observation.unit??null,
   scope:observation.scope,
   temporal:{
    periodStart:observation.periodStart??null,
    periodEnd:observation.periodEnd??null,
    observedAt:observation.observedAt??null
   }
  },
  grounding:{
   sourceKey:observation.sourceKey??null,
   sourceTitle:source?.title??null,
   sourceUrl:source?.url??null,
   sourceHash:source?.contentHash??null,
   section:observation.section??null,
   page:observation.page??null,
   location:observation.location??null
  },
  fieldOrigins:{
   'proposition.metric':origin('RECORDED_FIELD','observation.metric'),
   'proposition.objectValue':normalized.origin,
   'qualifiers.unit':origin('RECORDED_FIELD','observation.unit'),
   'qualifiers.scope':origin('RECORDED_FIELD','observation.scope'),
   'qualifiers.temporal':origin('RECORDED_FIELD','observation.periodStart|periodEnd|observedAt'),
   'grounding':origin('RECORDED_FIELD','observation.sourceKey|section|page|location')
  }
 };
 return freeze({...core,frameId:idOf(core)});
}

export function assertSemanticFrame(frame){
 if(!frame||typeof frame!=='object'||frame.version!==SEMANTIC_FRAME_VERSION)throw new Error('SEMANTIC_FRAME_INVALID');
 if(!['CLAIM','EVIDENCE'].includes(frame.kind))throw new Error('SEMANTIC_FRAME_KIND_INVALID');
 if(typeof frame.subjectId!=='string'||!frame.subjectId)throw new Error('SEMANTIC_FRAME_SUBJECT_INVALID');
 if(!frame.proposition||typeof frame.proposition.metric!=='string')throw new Error('SEMANTIC_FRAME_PROPOSITION_INVALID');
 if(!frame.qualifiers||!frame.fieldOrigins)throw new Error('SEMANTIC_FRAME_PROVENANCE_REQUIRED');
 for(const [path,entry] of Object.entries(frame.fieldOrigins)){
  if(!entry||!['CLAIM_DEFINITION','RECORDED_FIELD','DERIVED_NORMALIZATION'].includes(entry.kind))throw new Error('SEMANTIC_FRAME_ORIGIN_INVALID:'+path);
 }
 return frame;
}
