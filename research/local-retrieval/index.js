import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,realpathSync} from 'node:fs';
import {dirname,resolve,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,stableId} from '../src/identity.js';
import {spanRenderVersion} from './render.js';

// Rebuildable semantic index. It is not Research Memory truth and never becomes
// Evidence: vectors only rank candidate spans for a later model call. Records are
// immutable and versioned by (span content, renderer, embedding model, index
// version) so a re-index of an unchanged span is idempotent and a changed span
// hash invalidates the old vector instead of drifting identity.
export const spanIndexVersion='span-embedding-index/v1';
const repository=fileURLToPath(new URL('../../',import.meta.url));
export const defaultSpanIndexPath=resolve(repository,'..','fc-agent','research-local-retrieval','span-index.sqlite');

function externalPath(filename){
 if(filename===':memory:')return filename;
 if(typeof filename!=='string'||!filename.trim())throw new Error('Span index path required');
 const path=resolve(filename);
 let ancestor=path;while(!existsSync(ancestor))ancestor=dirname(ancestor);
 const actual=resolve(realpathSync(ancestor),relative(ancestor,path)),rel=relative(realpathSync(repository),actual);
 if(rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel)))throw new Error('Span index must be outside repository');
 mkdirSync(dirname(path),{recursive:true,mode:0o700});return path;
}
export function roundVector(vector,{precision=6}={}){
 if(!Array.isArray(vector)||!vector.length||vector.some(value=>!Number.isFinite(value)))throw new Error('Invalid embedding vector');
 return vector.map(value=>Number(value.toFixed(precision)));
}
export function spanEmbeddingId({spanId,spanHash,rendererVersion=spanRenderVersion,embeddingModel,embeddingModelDigest,indexVersion=spanIndexVersion}){
 return stableId('SPANEMB',{spanId,spanHash,rendererVersion,embeddingModel,embeddingModelDigest,indexVersion});
}
export class SpanEmbeddingIndex {
 #database;
 constructor(filename=process.env.FC_SPAN_INDEX??defaultSpanIndexPath){
  this.#database=new DatabaseSync(externalPath(filename));
  try{
   this.#database.exec(`CREATE TABLE IF NOT EXISTS span_embeddings(
     id TEXT PRIMARY KEY,
     span_id TEXT NOT NULL,
     span_hash TEXT NOT NULL,
     document_id TEXT NOT NULL,
     subject_id TEXT NOT NULL,
     source_id TEXT NOT NULL,
     page INTEGER NOT NULL,
     renderer_version TEXT NOT NULL,
     index_version TEXT NOT NULL,
     embedding_model TEXT NOT NULL,
     embedding_model_digest TEXT NOT NULL,
     dimension INTEGER NOT NULL,
     vector TEXT NOT NULL CHECK(json_valid(vector)),
     source_hash TEXT NOT NULL,
     created_at TEXT NOT NULL,
     record_hash TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS span_embeddings_lookup ON span_embeddings(span_id,span_hash);
    CREATE TRIGGER IF NOT EXISTS span_embeddings_no_update BEFORE UPDATE ON span_embeddings BEGIN SELECT RAISE(ABORT,'Immutable span embeddings'); END;
    CREATE TRIGGER IF NOT EXISTS span_embeddings_no_delete BEFORE DELETE ON span_embeddings BEGIN SELECT RAISE(ABORT,'Immutable span embeddings'); END;`);
   this.#database.exec('PRAGMA busy_timeout=5000;');
  }catch(error){this.#database.close();throw error;}
 }
 #decode(row){
  if(!row)return null;
  const vector=JSON.parse(row.vector);
  const value={...row,vector};
  if(digest({id:row.id,spanId:row.span_id,spanHash:row.span_hash,documentId:row.document_id,subjectId:row.subject_id,sourceId:row.source_id,page:row.page,rendererVersion:row.renderer_version,indexVersion:row.index_version,embeddingModel:row.embedding_model,embeddingModelDigest:row.embedding_model_digest,dimension:row.dimension,vector,sourceHash:row.source_hash,createdAt:row.created_at})!==row.record_hash)throw new Error('Corrupt span embedding record');
  return {id:value.id,spanId:value.span_id,spanHash:value.span_hash,documentId:value.document_id,subjectId:value.subject_id,sourceId:value.source_id,page:value.page,rendererVersion:value.renderer_version,indexVersion:value.index_version,embeddingModel:value.embedding_model,embeddingModelDigest:value.embedding_model_digest,dimension:value.dimension,vector,sourceHash:value.source_hash,createdAt:value.created_at};
 }
 put(record){
  const {id,spanId,spanHash,documentId,subjectId,sourceId,page,rendererVersion,indexVersion,embeddingModel,embeddingModelDigest,sourceHash,createdAt}=record,vector=roundVector(record.vector);
  if(!Number.isInteger(page)||page<1)throw new Error('Invalid span embedding page');
  if(vector.length!==record.dimension)throw new Error('Invalid span embedding dimension');
  const existing=this.#decode(this.#database.prepare('SELECT * FROM span_embeddings WHERE id=?').get(id));
  if(existing){if(digest(existing.vector)!==digest(vector))throw new Error('Immutable span embedding conflict');return {inserted:false,record:existing};}
  const recordHash=digest({id,spanId,spanHash,documentId,subjectId,sourceId,page,rendererVersion,indexVersion,embeddingModel,embeddingModelDigest,dimension:record.dimension,vector,sourceHash,createdAt});
  this.#database.prepare('INSERT INTO span_embeddings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,spanId,spanHash,documentId,subjectId,sourceId,page,rendererVersion,indexVersion,embeddingModel,embeddingModelDigest,record.dimension,JSON.stringify(vector),sourceHash,createdAt,recordHash);
  return {inserted:true,record:{...record,vector}};
 }
 get(spanId,spanHash){return this.#decode(this.#database.prepare('SELECT * FROM span_embeddings WHERE span_id=? AND span_hash=? ORDER BY created_at DESC,id LIMIT 1').get(spanId,spanHash));}
 count(){return this.#database.prepare('SELECT COUNT(*) AS n FROM span_embeddings').get().n;}
 models(){return this.#database.prepare('SELECT embedding_model AS model,embedding_model_digest AS digest,renderer_version AS renderer,index_version AS version,COUNT(*) AS n FROM span_embeddings GROUP BY 1,2,3,4 ORDER BY n DESC').all();}
 stale(){return this.#database.prepare('SELECT span_id AS spanId,COUNT(DISTINCT span_hash) AS hashes FROM span_embeddings GROUP BY 1 HAVING hashes>1').all();}
 close(){this.#database.close();}
}
