import test from 'node:test';
import assert from 'node:assert/strict';
import {seedCase,auditAsOf,proposalTime} from '../claim-revision/fixtures.js';
import {resolveRelationInput} from '../claim-relation/resolve.js';
import {compatibilityAssessment} from '../claim-relation/compatibility.js';
import {relationGate,eligibilityRefusal} from '../claim-relation/gate.js';
import {relationLabels} from '../claim-relation/contract.js';

const asOf='2026-03-01T12:00:00.000Z';
const build=(claimStatement,evidenceStatement)=>{
 const relationInput={evidence:{evidenceId:'EVIDENCE-gate'},claim:{claimId:'CLAIM-gate',revisionId:'CLAIM-gate:v1'},asOf,evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},claimSide:{semantics:{state:'NOT_MATERIALIZED'}}};
 const material={evidenceId:'EVIDENCE-gate',claimId:'CLAIM-gate',revisionId:'CLAIM-gate:v1',asOf,claim:{statement:claimStatement},evidence:{statement:evidenceStatement}};
 return {relationInput,material,assessment:compatibilityAssessment(relationInput,material)};
};
const labelsIn=value=>relationLabels.filter(label=>JSON.stringify(value).includes(label));
const seeded=(descriptor,fn)=>{const f=seedCase(descriptor);try{return fn(f);}finally{f.close();}};
const pipeline=(f,request={})=>{
 const {relationInput,material}=resolveRelationInput(f.reader,{evidenceId:f.request.newEvidenceIds[0],claimId:f.request.claimId,claimRevisionId:f.request.baseRevisionId,asOf:auditAsOf,createdAt:proposalTime,...request});
 return {relationInput,gate:relationGate({relationInput,assessment:compatibilityAssessment(relationInput,material)})};
};

test('COMMENSURABLE permits execution without any Relation label (CM-37.1)',()=>{
 const {relationInput,assessment}=build('December tool revenue was greater than 40 USD.','December tool revenue was 57 USD.');
 assert.equal(assessment.disposition,'COMMENSURABLE');
 const gate=relationGate({relationInput,assessment});
 assert.deepEqual(gate,{mayExecute:true,processingStatus:null,relation:null,refusal:null});
 assert.deepEqual(labelsIn(gate),[]);
});

test('negative dispositions refuse execution as NOT_EVALUATED + null (CM-37.2/37.3, ADR 4.3)',()=>{
 for(const [claimStatement,evidenceStatement,disposition] of [
  ['December tool revenue was greater than 40 USD.','December tool margin was 12 percent.','NOT_COMMENSURABLE'],
  ['December tool revenue was greater than 40 USD.','Tool revenue is described favorably, but no amount or reporting period is given.','INDETERMINATE']
 ]){
  const {relationInput,assessment}=build(claimStatement,evidenceStatement);
  assert.equal(assessment.disposition,disposition);
  const gate=relationGate({relationInput,assessment});
  assert.equal(gate.mayExecute,false);
  assert.equal(gate.processingStatus,'NOT_EVALUATED');
  assert.equal(gate.relation,null);
  assert.equal(gate.refusal.stage,'COMPATIBILITY');
  assert.equal(gate.refusal.code,disposition);
  assert.equal(gate.refusal.disposition,disposition);
  assert.equal(gate.refusal.findings,assessment.findings);
  assert.deepEqual(labelsIn(gate),[]);
 }
});

test('missing or wrong-pair assessments fail closed (session 2.7B sections 12-13)',()=>{
 const {relationInput,material,assessment}=build('December tool revenue was greater than 40 USD.','December tool revenue was 57 USD.');
 const missing=relationGate({relationInput});
 assert.deepEqual(missing,{mayExecute:false,processingStatus:'NOT_EVALUATED',relation:null,refusal:{stage:'COMPATIBILITY',code:'ASSESSMENT_MISSING'}});
 // A structurally equal but different input is not the bound pair: fail closed.
 const clone={evidence:{...relationInput.evidence},claim:{...relationInput.claim},asOf:relationInput.asOf,evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},claimSide:{semantics:{state:'NOT_MATERIALIZED'}}};
 assert.equal(relationGate({relationInput:clone,assessment}).refusal.code,'PAIR_BINDING_MISMATCH');
 // An assessment produced for another pair is refused for this one.
 const otherIdentity={...relationInput,evidence:{evidenceId:'EVIDENCE-gate-other'}};
 const otherMaterial={...material,evidenceId:'EVIDENCE-gate-other'};
 const foreign=compatibilityAssessment(otherIdentity,otherMaterial);
 assert.equal(relationGate({relationInput,assessment:foreign}).refusal.code,'PAIR_BINDING_MISMATCH');
 assert.equal(relationGate({}).refusal.code,'RELATION_INPUT_MISSING');
 assert.deepEqual(eligibilityRefusal('EVIDENCE_BOUND'),{mayExecute:false,processingStatus:'NOT_EVALUATED',relation:null,refusal:{stage:'ELIGIBILITY',code:'EVIDENCE_BOUND'}});
});

test('the whole resolved pipeline agrees with the gate on real Research Memory',()=>{
 const descriptor={name:'gate-pipeline',claim:'December tool revenue was greater than 40 USD.',old:'December tool revenue was 57 USD.',fresh:['Tool revenue is described favorably, but no amount or reporting period is given.']};
 seeded(descriptor,f=>{
  const {gate}=pipeline(f);
  assert.equal(gate.mayExecute,false);
  assert.equal(gate.processingStatus,'NOT_EVALUATED');
  assert.equal(gate.relation,null);
  assert.equal(gate.refusal.disposition,'INDETERMINATE');
 });
 seeded({...descriptor,fresh:['The tool revenue reporting team moved to another office.']},f=>{
  assert.equal(pipeline(f).gate.refusal.disposition,'NOT_COMMENSURABLE');
 });
 seeded({...descriptor,fresh:['December tool revenue was 57 USD.']},f=>{
  assert.equal(pipeline(f).gate.mayExecute,true);
 });
});

test('the pipeline never mutates Research Memory (session 2.7B section 18)',()=>seeded({name:'gate-readonly',claim:'December tool revenue was greater than 40 USD.',old:'December tool revenue was 57 USD.',fresh:['The final December tool revenue was 57 USD.']},f=>{
 const before=f.reader.snapshot();
 const {relationInput,material}=resolveRelationInput(f.reader,{evidenceId:f.request.newEvidenceIds[0],claimId:f.request.claimId,claimRevisionId:f.request.baseRevisionId,asOf:auditAsOf,createdAt:proposalTime});
 const assessment=compatibilityAssessment(relationInput,material);
 const gate=relationGate({relationInput,assessment});
 assert.ok(gate.mayExecute);
 const after=f.reader.snapshot();
 assert.deepEqual(after,before);
 assert.equal(after.payloadHash,before.payloadHash);
}));
