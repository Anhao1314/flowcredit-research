import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync,symlinkSync,mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync,spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openMemory } from '../memory/open.js';
import { SQLiteBackend } from '../memory/sqlite-backend.js';
import { ResearchMemory } from '../memory/store.js';
import { classifyChange,diffStates } from '../memory/diff.js';
import { instant } from '../memory/time.js';
import { validateMemory } from '../memory/validation.js';
import { runAudit } from '../src/coverage.js';
import { runMemoryCli } from '../src/memory.js';
import { source,evidence,claim,scenario,times } from './fixtures.js';

function withMemory(fn) {
  const folder=mkdtempSync(join(tmpdir(),'fc-memory-')),filename=join(folder,'memory.sqlite');
  let at=times.initial;const clock=()=>at,memory=openMemory({filename,clock});
  try{return fn(memory,value=>{at=value;},filename,clock);}finally{memory.close();rmSync(folder,{recursive:true,force:true});}
}
function seed(m) {const s=source(),e=evidence(s),c=claim(e);m.ingest({sources:[s],evidence:[e],claims:[c]});return {s,e,c};}
const coreweave=runAudit('coreweave');

test('native SQLite persists Sources/Evidence/identities/revisions across reopen',()=>withMemory((m,setTime,path,clock)=>{
  const {s,e,c}=seed(m),other=openMemory({filename:path,clock});
  try {assert.equal(other.getSource(s.id).payload.id,s.id);assert.equal(other.getEvidence(e.id).evidence.rawValue,32);assert.equal(other.getClaim(c.id).version,1);assert.deepEqual(other.counts(),{source:1,evidence:1,identity:1,revision:1,correction:0});}finally{other.close();}
}));
test('CoreWeave duplicate ingestion stays 3/32/4/4 and leaves v0.1 unchanged',()=>withMemory((m,setTime)=>{
  setTime('2026-09-13T12:00:00Z');m.ingest(coreweave);m.ingest(coreweave);
  assert.deepEqual(m.counts(),{source:3,evidence:32,identity:4,revision:4,correction:0});assert.equal(runAudit('coreweave').coverage.weightedCompatibilityPct,9.52);
  assert.equal(m.getClaimsAsOf('coreweave','2026-06-30').length,0);assert.equal(m.getClaimsAsOf('coreweave','2026-09-13').length,4);
}));
test('source stable identity/hash/URL/provenance conflicts cannot overwrite',()=>withMemory(m=>{
  const {s}=seed(m);
  for(const changes of [{url:'https://example.invalid/changed'},{documentDate:'2025-12-30'},{subjectId:'other'},{contentHash:'sha256:'+'a'.repeat(64),metadata:{...s.metadata,hashStatus:'verified_bytes'}}])assert.throws(()=>m.putSource({...s,...changes}),/conflict|mismatch/);
  assert.equal(m.getSource(s.id).payload.url,s.url);
}));
test('repeat retrieval of identical source preserves first retrieval and memory time',()=>withMemory((m,setTime)=>{
  const {s}=seed(m);setTime(times.counter);m.putSource({...s,retrievedAt:times.counter});assert.equal(m.getSource(s.id).payload.retrievedAt,times.initial);assert.equal(m.getSource(s.id).createdAt,instant(times.initial));
}));
test('Evidence statement/value cannot be silently overwritten',()=>withMemory(m=>{
  const {e}=seed(m);for(const changes of [{statement:'overwrite'},{normalizedValue:100}])assert.throws(()=>m.putEvidence({...e,...changes}),/Immutable/);assert.equal(m.getEvidence(e.id).evidence.normalizedValue,32);
}));
test('claim identity requires explicit revision rather than replacement',()=>withMemory(m=>{
  const {c}=seed(m);assert.throws(()=>m.createClaim({...c,confidence:0.6}),/reviseClaim/);assert.equal(m.getClaim(c.id).claim.confidence,0.82);
}));
test('orphan Source rejects Evidence write without partial persistence',()=>withMemory(m=>{
  const e=evidence(source());assert.throws(()=>m.putEvidence(e),/Source unavailable/);assert.equal(m.counts().evidence,0);
}));
test('orphan Evidence rejects Claim and rolls back the identity',()=>withMemory(m=>{
  const c=claim(evidence(source()));assert.throws(()=>m.createClaim(c),/Evidence unavailable/);assert.deepEqual(m.counts(),{source:0,evidence:0,identity:0,revision:0,correction:0});
}));
test('batch ingest rolls back Sources/Evidence if final Claim references an orphan',()=>withMemory(m=>{
  const s=source(),e=evidence(s),c=claim(e);c.supportingEvidenceIds=['EVID-missing'];assert.throws(()=>m.ingest({sources:[s],evidence:[e],claims:[c]}),/Evidence unavailable/);assert.equal(m.counts().source,0);assert.equal(m.counts().evidence,0);
}));
test('cross-subject Claim references are rejected atomically',()=>withMemory(m=>{
  const {e}=seed(m),c=claim(e,{subjectId:'other'});assert.throws(()=>m.createClaim(c),/Cross-subject/);assert.equal(m.counts().identity,1);
}));
test('cross-subject Evidence/Source chain cannot be persisted',()=>withMemory(m=>{
  const s=source();m.putSource(s);assert.throws(()=>m.putEvidence({...evidence(s),subjectId:'other'}),/Cross-subject|hash/);assert.equal(m.counts().evidence,0);
}));
test('supported claim without references is rejected by existing schema',()=>withMemory(m=>{
  const c=claim(evidence(source()));c.supportingEvidenceIds=[];assert.throws(()=>m.createClaim(c),/schema/);assert.equal(m.counts().revision,0);
}));
test('v1/v2/v3 retain stable identity, exact previous version chain and reasons',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime),history=m.getClaimHistory(x.claimId);assert.deepEqual(history.map(r=>r.version),[1,2,3]);assert.deepEqual(history.map(r=>r.previousVersion),[null,1,2]);assert.equal(history[2].previousRevisionId,history[1].id);assert.equal(history[1].revisionReason,'new_counter_evidence');assert.equal(history[2].revisionReason,'evidence_corrected');assert.equal(history[0].claim.confidence,0.82);
}));
test('as-of before counter, after counter and after correction returns historical versions',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime);for(const [date,version] of [['2026-01-02',1],['2026-02-02',2],['2026-03-02',3]])assert.equal(m.getClaimsAsOf(x.subjectId,date)[0].version,version);assert.equal(m.getClaimsAsOf(x.subjectId,'2026-01-01').length,0);
}));
test('counter Evidence qualifies Claim, weakens diff and preserves full provenance',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime),diff=m.diffClaims(x.subjectId,{from:'2026-01-02',to:'2026-02-02'});assert.equal(diff.counts.weakened,1);assert.deepEqual(diff.changes[0].addedEvidenceIds,[x.counterId]);assert.equal(diff.changes[0].after.claim.status,'partially_supported');assert.equal(diff.changes[0].after.provenance.counter[0].source.source.id,source().id);
}));
test('Evidence correction keeps old raw value and links new normalized fact with reason',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime),old=m.getEvidence(x.originalId),next=m.getEvidence(x.correctedId);assert.equal(old.evidence.normalizedValue,32);assert.equal(next.evidence.normalizedValue,32000000);assert.equal(old.corrections[0].replacementEvidenceId,x.correctedId);assert.equal(next.corrections[0].correctionReason,'unit_extraction_error');assert.equal(m.listEvidence(x.subjectId).length,3);assert.equal(m.listEvidence(x.subjectId,{includeSuperseded:false}).length,2);
}));
test('historical provenance before correction does not leak future supersession',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime);assert.equal(m.provenance(x.claimId,{asOf:'2026-01-02'}).provenance.supporting[0].corrections.length,0);assert.equal(m.getEvidence(x.originalId,{asOf:'2026-01-02'}).corrections.length,0);assert.equal(m.getClaimHistory(x.claimId)[0].provenance.supporting[0].evidence.id,x.originalId);
}));
test('failed correction+Claim revision rolls back new Evidence and supersession',()=>withMemory((m,setTime)=>{
  const {s,e}=seed(m);setTime(times.correction);const next=evidence(s,{rawUnit:'USD_millions',normalization:'usd_millions_to_usd',createdAt:times.correction});assert.throws(()=>m.correctEvidence(e.id,next,{correctionReason:'unit_extraction_error',note:'Synthetic correction',claimRevisions:[{claimId:'CLAIM-missing',changes:{}}]}),/Unknown Claim/);assert.equal(m.counts().evidence,1);assert.equal(m.counts().correction,0);assert.equal(m.getEvidence(next.id),null);
}));
test('correction is idempotent; same-ID, conflicting reason and lineage branch reject',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime),replacement=m.getEvidence(x.correctedId).evidence;
  assert.equal(m.correctEvidence(x.originalId,replacement,{correctionReason:x.correction.correctionReason,note:x.correction.note}).id,x.correction.id);
  assert.throws(()=>m.correctEvidence(x.originalId,replacement,{correctionReason:'manual_review',note:'changed'}),/conflict/);
  assert.throws(()=>m.correctEvidence(x.originalId,m.getEvidence(x.originalId).evidence,{correctionReason:'manual_review',note:'same'}),/new Evidence/);
  const branch=evidence(source(),{rawValue:99,label:'branch',createdAt:times.correction});assert.throws(()=>m.correctEvidence(x.originalId,branch,{correctionReason:'manual_review',note:'branch'}),/lineage/);
}));
test('new revisions cannot reuse superseded Evidence, but old history remains',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime);assert.throws(()=>m.reviseClaim(x.claimId,{supportingEvidenceIds:[x.originalId]},{revisionReason:'manual_review'}),/superseded/);assert.equal(m.getClaimHistory(x.claimId).length,3);
}));
test('revision requires structured reason; evidence-related reasons require actual new links',()=>withMemory((m,setTime)=>{
  const {c}=seed(m);setTime(times.counter);assert.throws(()=>m.reviseClaim(c.id,{confidence:0.7},{}),/reason/);
  assert.throws(()=>m.reviseClaim(c.id,{confidence:0.7},{revisionReason:'free text reason'}),/schema/);
  for(const revisionReason of ['new_counter_evidence','new_supporting_evidence','evidence_corrected'])assert.throws(()=>m.reviseClaim(c.id,{confidence:0.7},{revisionReason}),/requires/);assert.equal(m.getClaimHistory(c.id).length,1);
}));
test('optimistic version check prevents a stale caller from overwriting knowledge',()=>withMemory((m,setTime)=>{
  const {c}=seed(m);setTime(times.counter);m.reviseClaim(c.id,{confidence:0.7},{revisionReason:'manual_review',expectedVersion:1});assert.throws(()=>m.reviseClaim(c.id,{confidence:0.6},{revisionReason:'manual_review',expectedVersion:1}),/version conflict/);assert.equal(m.getClaim(c.id).version,2);
}));
test('temporal consistency rejects effectiveAt before dependencies and future scheduling',()=>withMemory((m,setTime)=>{
  const {s,c}=seed(m);setTime(times.counter);const counter=evidence(s,{rawValue:10,label:'counter temporal',createdAt:times.counter});m.putEvidence(counter);
  assert.throws(()=>m.reviseClaim(c.id,{status:'partially_supported',counterEvidenceIds:[counter.id]},{revisionReason:'new_counter_evidence',effectiveAt:'2026-01-20T12:00:00Z'}),/unavailable/);
  assert.throws(()=>m.reviseClaim(c.id,{confidence:0.6},{revisionReason:'manual_review',effectiveAt:'2026-03-01T12:00:00Z'}),/Future/);assert.equal(m.getClaimHistory(c.id).length,1);
}));
test('late revision never appears at its backdated effectiveAt before it was recorded',()=>withMemory((m,setTime)=>{
  const {c}=seed(m);setTime(times.correction);m.reviseClaim(c.id,{confidence:0.6},{revisionReason:'manual_review',effectiveAt:'2026-02-01T12:00:00Z'});
  assert.equal(m.getClaimsAsOf(c.subjectId,'2026-02-02')[0].version,1);assert.equal(m.getClaimsAsOf(c.subjectId,'2026-03-02')[0].version,2);
}));
test('memory clock rollback cannot create durable records',()=>withMemory((m,setTime)=>{
  const {s}=seed(m);setTime('2026-01-02T11:00:00Z');assert.throws(()=>m.putEvidence(evidence(s,{label:'clock rollback'})),/after memory creation|backwards|unavailable/);assert.equal(m.counts().evidence,1);
}));
test('staleness uses explicit evaluation/age, appends once and preserves old as-of',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime);setTime(times.stale);const revisions=m.markStale(x.subjectId,{evaluationDate:times.stale,maxAgeDays:365});assert.equal(revisions.length,1);assert.equal(revisions[0].revisionReason,'stale_evidence');assert.equal(m.markStale(x.subjectId,{evaluationDate:times.stale,maxAgeDays:365}).length,0);assert.equal(m.getClaimsAsOf(x.subjectId,'2026-03-02')[0].claim.status,'partially_supported');assert.equal(m.diffClaims(x.subjectId,{from:'2026-03-02',to:'2027-03-02'}).counts.stale,1);
}));
test('staleness rejects implicit/invalid age and future evaluation',()=>withMemory(m=>{
  const {c}=seed(m);assert.throws(()=>m.markStale(c.subjectId,{evaluationDate:times.initial}),/maxAgeDays/);assert.throws(()=>m.markStale(c.subjectId,{evaluationDate:times.stale,maxAgeDays:365}),/future/);
}));
test('provenance supports selected historical version and unavailable version rejects',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime);assert.equal(m.provenance(x.claimId,{version:1}).provenance.supporting[0].evidence.id,x.originalId);assert.equal(m.provenance(x.claimId,{version:3}).provenance.supporting[0].evidence.id,x.correctedId);assert.throws(()=>m.provenance(x.claimId,{version:99}),/unavailable/);
}));
for(const [label,before,after,oldConfidence,nextConfidence] of [
  ['added',null,'supported',0,0.8],['removed','supported',null,0.8,0],['strengthened','partially_supported','supported',0.9,0.6],['weakened','supported','partially_supported',0.6,0.9],['disputed','supported','disputed',0.8,0.8],['stale','supported','stale',0.8,0.8],['unchanged','supported','supported',0.8,0.8],['changed','supported','supported',0.8,0.8]
])test(`deterministic diff classification: ${label}`,()=>{
  const make=(status,confidence)=>status?{claimId:'CLAIM-test',claim:{id:'CLAIM-test',subjectId:'synthetic',statement:'Synthetic proposition',category:'revenue',method:'manual',supportingEvidenceIds:['EVID-a'],counterEvidenceIds:[],status,confidence,createdAt:times.initial,updatedAt:times.initial}}:null;
  const a=make(before,oldConfidence),b=make(after,nextConfidence);
  if(label==='changed')b.claim.supportingEvidenceIds.push('EVID-b');
  assert.equal(classifyChange(a,b),label);
});
test('same-status confidence delta strengthens/weakens; repeated states stay unchanged',()=>{
  const {c}=(()=>{const e=evidence(source());return {c:claim(e)};})();
  const a={claimId:c.id,claim:c};assert.equal(classifyChange(a,{...a,claim:{...c,confidence:0.9}}),'strengthened');assert.equal(classifyChange(a,{...a,claim:{...c,confidence:0.7}}),'weakened');assert.equal(diffStates([a],[a]).counts.unchanged,1);assert.throws(()=>diffStates([a,a],[]),/Duplicate/);
});
test('as-of ISO dates and timezone equivalence are explicit and strict',()=>{
  assert.equal(instant('2026-06-30',{query:true}),'2026-06-30T23:59:59.999Z');assert.equal(instant('2026-01-02T13:00:00+01:00'),instant(times.initial));
  for(const value of ['2026-02-30','2026-01-01T24:00:00Z','2026-01-01T12:00:00','yesterday'])assert.throws(()=>instant(value,{query:true}));assert.throws(()=>instant('2026-06-30'),/Write/);
});
test('database constraints enforce immutable records/links, unique IDs and orphan rollback',()=>withMemory((m,setTime,path)=>{
  const {s}=seed(m),db=new DatabaseSync(path);
  try {
    assert.throws(()=>db.prepare('UPDATE records SET subject_id=? WHERE id=?').run('other',s.id),/Immutable/);
    assert.throws(()=>db.exec('DELETE FROM links'),/Immutable/);
    assert.throws(()=>db.prepare('INSERT INTO records SELECT * FROM records WHERE id=?').run(s.id),/UNIQUE/);
  }finally{db.close();}
  const backend=new SQLiteBackend(':memory:');
  try {
    backend.transaction(()=>{
      assert.throws(()=>backend.append('identity',{id:'CLAIM-orphan',subjectId:'synthetic'},instant(times.initial),[{kind:'evidence',id:'missing',role:'support'}]),/FOREIGN KEY/);
      assert.equal(backend.get('identity','CLAIM-orphan'),null);
    });
    assert.throws(()=>backend.append('identity',{id:'X',subjectId:'synthetic'},instant(times.initial)),/transaction/);
    assert.throws(()=>backend.transaction(()=>Promise.resolve()),/synchronous/);
  }finally{backend.close();}
}));
test('repository and symlink-to-repository database paths are rejected',()=>{
  const repository=fileURLToPath(new URL('../../',import.meta.url));assert.throws(()=>openMemory({filename:join(repository,'research','forbidden.sqlite')}),/outside/);
  const folder=mkdtempSync(join(tmpdir(),'fc-memory-path-'));
  try {symlinkSync(repository,join(folder,'repo'));assert.throws(()=>openMemory({filename:join(folder,'repo','forbidden.sqlite')}),/outside/);}finally{rmSync(folder,{recursive:true,force:true});}
});
test('future/unversioned database schema fails instead of silent migration',()=>{
  const folder=mkdtempSync(join(tmpdir(),'fc-memory-schema-'));
  try {
    const future=join(folder,'future.sqlite'),db=new DatabaseSync(future);db.exec('PRAGMA user_version=99');db.close();assert.throws(()=>openMemory({filename:future}),/version/);
    const unknown=join(folder,'unknown.sqlite'),other=new DatabaseSync(unknown);other.exec('CREATE TABLE unrelated (id TEXT)');other.close();assert.throws(()=>openMemory({filename:unknown}),/Unversioned/);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
test('memory schema rejects illegal identities/revisions/correction reasons',()=>withMemory((m,setTime)=>{
  const x=scenario(m,setTime),revision=m.getClaimHistory(x.claimId)[0];
  const {provenance,...plain}=revision;validateMemory('revision',plain);
  assert.throws(()=>validateMemory('revision',{...plain,version:0}),/schema/);assert.throws(()=>validateMemory('correction',{...x.correction,correctionReason:'unstructured'}),/schema/);assert.throws(()=>validateMemory('identity',{id:x.claimId,subjectId:x.subjectId,createdAt:'bad'}),/schema/);
}));
test('CLI separate processes ingest idempotently, replay dates, diff and print history/provenance',()=>{
  const folder=mkdtempSync(join(tmpdir(),'fc-memory-cli-')),filename=join(folder,'cli.sqlite'),cli=fileURLToPath(new URL('../src/memory.js',import.meta.url));
  const run=(...args)=>{const result=spawnSync(process.execPath,[cli,...args,'--db',filename],{cwd:tmpdir(),encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
  try {
    assert.deepEqual(run('ingest','coreweave').counts,{source:3,evidence:32,identity:4,revision:4,correction:0});assert.equal(run('ingest','coreweave').counts.revision,4);
    assert.equal(run('claims','coreweave','--as-of','2026-06-30').claims.length,0);
    const current=run('claims','coreweave'),id=current.claims[0].claimId;assert.equal(current.claims.length,4);assert.equal(run('history',id).history.length,1);assert.equal(run('provenance',id).provenance.supporting[0].source.source.subjectId,'coreweave');assert.equal(run('diff','coreweave','--from','2026-06-30','--to','2099-01-01').counts.added,4);
    const invalid=spawnSync(process.execPath,[cli,'diff','coreweave','--db',filename],{encoding:'utf8'});assert.equal(invalid.status,1);
    const unknown=spawnSync(process.execPath,[cli,'ingest','unknown','--db',filename],{encoding:'utf8'});assert.equal(unknown.status,1);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
test('CLI rejects unknown/duplicate/missing options without opening a database',()=>{
  for(const args of [['claims','coreweave','--bad','x'],['claims','coreweave','--as-of'],['claims','coreweave','--db','x','--db','y'],['stale','synthetic'],['provenance','CLAIM-a','--version','0']])assert.throws(()=>runMemoryCli(args));
});
test('diff reversed interval rejects and unchanged interval reports real unchanged Claim',()=>withMemory(m=>{
  const {c}=seed(m);assert.throws(()=>m.diffClaims(c.subjectId,{from:'2026-02-01',to:'2026-01-01'}),/must not/);assert.equal(m.diffClaims(c.subjectId,{from:'2026-01-02',to:'2026-01-02'}).counts.unchanged,1);
}));
test('stale_evidence cannot be written without a valid structured evaluation',()=>withMemory((m,setTime)=>{
  const {c}=seed(m);setTime(times.stale);assert.throws(()=>m.reviseClaim(c.id,{status:'stale'},{revisionReason:'stale_evidence'}),/evaluation/);assert.equal(m.getClaimHistory(c.id).length,1);
}));
test('CLI queries reject a missing database instead of creating empty historical state',()=>{
  const folder=mkdtempSync(join(tmpdir(),'fc-memory-missing-'));try{assert.throws(()=>runMemoryCli(['claims','coreweave','--db',join(folder,'missing.sqlite')]),/does not exist/);}finally{rmSync(folder,{recursive:true,force:true});}
});
test('nested transaction rollback permits a caught failure without orphaned rows',()=>withMemory(m=>{
  m.transaction(()=>{m.putSource(source());assert.throws(()=>m.createClaim(claim(evidence(source()))),/Evidence unavailable/);assert.equal(m.counts().identity,0);});assert.equal(m.counts().source,1);
}));
test('concurrent CLI ingestion serializes to one immutable seed',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'fc-memory-concurrent-')),filename=join(folder,'concurrent.sqlite'),cli=fileURLToPath(new URL('../src/memory.js',import.meta.url));
  const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,'ingest','coreweave','--db',filename]);let output='',error='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>error+=data);child.on('error',reject);child.on('close',code=>code===0?resolve(JSON.parse(output)):reject(new Error(error)));});
  try{const results=await Promise.allSettled([run(),run()]);for(const result of results){assert.equal(result.status,'fulfilled',result.reason?.message);assert.deepEqual(result.value.counts,{source:3,evidence:32,identity:4,revision:4,correction:0});}}finally{rmSync(folder,{recursive:true,force:true});}
});
