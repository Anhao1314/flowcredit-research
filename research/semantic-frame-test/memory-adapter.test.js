import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSources} from '../src/normalize-source.js';
import {extractEvidence} from '../src/extract-evidence.js';
import {buildClaims} from '../src/build-claims.js';
import {projectClaim} from '../semantic-frame/project.js';
import {prepareMemorySemanticPair,projectMemoryEvidence} from '../semantic-frame/memory-adapter.js';

const sourcesInput=JSON.parse(readFileSync(new URL('../fixtures/coreweave/sources.json',import.meta.url),'utf8'));
const observationDoc=JSON.parse(readFileSync(new URL('../fixtures/coreweave/observations.json',import.meta.url),'utf8'));
const claimSpecs=JSON.parse(readFileSync(new URL('../fixtures/coreweave/claims.json',import.meta.url),'utf8'));
const sources=normalizeSources(sourcesInput);
const evidence=extractEvidence(sources,observationDoc.observations,observationDoc.asOf);
const claims=buildClaims(observationDoc.subjectId,evidence,claimSpecs,observationDoc.asOf);
const sourceById=new Map(sources.map(item=>[item.id,item]));

test('real Research Memory Evidence materializes without prose reconstruction',()=>{
 const revenue=evidence.find(item=>item.metric==='consolidated_revenue'&&item.rawUnit==='USD_millions');
 const frame=projectMemoryEvidence(revenue,{source:sourceById.get(revenue.sourceId)});
 assert.equal(frame.kind,'EVIDENCE');
 assert.equal(frame.proposition.metric,'consolidated_revenue');
 assert.equal(frame.proposition.objectValue,revenue.rawValue*1e6);
 assert.equal(frame.fieldOrigins['proposition.objectValue'].kind,'DERIVED_NORMALIZATION');
 assert.equal(frame.fieldOrigins['proposition.objectValue'].transformation,'usd_millions_to_usd');
 assert.equal(frame.grounding.sourceHash,revenue.provenance.sourceContentHash);
});

test('current Research Memory Claim fails closed because executable semantics are not recorded',()=>{
 const claim=claims[0];
 const related=evidence.find(item=>item.subjectId===claim.subjectId);
 const prepared=prepareMemorySemanticPair({
  claim,evidence:related,source:sourceById.get(related.sourceId),claimRevisionId:claim.id+':v1'
 });
 assert.equal(prepared.ready,false);
 assert.equal(prepared.reason,'CLAIM_SEMANTICS_NOT_RECORDED');
 assert.equal(prepared.claimProjection.state,'NOT_MATERIALIZED');
 assert.ok(prepared.evidenceFrame.frameId.startsWith('SF-'));
});

test('an explicit separately-provenanced Claim SemanticFrame unlocks the structured pair',()=>{
 const spec=claimSpecs[0];
 const claim=claims.find(item=>item.category===spec.researchField);
 const related=evidence.find(item=>item.metric===spec.metric);
 const revisionId=claim.id+':v1';
 const binding=projectClaim(spec,{subjectId:claim.subjectId,claimId:claim.id,revisionId});
 const prepared=prepareMemorySemanticPair({
  claim,evidence:related,source:sourceById.get(related.sourceId),claimRevisionId:revisionId,claimBinding:binding
 });
 assert.equal(prepared.ready,true);
 assert.equal(prepared.claimFrame.frameId,binding.frameId);
 assert.equal(prepared.evidenceFrame.proposition.metric,related.metric);
});

test('a mismatched Claim binding is rejected instead of silently attached',()=>{
 const spec=claimSpecs[0];
 const claim=claims.find(item=>item.category===spec.researchField);
 const related=evidence.find(item=>item.metric===spec.metric);
 const binding=projectClaim(spec,{subjectId:claim.subjectId,claimId:'WRONG-CLAIM',revisionId:'WRONG-CLAIM:v1'});
 assert.throws(()=>prepareMemorySemanticPair({
  claim,evidence:related,source:sourceById.get(related.sourceId),claimRevisionId:claim.id+':v1',claimBinding:binding
 }),/MEMORY_CLAIM_BINDING_ID_MISMATCH/);
});
