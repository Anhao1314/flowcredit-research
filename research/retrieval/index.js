import { DatabaseSync } from 'node:sqlite';
import { existsSync,mkdirSync,realpathSync } from 'node:fs';
import { dirname,resolve,relative,sep,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from '../src/identity.js';
import { chunkDocument } from './chunker.js';
import { assertRetrieval } from './validation.js';
const repository=fileURLToPath(new URL('../../',import.meta.url));
export const defaultIndex=resolve(repository,'..','fc-agent','research-retrieval','index.sqlite');
function externalPath(filename) {
  if(filename===':memory:')return filename;
  if(typeof filename!=='string' || !filename.trim())throw new Error('Index path required');
  const path=resolve(filename);let ancestor=path;while(!existsSync(ancestor))ancestor=dirname(ancestor);
  const actual=resolve(realpathSync(ancestor),relative(ancestor,path)),rel=relative(realpathSync(repository),actual);
  if(rel==='' || (!rel.startsWith('..'+sep) && rel!=='..' && !isAbsolute(rel)))throw new Error('Retrieval index must be outside repository');
  mkdirSync(dirname(path),{recursive:true,mode:0o700});return path;
}
export class RetrievalIndex {
  #db;
  constructor(filename=process.env.FC_RETRIEVAL_INDEX??defaultIndex) {
    this.#db=new DatabaseSync(externalPath(filename));
    try {
      this.#db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
      this.#db.exec('BEGIN IMMEDIATE');
      const version=this.#db.prepare('PRAGMA user_version').get().user_version;
      if(version!==0 && version!==3)throw new Error('Not a v0.3 Retrieval index');
      if(version===0 && this.#db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)throw new Error('Unversioned index is not empty');
      this.#db.exec(`CREATE TABLE IF NOT EXISTS objects(kind TEXT NOT NULL CHECK(kind IN ('document','chunk','embedding','candidate')),id TEXT NOT NULL,parent_kind TEXT,parent_id TEXT,payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL,PRIMARY KEY(kind,id),FOREIGN KEY(parent_kind,parent_id) REFERENCES objects(kind,id)) STRICT;
        CREATE TRIGGER IF NOT EXISTS no_update BEFORE UPDATE ON objects BEGIN SELECT RAISE(ABORT,'Immutable retrieval objects'); END;
        CREATE TRIGGER IF NOT EXISTS no_delete BEFORE DELETE ON objects BEGIN SELECT RAISE(ABORT,'Immutable retrieval objects'); END;
        PRAGMA user_version=3; COMMIT;`);
    } catch(error){try{this.#db.exec('ROLLBACK');}catch{}this.#db.close();throw error;}
  }
  transaction(fn,{write=true}={}) {
    this.#db.exec(write?'BEGIN IMMEDIATE':'BEGIN');
    try{const result=fn();if(result?.then)throw new Error('Index transactions must be synchronous');this.#db.exec('COMMIT');return result;}
    catch(error){this.#db.exec('ROLLBACK');throw error;}
  }
  #decode(row){if(!row)return null;const value=JSON.parse(row.payload);if(digest(value)!==row.hash)throw new Error('Corrupt retrieval object');return value;}
  get(kind,id){return this.#decode(this.#db.prepare('SELECT * FROM objects WHERE kind=? AND id=?').get(kind,id));}
  list(kind){return this.#db.prepare('SELECT * FROM objects WHERE kind=? ORDER BY id').all(kind).map(row=>this.#decode(row));}
  #put(kind,value,parent=null) {
    const old=this.get(kind,value.id);
    if(old){if(digest(old)!==digest(value))throw new Error('Immutable retrieval object conflict');return old;}
    this.#db.prepare('INSERT INTO objects VALUES(?,?,?,?,?,?)').run(kind,value.id,parent?.kind??null,parent?.id??null,JSON.stringify(value),digest(value));return value;
  }
  indexDocument(document) {
    assertRetrieval('document',document);
    return this.transaction(()=>{
      const old=this.get('document',document.id);
      if(old){
        const stable=value=>{const {retrievedAt,createdAt,filename,source,...rest}=value;return {...rest,source:{...source,retrievedAt:null}};};
        if(digest(stable(old))!==digest(stable(document)))throw new Error('Document identity/availability conflict');
        return {documentId:old.id,chunks:this.list('chunk').filter(c=>c.documentId===old.id).length,inserted:false};
      }
      const chunks=chunkDocument(document);
      this.#put('document',document);
      for(const chunk of chunks){assertRetrieval('chunk',chunk);this.#put('chunk',chunk,{kind:'document',id:document.id});}
      return {documentId:document.id,chunks:chunks.length,inserted:true};
    });
  }
  putEmbedding(value){return this.transaction(()=>this.#put('embedding',value,{kind:'chunk',id:value.chunkId}));}
  putCandidate(value){return this.transaction(()=>this.#put('candidate',value,{kind:'chunk',id:value.chunkId}));}
  counts(){return Object.fromEntries(['document','chunk','embedding','candidate'].map(kind=>[kind,this.list(kind).length]));}
  close(){this.#db.close();}
}
