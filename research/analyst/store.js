import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../src/identity.js';
export const defaultProposals=resolve(fileURLToPath(new URL('../../',import.meta.url)),'..','fc-agent','research-analyst','proposals.sqlite');
function externalPath(filename){
 if(filename===':memory:')return filename;
 if(typeof filename!=='string' || !filename.trim())throw new Error('Proposal database path required');
 const path=resolve(filename);let ancestor=path;while(!existsSync(ancestor))ancestor=dirname(ancestor);
 const actual=resolve(realpathSync(ancestor),relative(ancestor,path)),root=realpathSync(fileURLToPath(new URL('../../',import.meta.url))),rel=relative(root,actual);
 if(rel==='' || (!rel.startsWith('..'+sep) && rel!=='..' && !isAbsolute(rel)))throw new Error('Proposal database must be outside repository');
 mkdirSync(dirname(path),{recursive:true,mode:0o700});return path;
}
export class ProposalStore {
 #db;
 constructor(filename=process.env.FC_RESEARCH_PROPOSALS_DB??defaultProposals){
  this.#db=new DatabaseSync(externalPath(filename),{allowExtension:false});
  try{this.#db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
   const version=this.#db.prepare('PRAGMA user_version').get().user_version;
   if(version!==0 && version!==5)throw new Error('Not a v0.5 Proposal store');
   if(version===0 && this.#db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)throw new Error('Unversioned Proposal store not empty');
   this.#db.exec(`CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS promotions(proposal_id TEXT PRIMARY KEY REFERENCES proposals(id),payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL) STRICT;
    CREATE TRIGGER IF NOT EXISTS proposals_no_update BEFORE UPDATE ON proposals BEGIN SELECT RAISE(ABORT,'Immutable Proposal'); END;
    CREATE TRIGGER IF NOT EXISTS proposals_no_delete BEFORE DELETE ON proposals BEGIN SELECT RAISE(ABORT,'Immutable Proposal'); END;
    CREATE TRIGGER IF NOT EXISTS runs_no_update BEFORE UPDATE ON runs BEGIN SELECT RAISE(ABORT,'Immutable Analyst run'); END;
    CREATE TRIGGER IF NOT EXISTS runs_no_delete BEFORE DELETE ON runs BEGIN SELECT RAISE(ABORT,'Immutable Analyst run'); END;
    CREATE TRIGGER IF NOT EXISTS promotions_no_update BEFORE UPDATE ON promotions BEGIN SELECT RAISE(ABORT,'Immutable promotion'); END;
    CREATE TRIGGER IF NOT EXISTS promotions_no_delete BEFORE DELETE ON promotions BEGIN SELECT RAISE(ABORT,'Immutable promotion'); END;
    PRAGMA user_version=5; COMMIT;`);
  }catch(error){try{this.#db.exec('ROLLBACK');}catch{}this.#db.close();throw error;}
 }
 transaction(fn){this.#db.exec('BEGIN IMMEDIATE');try{const result=fn();if(result?.then)throw new Error('Store transactions must be synchronous');this.#db.exec('COMMIT');return result;}catch(e){this.#db.exec('ROLLBACK');throw e;}}
 #decode(row){if(!row)return null;const v=JSON.parse(row.payload);if(digest(v)!==row.hash)throw new Error('Corrupt Proposal record');return v;}
 get(id){return this.#decode(this.#db.prepare('SELECT * FROM proposals WHERE id=?').get(id));}
 list(subjectId){return this.#db.prepare('SELECT * FROM proposals ORDER BY id').all().map(r=>this.#decode(r)).filter(p=>!subjectId || p.subjectId===subjectId);}
 runs(){return this.#db.prepare('SELECT * FROM runs ORDER BY id').all().map(r=>this.#decode(r));}
 promotion(id){return this.#decode(this.#db.prepare('SELECT * FROM promotions WHERE proposal_id=?').get(id));}
 #put(table,key,value){const row=this.#db.prepare(`SELECT * FROM ${table} WHERE ${table==='promotions'?'proposal_id':'id'}=?`).get(key),old=this.#decode(row);if(old)return old;this.#db.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run(key,JSON.stringify(value),digest(value));return value;}
 saveRun(run,proposals){return this.transaction(()=>({run:this.#put('runs',run.id,run),proposals:proposals.map(p=>this.#put('proposals',p.id,p))}));}
 promote(event){return this.transaction(()=>{const old=this.promotion(event.proposalId);if(old && old.candidateId!==event.candidateId)throw new Error('Immutable promotion conflict');return this.#put('promotions',event.proposalId,event);});}
 close(){this.#db.close();}
}
