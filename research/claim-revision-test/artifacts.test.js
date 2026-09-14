import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {frozenHashes,codeHashes} from '../claim-revision/cli.js';
import {promptHash,outputSchema,proposalSchema} from '../claim-revision/contract.js';
import {aggregate,decide} from '../claim-revision/eval.js';
import {validateProposal} from '../claim-revision/validation.js';
const base=new URL('../eval/claim-revision/',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n+'.json',base),'utf8'));
test('one locked impact benchmark preserves authority, frozen acquisition and exact proposal bindings',()=>{
 const path=new URL('results.json',base);assert.ok(existsSync(path),'Final locked artifact is required for CI');
 const r=read('results'),g=read('phase-gate'),suite=read('locked-set');
 assert.deepEqual(frozenHashes(),g.frozenHashes);assert.deepEqual(codeHashes(),g.codeHashes);assert.equal(g.promptHash,promptHash);assert.equal(g.schemaHash,digest({outputSchema,proposalSchema}));assert.equal(g.lockedSetHash,digest(suite));assert.equal(r.binding.gateHash,digest(g));
 assert.equal(r.rows.length,18);assert.equal(new Set(r.rows.map(x=>x.caseId)).size,18);assert.deepEqual(r.metrics,aggregate(r.rows));assert.deepEqual({decision:r.decision,safetyPass:r.safetyPass,capabilityPass:r.capabilityPass},decide(r.metrics,r.safety,g));
 for(const row of r.rows){
  assert.deepEqual(row.authorityBefore,row.authorityAfter);assert.equal(row.request.timeMode,'audit');
  for(const e of row.modelInput.evidence){assert.ok(e.knowledgeAt<=row.modelInput.asOf);assert.ok(!e.availableAt||e.availableAt<=row.modelInput.asOf);}
  assert.ok(!JSON.stringify(row.modelInput).includes(row.request.claimId));assert.ok(row.receipts.length<=1);
  if(row.proposal){const p=row.proposal,s=p.inputSnapshot,c={snapshot:s,base:s.base,selected:s.selected,handleMap:s.handleMap,data:s.data,newEvidenceIds:s.selected.filter(n=>n.isNew).map(n=>n.id),asOf:p.asOf,createdAt:p.proposalCreatedAt};validateProposal(p,c);assert.equal(p.lifecycle,'pending');assert.ok(p.evidenceIds.every(id=>s.selected.some(n=>n.id===id&&!n.contextOnly&&n.review.decision==='accepted')));}
 }
 const previous=JSON.parse(readFileSync(new URL('../eval/target-conversion/results.json',import.meta.url),'utf8'));assert.equal(r.authorityProtection.after['v0.2-coreweave.sqlite'].claimPayloadHash,previous.claimsProtection.after.payloadHash);
 assert.deepEqual(r.authorityProtection.before,r.authorityProtection.after);for(const s of Object.values(r.authorityProtection.after)){assert.equal(s.claims,4);assert.equal(s.revisions,4);}
 assert.equal(r.paidInferenceApiCostUsd,0);assert.equal(r.paidEmbeddingApiCostUsd,0);assert.equal(r.paidInferenceApiCalls,0);assert.equal(r.paidEmbeddingApiCalls,0);assert.equal(r.resource.realLockedBenchmarks,1);assert.equal(r.resource.realSmokeCases,0);assert.equal(r.resource.acquisitionBenchmarkCalls,0);assert.equal(r.resource.embeddingCalls,0);assert.equal(r.resource.rankingCalls,0);
});
