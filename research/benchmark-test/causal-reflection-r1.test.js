import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateDeterministicRelation} from '../relation-runtime/candidate-deterministic.js';
import {candidateR1DeterministicRelation} from '../relation-runtime/candidate-r1-deterministic.js';

const material=(claim,evidence)=>({claim:{statement:claim},evidence:{statement:evidence}});

test('R1 recognizes explicit financial reflection attribution without changing the frozen candidate',()=>{
 const claim='Higher customer usage was a primary driver of subscription revenue growth.';
 const evidence='Subscription revenue growth primarily reflected increased customer usage.';
 assert.equal(candidateDeterministicRelation(material(claim,evidence)).relation,'NEUTRAL');
 const r1=candidateR1DeterministicRelation(material(claim,evidence));
 assert.equal(r1.relation,'SUPPORTS');
 assert.equal(r1.rule,'RT_EXPLICIT_CAUSAL_ATTRIBUTION');
});

test('R1 accepts largely/mainly reflected as explicit attribution variants',()=>{
 const claim='Higher enterprise usage drove platform revenue growth.';
 for(const evidence of [
  'Platform revenue growth largely reflected higher enterprise usage.',
  'Platform revenue growth mainly reflected higher enterprise usage.'
 ]){
  const result=candidateR1DeterministicRelation(material(claim,evidence));
  assert.equal(result.relation,'SUPPORTS',evidence);
  assert.equal(result.rule,'RT_EXPLICIT_CAUSAL_ATTRIBUTION',evidence);
 }
});

test('R1 does not promote bare reflected language or simple co-occurrence into causality',()=>{
 const claim='Higher customer usage drove subscription revenue growth.';
 const bare=candidateR1DeterministicRelation(material(
  claim,
  'The customer mix reflected increased usage while subscription revenue also increased.'
 ));
 const cooccurrence=candidateR1DeterministicRelation(material(
  claim,
  'Subscription revenue increased and customer usage increased.'
 ));
 assert.notEqual(bare.relation,'SUPPORTS');
 assert.equal(cooccurrence.relation,'NEUTRAL');
});

test('R1 preserves causal scope abstention',()=>{
 const result=candidateR1DeterministicRelation(material(
  'Premium sales caused total company revenue growth.',
  'Device revenue growth was primarily reflected by premium sales while total company revenue also increased.'
 ));
 assert.notEqual(result.relation,'SUPPORTS');
});
