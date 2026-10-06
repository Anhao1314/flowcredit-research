import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCausalRoles,compareCausalRoles} from '../relation-runtime/candidate-r2-causal-roles.js';
import {candidateR1DeterministicRelation} from '../relation-runtime/candidate-r1-deterministic.js';
import {candidateR2DeterministicRelation} from '../relation-runtime/candidate-r2-deterministic.js';

const material=(claim,evidence)=>({claim:{statement:claim},evidence:{statement:evidence}});

test('R2 aligns active claim driver/outcome with passive filing attribution',()=>{
 const claim='Higher subscription revenue drove the increase in operating profit.';
 const evidence='Operating profit increased 18 percent, driven by higher subscription revenue.';
 const claimFrame=parseCausalRoles(claim);
 const evidenceFrame=parseCausalRoles(evidence);
 assert.deepEqual(claimFrame.driverTokens,['subscription','revenue']);
 assert.deepEqual(claimFrame.outcomeTokens,['operating','profit']);
 assert.deepEqual(evidenceFrame.driverTokens,['subscription','revenue']);
 assert.deepEqual(evidenceFrame.outcomeTokens,['operating','profit']);
 const result=candidateR2DeterministicRelation(material(claim,evidence));
 assert.equal(result.relation,'SUPPORTS');
 assert.equal(result.rule,'RT_CAUSAL_ROLE_ALIGNED');
});

test('R2 aligns primary-driver claim with driven-by evidence',()=>{
 const claim='Higher enterprise revenue was a primary driver of cloud operating income growth.';
 const evidence='Cloud operating income increased 25 percent, primarily driven by higher enterprise revenue.';
 const result=candidateR2DeterministicRelation(material(claim,evidence));
 assert.equal(result.relation,'SUPPORTS');
 assert.equal(result.rule,'RT_CAUSAL_ROLE_ALIGNED');
});

test('R2 does not treat a different driver for the same outcome as support',()=>{
 const claim='Higher subscription revenue drove operating profit growth.';
 const evidence='Operating profit increased, driven by lower support costs.';
 const compared=compareCausalRoles(claim,evidence);
 assert.equal(compared.relation,'NEUTRAL');
 assert.equal(compared.rule,'RT_CAUSAL_DRIVER_MISMATCH');
 const result=candidateR2DeterministicRelation(material(claim,evidence));
 assert.equal(result.relation,'NEUTRAL');
});

test('R2 does not treat reversed causal roles as support',()=>{
 const claim='Higher subscription revenue drove operating profit growth.';
 const evidence='Subscription revenue increased, driven by higher operating profit.';
 const compared=compareCausalRoles(claim,evidence);
 assert.equal(compared.relation,'NEUTRAL');
 assert.equal(compared.rule,'RT_CAUSAL_ROLES_REVERSED');
});

test('R2 does not manufacture causality from co-occurrence',()=>{
 const claim='Higher subscription revenue drove operating profit growth.';
 const evidence='Subscription revenue increased 12 percent and operating profit increased 8 percent.';
 const result=candidateR2DeterministicRelation(material(claim,evidence));
 assert.notEqual(result.rule,'RT_CAUSAL_ROLE_ALIGNED');
 assert.notEqual(result.relation,'SUPPORTS');
});

test('R2 preserves R1 reflected-attribution support',()=>{
 const claim='Higher customer usage was a primary driver of subscription revenue growth.';
 const evidence='Subscription revenue growth primarily reflected increased customer usage.';
 const r1=candidateR1DeterministicRelation(material(claim,evidence));
 const r2=candidateR2DeterministicRelation(material(claim,evidence));
 assert.equal(r1.relation,'SUPPORTS');
 assert.equal(r2.relation,'SUPPORTS');
});

test('R2 role parsing is content based and contains no benchmark identifiers',()=>{
 const source=[
  parseCausalRoles.toString(),
  compareCausalRoles.toString(),
  candidateR2DeterministicRelation.toString()
 ].join('\n');
 assert.ok(!/HOLD-|META|AMZN|GOOG|real-sec-blind/i.test(source));
});
