import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {seedCase,auditAsOf,proposalTime} from '../claim-revision/fixtures.js';
import {readOnlyMemory} from '../claim-revision/reader.js';
import {openMemory} from '../memory/open.js';
import {resolveRelationInput} from '../claim-relation/resolve.js';
import {forbiddenRelationInputMembers} from '../claim-relation/contract.js';

const descriptor={name:'relation-resolve',claim:'December tool revenue was greater than 40 USD.',old:'December tool revenue was 57 USD.',fresh:['The final December tool revenue was 57 USD.']};
const seeded=fn=>{const f=seedCase(descriptor);try{return fn(f);}finally{f.close();}};
const request=(f,changes={})=>({evidenceId:f.request.newEvidenceIds[0],claimId:f.request.claimId,claimRevisionId:f.request.baseRevisionId,asOf:auditAsOf,createdAt:proposalTime,...changes});
const keysOf=value=>Object.keys(value);
const allKeys=(value,out=[])=>{if(Array.isArray(value))for(const item of value)allKeys(item,out);else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){out.push(key);allKeys(item,out);}return out;};

test('valid accepted Evidence and explicit revision resolve to the frozen RelationInput v1 shape',()=>seeded(f=>{
 const {relationInput,material}=resolveRelationInput(f.reader,request(f));
 assert.deepEqual(relationInput,{evidence:{evidenceId:f.request.newEvidenceIds[0]},claim:{claimId:f.request.claimId,revisionId:f.request.baseRevisionId},asOf:auditAsOf,evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},claimSide:{semantics:{state:'NOT_MATERIALIZED'}}});
 assert.deepEqual(keysOf(relationInput),['evidence','claim','asOf','evidenceSide','claimSide']);
 assert.ok(Object.isFrozen(relationInput)&&Object.isFrozen(relationInput.evidenceSide.semantics));
 assert.throws(()=>{relationInput.asOf='2030-01-01T00:00:00.000Z';},TypeError);
 for(const forbidden of forbiddenRelationInputMembers)assert.ok(!allKeys(relationInput).includes(forbidden),`forbidden member ${forbidden}`);
 // RI-13.5: material is a transport artifact outside the pair, and carries no
 // authority flags into it (RI-11.2).
 assert.equal(material.evidence.statement,'The final December tool revenue was 57 USD.');
 assert.equal(material.claim.version,1);
}));

test('asOf is explicit and normalized; a date-only boundary becomes an instant inside the input',()=>seeded(f=>{
 const {relationInput}=resolveRelationInput(f.reader,request(f,{asOf:'2026-03-01',createdAt:proposalTime}));
 assert.equal(relationInput.asOf,'2026-03-01T23:59:59.999Z');
 assert.throws(()=>resolveRelationInput(f.reader,request(f,{asOf:undefined})),/FUTURE_ASOF/);
}));

test('PRESENT requires an authoritative binding and is never synthesized (RI-9.x)',()=>seeded(f=>{
 const valid=resolveRelationInput(f.reader,request(f,{projections:{evidence:{frameRef:'frame-evidence-1',legality:'VALID',materializedAt:'2026-02-03T00:00:00.000Z'}}}));
 assert.deepEqual(valid.relationInput.evidenceSide,{semantics:{state:'PRESENT',frameRef:'frame-evidence-1'}});
 assert.deepEqual(valid.relationInput.claimSide,{semantics:{state:'NOT_MATERIALIZED'}});
 assert.throws(()=>resolveRelationInput(f.reader,request(f,{projections:{claim:{legality:'VALID'}}})),/SEMANTICS_INVALID/);
 assert.throws(()=>resolveRelationInput(f.reader,request(f,{projections:{claim:{frameRef:'   ',legality:'VALID'}}})),/SEMANTICS_INVALID/);
 assert.throws(()=>resolveRelationInput(f.reader,request(f,{projections:{claim:{frameRef:'frame-claim-1',legality:'INVALID'}}})),/SEMANTICS_INVALID/);
 assert.throws(()=>resolveRelationInput(f.reader,request(f,{projections:{claim:{frameRef:'frame-claim-1',legality:'VALID',materializedAt:'2026-06-01T00:00:00.000Z'}}})),/FUTURE_PROJECTION/);
}));

test('eligibility refusals are deterministic codes and produce no RelationInput',()=>seeded(f=>{
 const base=request(f);
 const cases=[
  ['evidence bundle shape',{evidenceId:[...f.request.newEvidenceIds,f.request.newEvidenceIds[0]]},/EVIDENCE_BOUND/],
  ['evidence array shape',{evidenceId:[f.request.newEvidenceIds[0]]},/EVIDENCE_BOUND/],
  ['missing evidence identity',{evidenceId:'EVIDENCE-unknown'},/EVIDENCE_UNAVAILABLE/],
  ['stale revision binding',{claimRevisionId:'CLAIM-unknown:v1'},/BASE_REVISION_STALE/],
  ['missing claim identity',{claimId:'CLAIM-unknown'},/CLAIM_MISSING/],
  ['non-audit time mode',{timeMode:'replay'},/TIME_MODE_UNSUPPORTED/]
 ];
 for(const [name,changes,pattern] of cases)assert.throws(()=>resolveRelationInput(f.reader,{...base,...changes}),pattern,name);
}));

test('as-of discipline: future evidence, future asOf and unaccepted evidence refuse',()=>seeded(f=>{
 const base=request(f);
 assert.throws(()=>resolveRelationInput(f.reader,{...base,asOf:'2026-01-15T00:00:00.000Z'}),/EVIDENCE_UNAVAILABLE/);
 assert.throws(()=>resolveRelationInput(f.reader,{...base,asOf:'2026-04-01T00:00:00.000Z'}),/FUTURE_ASOF/);
 assert.throws(()=>resolveRelationInput({...f.reader,reviews:()=>[]},base),/EVIDENCE_NOT_ACCEPTED/);
 // Evidence whose public availability lands after the boundary is a future leak.
 const future={...f.reader,reviews:()=>f.reader.reviews().map(review=>({...review,availableAt:'2026-04-01T00:00:00.000Z'}))};
 assert.throws(()=>resolveRelationInput(future,base),/FUTURE_EVIDENCE/);
}));

test('admission binding tampering refuses with ADMISSION_INVALID',()=>seeded(f=>{
 const base=request(f);
 const tampers=[
  ['source identity',review=>({...review,snapshot:{...review.snapshot,source:{...review.snapshot.source,id:'other-source'}}})],
  ['source content hash',review=>({...review,snapshot:{...review.snapshot,source:{...review.snapshot.source,contentHash:'sha256:0000000000000000000000000000000000000000000000000000000000000000'}}})],
  ['validation status',review=>({...review,validationSnapshot:{...review.validationSnapshot,validationStatus:'invalid'}})],
  ['admission subject',review=>({...review,subjectId:'other-subject'})]
 ];
 for(const [name,tamper] of tampers)assert.throws(()=>resolveRelationInput({...f.reader,reviews:()=>f.reader.reviews().map(tamper)},base),/ADMISSION_INVALID/,name);
}));

test('superseded evidence and historical revision binding resolve explicitly',()=>{
 const corrected=seedCase({name:'relation-superseded',claim:'December receipts were greater than 45 USD.',old:'December receipts were 58 USD.',fresh:['Correction: December receipts were 33 USD, replacing the earlier 58 USD disclosure.'],correction:true});
 let supersededId;
 try{supersededId=corrected.reader.getClaim(corrected.request.claimId,{asOf:auditAsOf}).provenance.supporting[0].evidence.id;
  assert.throws(()=>resolveRelationInput(corrected.reader,{...request({request:corrected.request}),evidenceId:supersededId}),/SUPERSEDED_EVIDENCE/);
 }finally{corrected.close();}

 const f=seedCase(descriptor);
 try{
  const firstRevisionId=f.request.baseRevisionId;
  const history=f.reader.getClaim(f.request.claimId,{asOf:auditAsOf}).provenance.supporting[0].evidence.id;
  const secondRevisionTime='2026-02-10T12:00:00.000Z';
  const memory=openMemory({filename:join(f.folder,'memory.sqlite'),clock:()=>secondRevisionTime});
  memory.reviseClaim(f.request.claimId,{confidence:0.9},{revisionReason:'manual_review',note:'Synthetic second revision for the historical binding test.',expectedVersion:1});
  const secondRevisionId=memory.getClaim(f.request.claimId).id;
  memory.close();
  const reader=readOnlyMemory(join(f.folder,'memory.sqlite'));
  try{
   // The explicitly requested revision is pinned, never silently the latest one.
   const historical=resolveRelationInput(reader,{evidenceId:history,claimId:f.request.claimId,claimRevisionId:firstRevisionId,asOf:'2026-01-20T00:00:00.000Z',createdAt:'2026-01-21T00:00:00.000Z'});
   assert.equal(historical.relationInput.claim.revisionId,firstRevisionId);
   assert.equal(historical.material.claim.version,1);
   // A revision that is not yet effective at the boundary cannot be selected.
   assert.throws(()=>resolveRelationInput(reader,{evidenceId:history,claimId:f.request.claimId,claimRevisionId:secondRevisionId,asOf:'2026-01-20T00:00:00.000Z',createdAt:'2026-01-21T00:00:00.000Z'}),/BASE_REVISION_STALE/);
   // Once a later revision is authoritative at the boundary, the older binding refuses.
   assert.throws(()=>resolveRelationInput(reader,{evidenceId:history,claimId:f.request.claimId,claimRevisionId:firstRevisionId,asOf:auditAsOf,createdAt:proposalTime}),/BASE_REVISION_STALE/);
   const latest=resolveRelationInput(reader,{evidenceId:history,claimId:f.request.claimId,claimRevisionId:secondRevisionId,asOf:auditAsOf,createdAt:proposalTime});
   assert.equal(latest.material.claim.version,2);
  }finally{reader.close();}
 }finally{f.close();}
});

test('resolution is read-only over Research Memory',()=>seeded(f=>{
 const before=f.reader.snapshot();
 const {relationInput,material}=resolveRelationInput(f.reader,request(f));
 resolveRelationInput(f.reader,request(f,{projections:{claim:{frameRef:'frame-claim-1',legality:'VALID'}}}));
 assert.ok(relationInput&&material);
 assert.deepEqual(f.reader.snapshot(),before);
}));
