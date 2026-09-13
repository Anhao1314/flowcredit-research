import { DatabaseSync } from "node:sqlite";
import { mkdirSync, realpathSync, existsSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { canonical, digest } from "../src/identity.js";
const repository = fileURLToPath(new URL("../../", import.meta.url));
const kinds = ['source','evidence','identity','revision','correction'];
function safePath(filename) {
  if (filename === ':memory:') return filename;
  if (typeof filename !== 'string' || !filename.trim()) throw new Error('Explicit database path required');
  const path = resolve(filename);
  let ancestor = existsSync(path) ? path : dirname(path);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const actual = resolve(realpathSync(ancestor), relative(ancestor, path));
  const rel = relative(realpathSync(repository), actual);
  if (rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))) throw new Error('Research database must be outside the repository');
  mkdirSync(dirname(path), { recursive:true, mode:0o700 });
  return path;
}

// Storage contract: get(kind,id), list(kind), append(kind,payload,createdAt,links),
// transaction(fn,{write}), close(). Only this backend knows SQL.
export class SQLiteBackend {
  #db; #depth = 0; #savepoint = 0;
  constructor(filename) {
    const path = safePath(filename);
    this.#db = new DatabaseSync(path, { enableForeignKeyConstraints:true, allowExtension:false });
    try {
      this.#db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
      this.#enableWal(path===':memory:');
      this.#db.exec('PRAGMA synchronous=FULL;');
      this.transaction(() => {
        const version = this.#db.prepare('PRAGMA user_version').get().user_version;
        if (version !== 0 && version !== 2) throw new Error(`Unsupported memory storage version: ${version}`);
        if(version===0 && this.#db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length) throw new Error('Unversioned database is not empty');
        this.#db.exec(`
          CREATE TABLE IF NOT EXISTS records (
            kind TEXT NOT NULL CHECK(kind IN ('source','evidence','identity','revision','correction')),
            id TEXT NOT NULL, subject_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
            content_hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(kind,id)
          ) STRICT;
          CREATE TABLE IF NOT EXISTS links (
            from_kind TEXT NOT NULL, from_id TEXT NOT NULL, to_kind TEXT NOT NULL, to_id TEXT NOT NULL, role TEXT NOT NULL,
            PRIMARY KEY(from_kind,from_id,to_kind,to_id,role),
            FOREIGN KEY(from_kind,from_id) REFERENCES records(kind,id), FOREIGN KEY(to_kind,to_id) REFERENCES records(kind,id)
          ) STRICT;
          CREATE UNIQUE INDEX IF NOT EXISTS claim_version ON records(json_extract(payload,'$.claimId'),json_extract(payload,'$.version')) WHERE kind='revision';
          CREATE UNIQUE INDEX IF NOT EXISTS corrected_old ON records(json_extract(payload,'$.supersedesEvidenceId')) WHERE kind='correction';
          CREATE UNIQUE INDEX IF NOT EXISTS corrected_new ON records(json_extract(payload,'$.replacementEvidenceId')) WHERE kind='correction';
          CREATE TRIGGER IF NOT EXISTS immutable_records_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'Immutable research records'); END;
          CREATE TRIGGER IF NOT EXISTS immutable_records_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT,'Immutable research records'); END;
          CREATE TRIGGER IF NOT EXISTS immutable_links_update BEFORE UPDATE ON links BEGIN SELECT RAISE(ABORT,'Immutable research links'); END;
          CREATE TRIGGER IF NOT EXISTS immutable_links_delete BEFORE DELETE ON links BEGIN SELECT RAISE(ABORT,'Immutable research links'); END;
          PRAGMA user_version=2;
        `);
      });
    } catch (error) { this.#db.close(); throw error; }
  }
  #enableWal(inMemory) {
    // journal_mode can return SQLITE_BUSY without invoking SQLite's busy
    // handler during simultaneous first opens. Retry only this lock error,
    // bounded to five seconds; never fall back to another durability mode.
    const deadline=performance.now()+5000;
    const signal=new Int32Array(new SharedArrayBuffer(4));
    for(;;) {
      try {
        const mode=this.#db.prepare('PRAGMA journal_mode=WAL').get().journal_mode;
        if(mode!=='wal' && !(inMemory && mode==='memory')) throw new Error('SQLite WAL mode unavailable; no fallback permitted');
        return;
      }
      catch(error) {
        if(![5,6].includes(error.errcode) || performance.now()>=deadline) throw error;
        Atomics.wait(signal,0,0,20);
      }
    }
  }
  transaction(fn, { write=true } = {}) {
    const nested = this.#depth > 0;
    const savepoint = `memory_${++this.#savepoint}`;
    this.#db.exec(nested ? `SAVEPOINT ${savepoint}` : write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    this.#depth++;
    try {
      const value = fn();
      if (value && typeof value.then === 'function') throw new Error('Memory transactions must be synchronous');
      this.#db.exec(nested ? `RELEASE ${savepoint}` : 'COMMIT');
      return value;
    } catch (error) {
      this.#db.exec(nested ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK');
      throw error;
    } finally { this.#depth--; }
  }
  #decode(row) {
    if (!row) return null;
    const payload = JSON.parse(row.payload);
    if (digest(payload) !== row.content_hash) throw new Error(`Corrupt research record: ${row.id}`);
    return { payload, createdAt:row.created_at };
  }
  get(kind,id) { return this.#decode(this.#db.prepare('SELECT * FROM records WHERE kind=? AND id=?').get(kind,id)); }
  list(kind) { return this.#db.prepare('SELECT * FROM records WHERE kind=? ORDER BY id').all(kind).map(row=>this.#decode(row)); }
  append(kind,payload,createdAt,links=[]) {
    if (!this.#depth) throw new Error('Append requires transaction');
    return this.transaction(()=>this.#append(kind,payload,createdAt,links));
  }
  #append(kind,payload,createdAt,links) {
    if (!kinds.includes(kind)) throw new Error('Unknown record kind');
    const latest = this.#db.prepare('SELECT MAX(created_at) AS latest FROM records').get().latest;
    if (latest && createdAt < latest) throw new Error('Memory clock cannot move backwards');
    this.#db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)').run(kind,payload.id,payload.subjectId,JSON.stringify(canonical(payload)),digest(payload),createdAt);
    const statement = this.#db.prepare('INSERT INTO links VALUES(?,?,?,?,?)');
    for (const link of links) statement.run(kind,payload.id,link.kind,link.id,link.role);
  }
  // Optional Admission participant: separate tables, same transaction/connection.
  // Existing records schema and storage version remain unchanged.
  admissionRecords() {
    this.transaction(()=>this.#db.exec(`
      CREATE TABLE IF NOT EXISTS admission_reviews (
        id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
        previous_id TEXT REFERENCES admission_reviews(id), payload TEXT NOT NULL CHECK(json_valid(payload)),
        content_hash TEXT NOT NULL, created_at TEXT NOT NULL,
        evidence_kind TEXT CHECK(evidence_kind='evidence'), evidence_id TEXT,
        UNIQUE(candidate_id,version), FOREIGN KEY(evidence_kind,evidence_id) REFERENCES records(kind,id),
        CHECK((json_extract(payload,'$.decision')='accepted' AND evidence_kind='evidence' AND evidence_id IS NOT NULL)
           OR (json_extract(payload,'$.decision')='rejected' AND evidence_kind IS NULL AND evidence_id IS NULL))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS admission_fact_links (
        fact_key TEXT PRIMARY KEY, evidence_kind TEXT NOT NULL CHECK(evidence_kind='evidence'), evidence_id TEXT NOT NULL,
        FOREIGN KEY(evidence_kind,evidence_id) REFERENCES records(kind,id)
      ) STRICT;
      CREATE TRIGGER IF NOT EXISTS immutable_reviews_update BEFORE UPDATE ON admission_reviews BEGIN SELECT RAISE(ABORT,'Immutable Review'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_reviews_delete BEFORE DELETE ON admission_reviews BEGIN SELECT RAISE(ABORT,'Immutable Review'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_fact_links_update BEFORE UPDATE ON admission_fact_links BEGIN SELECT RAISE(ABORT,'Immutable admission lineage'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_fact_links_delete BEFORE DELETE ON admission_fact_links BEGIN SELECT RAISE(ABORT,'Immutable admission lineage'); END;
    `));
    return Object.freeze({
      list:()=>this.#db.prepare('SELECT * FROM admission_reviews ORDER BY created_at,candidate_id,version').all().map(row=>this.#decode(row).payload),
      get:id=>{const row=this.#db.prepare('SELECT * FROM admission_reviews WHERE id=?').get(id);return row?this.#decode(row).payload:null;},
      fact:key=>this.#db.prepare('SELECT evidence_id FROM admission_fact_links WHERE fact_key=?').get(key)?.evidence_id??null,
      append:review=>{
        if(!this.#depth)throw new Error('Review append requires shared transaction');
        const latest=this.#db.prepare('SELECT MAX(t) AS latest FROM (SELECT created_at t FROM records UNION ALL SELECT created_at t FROM admission_reviews)').get().latest;
        if(latest && review.recordedAt<latest)throw new Error('Review clock cannot move backwards');
        this.#db.prepare('INSERT INTO admission_reviews VALUES(?,?,?,?,?,?,?,?,?)').run(review.id,review.candidateId,review.version,review.previousReviewId,JSON.stringify(canonical(review)),digest(review),review.recordedAt,review.resultingEvidenceId?'evidence':null,review.resultingEvidenceId);
        if(review.factKey){
          const existing=this.#db.prepare('SELECT evidence_id FROM admission_fact_links WHERE fact_key=?').get(review.factKey);
          if(existing && existing.evidence_id!==review.resultingEvidenceId)throw new Error('Admission duplicate lineage conflict');
          if(!existing)this.#db.prepare("INSERT INTO admission_fact_links VALUES(?,'evidence',?)").run(review.factKey,review.resultingEvidenceId);
        }
      }
    });
  }
  close() { this.#db.close(); }
}
