import { readFileSync } from 'node:fs';
import { digest,stableId } from '../src/identity.js';
import { instant } from '../memory/time.js';
import { chunkDocument } from './chunker.js';
import { byteHash,parseDocument } from './parser.js';
import { searchLexical } from './lexical.js';
import { searchSemantic,validateProvider } from './semantic.js';
import { fuse } from './fusion.js';
import { assertRetrieval } from './validation.js';
export function cutoffVisible(item,asOf,timeMode) {
  if(timeMode==='replay')return item.availableAt!==null && item.availableAt<=asOf;
  if(timeMode==='audit')return item.retrievedAt<=asOf && item.createdAt<=asOf;
  throw new Error('Unknown temporal mode');
}
export class RetrievalLayer {
  #verifiedDocs=new Map();
  constructor(index,{provider=null,clock=()=>new Date().toISOString()}={}){this.index=index;this.provider=provider;this.clock=clock;if(provider)validateProvider(provider);}
  search(query,{subjectId,asOf,timeMode='audit',mode='hybrid',limit=5}={}) {
    if(typeof query!=='string' || !query.trim() || query.length>2000 || !subjectId)throw new Error('Query and subject required');
    if(!['lexical','semantic','hybrid'].includes(mode) || !['audit','replay'].includes(timeMode))throw new Error('Unknown retrieval/temporal mode');
    if(!Number.isInteger(limit) || limit<1 || limit>1000)throw new Error('limit must be 1..1000');
    const at=instant(asOf??this.clock(),{query:true}),options={query:query.trim(),subjectId,asOf:at,timeMode,mode};
    const queryId=stableId('QUERY',options);
    return this.index.transaction(()=>{
      const docs=new Map(this.index.list('document').map(doc=>[doc.id,doc]));
      // Filter BEFORE lexical corpus statistics or semantic scoring/fusion.
      const chunks=this.index.list('chunk').filter(chunk=>chunk.subjectId===subjectId && docs.get(chunk.documentId)?.subjectId===subjectId && cutoffVisible(chunk,at,timeMode) && cutoffVisible(docs.get(chunk.documentId),at,timeMode));
      const lexical=mode==='semantic'?[]:searchLexical(chunks,query,{limit:Math.max(limit,20)});
      const semantic=mode==='lexical' || !this.provider?[]:searchSemantic(this.index,chunks,query,this.provider,{limit:Math.max(limit,20)});
      const rows=mode==='hybrid'?fuse(lexical,semantic,{limit}): (mode==='lexical'?lexical:semantic).slice(0,limit).map(row=>({...row,finalRank:row.rank}));
      const results=rows.map(row=>({...row,chunk:this.index.get('chunk',row.chunkId)}));
      return {queryId,...options,semanticStatus:this.provider?this.provider.metadata.kind==='test'?'test_provider':'available':'unavailable',embeddingMetadata:this.provider?.metadata??null,degraded:mode==='hybrid' && !this.provider?'lexical_only':null,status:results.length?'candidates_found':mode==='semantic' && !this.provider?'semantic_unavailable':'insufficient_evidence',results};
    },{write:false});
  }
  searchLexical(query,options){return this.search(query,{...options,mode:'lexical'});}
  searchSemantic(query,options){return this.search(query,{...options,mode:'semantic'});}
  searchHybrid(query,options){return this.search(query,{...options,mode:'hybrid'});}
  validateCandidate(candidate) {
    const errors=[];
    try{assertRetrieval('candidate',candidate);}catch{return {validationStatus:'invalid',errors:['candidate_schema']};}
    const {id,createdAt,validationStatus,errors:ignored,...identity}=candidate;
    if(stableId('CANDIDATE',identity)!==id)errors.push('candidate_identity');
    const chunk=this.index.get('chunk',candidate.chunkId),doc=chunk?this.index.get('document',chunk.documentId):null;
    if(!chunk)errors.push('chunk_missing');
    if(!doc?.source)errors.push('source_missing');
    if(chunk && doc) {
      if(candidate.subjectId!==chunk.subjectId || candidate.subjectId!==doc.subjectId || candidate.subjectId!==doc.source.subjectId || candidate.sourceId!==chunk.sourceId || candidate.sourceId!==doc.source.id)errors.push('subject_source_mismatch');
      if(typeof candidate.quotedText!=='string' || !candidate.quotedText.trim() || !chunk.text.includes(candidate.quotedText))errors.push('quote_not_in_chunk');
      if(digest(candidate.locator)!==digest(chunk.locator))errors.push('locator_mismatch');
      if(candidate.contentHash!==chunk.contentHash || candidate.documentHash!==doc.contentHash || digest(chunk.text)!==chunk.contentHash || digest(doc.text)!==doc.textHash || doc.source.contentHash && doc.source.contentHash!==doc.contentHash)errors.push('content_hash_mismatch');
      try {
        const expected=chunkDocument(doc).find(value=>value.id===chunk.id);
        if(!expected || digest(expected)!==digest(chunk))errors.push('chunk_address_mismatch');
        if(byteHash(readFileSync(doc.filename))!==doc.contentHash)errors.push('raw_source_hash_mismatch');
        else {
          const key=doc.id+doc.contentHash;
          let parsed=this.#verifiedDocs.get(key);
          if(!parsed){parsed=parseDocument({source:doc.source,filename:doc.filename,format:doc.format,availability:{availableAt:doc.availableAt,basis:doc.availabilityBasis,scope:doc.availabilityScope,firstPage:doc.firstPage},retrievedAt:doc.retrievedAt,createdAt:doc.createdAt});this.#verifiedDocs.set(key,parsed);}
          if(parsed.id!==doc.id || parsed.textHash!==doc.textHash || digest(parsed.units)!==digest(doc.units))errors.push('original_locator_text_mismatch');
        }
      }catch{errors.push('original_source_unverifiable');}
      try{if(candidate.availableAt!==chunk.availableAt || !cutoffVisible(chunk,instant(candidate.asOf,{query:true}),candidate.timeMode) || !cutoffVisible(doc,instant(candidate.asOf,{query:true}),candidate.timeMode))errors.push('temporal_cutoff');}catch{errors.push('invalid_temporal_context');}
    }
    return {validationStatus:errors.length?'invalid':'valid',errors};
  }
  createCandidate(chunkId,{query,subjectId,asOf,timeMode='audit',mode='hybrid',quotedText}={}) {
    const response=this.search(query,{subjectId,asOf,timeMode,mode,limit:100});
    const result=response.results.find(row=>row.chunkId===chunkId);
    if(!result)throw new Error('Chunk is not a relevant visible retrieval result');
    const chunk=result.chunk;
    const payload={queryId:response.queryId,subjectId,sourceId:chunk.sourceId,chunkId,quotedText:quotedText??chunk.text,locator:chunk.locator,retrievalMethod:mode,retrievalRank:result.finalRank,availableAt:chunk.availableAt,asOf:response.asOf,timeMode,contentHash:chunk.contentHash,documentHash:this.index.get('document',chunk.documentId).contentHash,proposedCategory:null,proposedRawValue:null};
    const id=stableId('CANDIDATE',payload),existing=this.index.get('candidate',id);
    const candidate={id,...payload,createdAt:instant(this.clock()),validationStatus:'pending'};
    const validation=this.validateCandidate(candidate);
    if(validation.validationStatus!=='valid')return {...candidate,...validation};
    if(existing){const current=this.validateCandidate(existing);return {...existing,...current};}
    candidate.validationStatus='valid';this.index.putCandidate(candidate);return {...candidate,errors:[]};
  }
}
