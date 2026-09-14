import {DatabaseSync} from 'node:sqlite';
import {dirname} from 'node:path';
import {existsSync,realpathSync} from 'node:fs';
import {externalDirectory} from '../analyst-real/cli.js';
import {digest,stableId} from '../src/identity.js';
import {instant} from '../memory/time.js';
import {prepareContext} from './context.js';
import {validateProposal} from './validation.js';
export class ProposalStore {
 #db;#reader;#test;#clock;
 constructor(filename,{reader,allowSystemTest=false,clock=()=>new Date().toISOString()}={}){
  if(filename!==':memory:'){externalDirectory(dirname(filename));if(existsSync(filename))externalDirectory(dirname(realpathSync(filename)));}
  this.#reader=reader;this.#test=allowSystemTest;this.#clock=clock;
  this.#db=new DatabaseSync(filename,{allowExtension:false});
  try{const v=this.#db.prepare('PRAGMA user_version').get().user_version;
   if(v!==0&&v!==12)throw Error('PROPOSAL_STORE_VERSION');
   this.#db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
   if(v===0&&this.#db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)throw Error('PROPOSAL_STORE_NOT_EMPTY');
   this.#db.exec(`CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,input_hash TEXT NOT NULL UNIQUE,payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,proposal_id TEXT NOT NULL REFERENCES proposals(id),version INTEGER NOT NULL,previous_id TEXT REFERENCES reviews(id),payload TEXT NOT NULL CHECK(json_valid(payload)),hash TEXT NOT NULL,UNIQUE(proposal_id,version)) STRICT;
    CREATE TRIGGER IF NOT EXISTS proposal_no_update BEFORE UPDATE ON proposals BEGIN SELECT RAISE(ABORT,'Immutable Proposal'); END;
    CREATE TRIGGER IF NOT EXISTS proposal_no_delete BEFORE DELETE ON proposals BEGIN SELECT RAISE(ABORT,'Immutable Proposal'); END;
    CREATE TRIGGER IF NOT EXISTS review_no_update BEFORE UPDATE ON reviews BEGIN SELECT RAISE(ABORT,'Immutable Review'); END;
    CREATE TRIGGER IF NOT EXISTS review_no_delete BEFORE DELETE ON reviews BEGIN SELECT RAISE(ABORT,'Immutable Review'); END; PRAGMA user_version=12;`);
  }catch(e){this.#db.close();throw e;}
 }
 #decode(row){if(!row)return null;const p=JSON.parse(row.payload);if(digest(p)!==row.hash)throw Error('PROPOSAL_STORE_HASH');return p;}
 get(id){return this.#decode(this.#db.prepare('SELECT * FROM proposals WHERE id=?').get(id));}
 byInput(hash){return this.#decode(this.#db.prepare('SELECT * FROM proposals WHERE input_hash=?').get(hash));}
 #context(p){return prepareContext(this.#reader,{claimId:p.claimId,baseRevisionId:p.baseRevisionId,newEvidenceIds:p.newEvidenceAvailableAt.map(n=>n.evidenceId),asOf:p.asOf,timeMode:p.timeMode,createdAt:p.proposalCreatedAt});}
 append(p){
  validateProposal(p,this.#context(p));
  this.#db.exec('BEGIN IMMEDIATE');try{const old=this.byInput(p.inputHash);if(old){if(digest(old)!==digest(p))throw Error('PROPOSAL_IDEMPOTENCE_CONFLICT');this.#db.exec('COMMIT');return old;}
   this.#db.prepare('INSERT INTO proposals VALUES(?,?,?,?)').run(p.proposalId,p.inputHash,JSON.stringify(p),digest(p));this.#db.exec('COMMIT');return p;
  }catch(e){this.#db.exec('ROLLBACK');throw e;}
 }
 history(id){return this.#db.prepare('SELECT * FROM reviews WHERE proposal_id=? ORDER BY version').all(id).map(r=>this.#decode(r));}
 state(id){const p=this.get(id);if(!p)throw Error('PROPOSAL_MISSING');let stale=false;try{validateProposal(p,this.#context(p));const at=instant(this.#clock()),base=this.#reader.getClaim(p.claimId,{asOf:at});stale=!base||base.id!==p.baseRevisionId||digest(base)!==p.baseRevisionHash;for(const e of p.evidenceIds){const n=this.#reader.getEvidence(e,{asOf:at});if(!n||n.corrections.some(c=>c.supersedesEvidenceId===e))stale=true;}}catch{stale=true;}
  const reviews=this.history(id);return {proposal:p,state:stale?'stale':reviews.at(-1)?.decision??'pending',stale,reviews,authoritativeRevisionWritten:false};
 }
 review(id,options){
  const keys=['decision','reviewerType','reviewerId','reason','expectedProposalHash','previousReviewId'];
  if(!options||Object.keys(options).some(k=>!keys.includes(k))||!['accepted','rejected'].includes(options.decision)||!options.reviewerId?.trim()||!options.reason?.trim())throw Error('REVIEW_INVALID');
  if(options.reviewerType!=='human'&&!(options.reviewerType==='system_test'&&this.#test))throw Error('REVIEW_ACTOR_FORBIDDEN');
  this.#db.exec('BEGIN IMMEDIATE');try{const state=this.state(id),p=state.proposal;
   if(options.expectedProposalHash!==digest(p))throw Error('REVIEW_PROPOSAL_HASH');
   const requestHash=digest(options),old=state.reviews.at(-1);if(old?.requestHash===requestHash){this.#db.exec('COMMIT');return old;}
   if((old?.id??null)!==(options.previousReviewId??null))throw Error('REVIEW_CONFLICT');
   if(options.decision==='accepted'&&state.stale)throw Error('REVIEW_STALE');
   const recordedAt=instant(this.#clock());if(recordedAt<p.proposalCreatedAt||old&&recordedAt<old.recordedAt)throw Error('REVIEW_TEMPORAL');
   const body={proposalId:id,version:(old?.version??0)+1,previousReviewId:old?.id??null,decision:options.decision,reviewerType:options.reviewerType,reviewerId:options.reviewerId,reason:options.reason,proposalHash:digest(p),requestHash,recordedAt,wasStale:state.stale,authoritativeRevisionWritten:false};
   const review={id:stableId('CRPREVIEW',body),...body};this.#db.prepare('INSERT INTO reviews VALUES(?,?,?,?,?,?)').run(review.id,id,review.version,review.previousReviewId,JSON.stringify(review),digest(review));this.#db.exec('COMMIT');return review;
  }catch(e){this.#db.exec('ROLLBACK');throw e;}
 }
 close(){this.#db.close();}
}
