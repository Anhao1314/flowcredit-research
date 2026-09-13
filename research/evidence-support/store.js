import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {externalDirectory} from '../analyst-real/cli.js';
import {digest,stableId} from '../src/identity.js';
export class SupportStore{
 #db;
 constructor(folder){const root=externalDirectory(folder);this.#db=new DatabaseSync(resolve(root,'evidence-support.sqlite'));this.#db.exec("CREATE TABLE IF NOT EXISTS support_records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL,PRIMARY KEY(kind,id)) STRICT; CREATE TRIGGER IF NOT EXISTS support_immutable_update BEFORE UPDATE ON support_records BEGIN SELECT RAISE(ABORT,'Immutable support record'); END; CREATE TRIGGER IF NOT EXISTS support_immutable_delete BEFORE DELETE ON support_records BEGIN SELECT RAISE(ABORT,'Immutable support record'); END;");}
 save(kind,value){const id=value.id??stableId('SUPSTAGE',{kind,value}),record={...value,id},old=this.#db.prepare('SELECT payload,hash FROM support_records WHERE kind=? AND id=?').get(kind,id);if(old){if(old.hash!==digest(record))throw Error('Immutable support conflict');return JSON.parse(old.payload);}this.#db.prepare('INSERT INTO support_records VALUES(?,?,?,?)').run(kind,id,JSON.stringify(record),digest(record));return record;}
 list(kind){return this.#db.prepare('SELECT payload,hash FROM support_records WHERE kind=? ORDER BY id').all(kind).map(r=>{const v=JSON.parse(r.payload);if(digest(v)!==r.hash)throw Error('Corrupt support record');return v;});}
 get(kind,id){const row=this.#db.prepare('SELECT payload,hash FROM support_records WHERE kind=? AND id=?').get(kind,id);if(!row)return null;const v=JSON.parse(row.payload);if(digest(v)!==row.hash)throw Error('Corrupt support record');return v;}
 close(){this.#db.close();}
}
