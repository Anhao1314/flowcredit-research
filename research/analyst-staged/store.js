import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {externalDirectory} from '../analyst-real/cli.js';
import {digest,stableId} from '../src/identity.js';
export class StagedStore{
 #db;
 constructor(folder){const root=externalDirectory(folder);this.#db=new DatabaseSync(resolve(root,'staged.sqlite'));this.#db.exec("CREATE TABLE IF NOT EXISTS staged_records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL,PRIMARY KEY(kind,id)) STRICT; CREATE TRIGGER IF NOT EXISTS staged_immutable_update BEFORE UPDATE ON staged_records BEGIN SELECT RAISE(ABORT,'Immutable staged record'); END; CREATE TRIGGER IF NOT EXISTS staged_immutable_delete BEFORE DELETE ON staged_records BEGIN SELECT RAISE(ABORT,'Immutable staged record'); END;");}
 save(kind,value){const id=value.id??stableId('STAGE',{kind,value}),record={...value,id},old=this.#db.prepare('SELECT payload,hash FROM staged_records WHERE kind=? AND id=?').get(kind,id);if(old){if(old.hash!==digest(record))throw Error('Immutable staged conflict');return JSON.parse(old.payload);}this.#db.prepare('INSERT INTO staged_records VALUES(?,?,?,?)').run(kind,id,JSON.stringify(record),digest(record));return record;}
 list(kind){return this.#db.prepare('SELECT payload,hash FROM staged_records WHERE kind=? ORDER BY id').all(kind).map(r=>{const v=JSON.parse(r.payload);if(digest(v)!==r.hash)throw Error('Corrupt staged record');return v;});}
 close(){this.#db.close();}
}
