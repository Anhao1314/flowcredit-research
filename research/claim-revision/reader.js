import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {ResearchMemory} from '../memory/store.js';
import {digest} from '../src/identity.js';
import {assertAdmission} from '../admission/validation.js';
import {assertSchema} from '../src/schema.js';
import {instant} from '../memory/time.js';
// No authority methods on this capability. Opening never migrates/creates tables.
export function readOnlyMemory(filename){
 if(!existsSync(filename))throw Error('MEMORY_MISSING');
 const db=new DatabaseSync(filename,{readOnly:true,allowExtension:false});db.exec('PRAGMA query_only=ON');
 if(db.prepare('PRAGMA user_version').get().user_version!==2){db.close();throw Error('MEMORY_VERSION');}
 const decode=row=>{if(!row)return null;const payload=JSON.parse(row.payload);if(digest(payload)!==row.content_hash)throw Error('MEMORY_HASH');return {payload,createdAt:row.created_at};};
 let depth=0;
 const backend={get:(kind,id)=>decode(db.prepare('SELECT * FROM records WHERE kind=? AND id=?').get(kind,id)),list:kind=>db.prepare('SELECT * FROM records WHERE kind=? ORDER BY id').all(kind).map(decode),append:()=>{throw Error('READ_ONLY');},close:()=>db.close(),transaction(fn,{write=true}={}){if(write)throw Error('READ_ONLY');if(depth)return fn();db.exec('BEGIN');depth++;try{const v=fn();if(v?.then)throw Error('SYNC_READ_REQUIRED');db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}finally{depth--;}}};
 const memory=new ResearchMemory(backend);
 const reviews=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admission_reviews'").get()?db.prepare('SELECT * FROM admission_reviews ORDER BY created_at,id').all().map(row=>assertAdmission('review',decode(row).payload)):[];
 return Object.freeze({getClaim:(...args)=>memory.getClaim(...args),getClaimHistory:(...args)=>memory.getClaimHistory(...args),getRecentHistory(id,{asOf,limit=3}){if(!Number.isInteger(limit)||limit<1||limit>3)throw Error('HISTORY_BOUND');const at=instant(asOf,{query:true});return db.prepare("SELECT * FROM records WHERE kind='revision' AND json_extract(payload,'$.claimId')=? AND created_at<=? AND json_extract(payload,'$.effectiveAt')<=? ORDER BY json_extract(payload,'$.version') DESC LIMIT ?").all(id,at,at,limit).map(r=>decode(r).payload).reverse();},getEvidence:(...args)=>memory.getEvidence(...args),transaction:fn=>backend.transaction(fn,{write:false}),reviews,close:()=>db.close(),snapshot(){return backend.transaction(()=>{const rows=Object.fromEntries(['source','evidence','identity','revision','correction'].map(k=>[k,backend.list(k)]));for(const n of rows.evidence)assertSchema('evidence',n.payload);const a=reviews();return {claims:rows.identity.length,revisions:rows.revision.length,evidence:rows.evidence.length,admissions:a.length,payloadHash:digest(rows.revision.map(x=>x.payload)),authorityHash:digest({rows,admissions:a})};},{write:false});}});
}
