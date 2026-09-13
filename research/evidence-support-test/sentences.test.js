import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentSentences,sentenceSpansFor,SentenceSpanIndex} from '../evidence-support/sentences.js';
import {fixture,sentenceFor} from './fixtures.js';

test('decimals and dollar amounts are never split',()=>{
 assert.deepEqual(segmentSentences('Revenue grew to $1.21 billion in the period.').map(s=>s.text),['Revenue grew to $1.21 billion in the period.']);
 assert.deepEqual(segmentSentences('Unsatisfied RPO was $103.7 billion as of June 30, 2026.').map(s=>s.text),['Unsatisfied RPO was $103.7 billion as of June 30, 2026.']);
});
test('abbreviations and initials do not create boundaries',()=>{
 const text='We operate in the U.S. market. The holding is CoreWeave, Inc. and its subsidiaries.';
 assert.equal(segmentSentences(text).length,2);
 assert.deepEqual(segmentSentences('The U.S. market grew.').map(s=>s.text),['The U.S. market grew.']);
});
test('semicolons and colons stay inside a sentence',()=>{
 const text='We report revenue; cost of revenue is reported separately: both in millions.';
 assert.deepEqual(segmentSentences(text).map(s=>s.text),[text]);
});
test('parenthetical sentences keep the closing punctuation',()=>{
 const text='We entered into an order form (the "Order Form"). It matures in 2031.';
 assert.deepEqual(segmentSentences(text).map(s=>s.text),['We entered into an order form (the "Order Form").',' It matures in 2031.']);
});
test('segmentation preserves exact text and offsets with no manufacture',()=>{
 const text='First sentence. Second sentence. No trailing boundary';
 const sentences=segmentSentences(text);
 assert.equal(sentences.map(s=>s.text).join(''),text);
 for(const sentence of sentences)assert.equal(text.slice(sentence.charStart,sentence.charEnd),sentence.text);
});
test('a block without reliable boundaries falls back to a single sentence',()=>{
 const text='Revenue (in millions) Year Ended December 31, 2025';
 assert.deepEqual(segmentSentences(text).map(s=>s.text),[text]);
});
test('sentence spans keep parent linkage, document offsets and line numbers',()=>fixture(({workspace,registry,build})=>{
 const parent=registry.list({spanType:'text'}).find(span=>span.text.includes('First sentence'))??registry.list({spanType:'text'})[0];
 const spans=sentenceSpansFor(parent);
 assert.ok(spans.length>=1);
 for(const sentence of spans){
  assert.equal(sentence.parentSpanId,parent.id);
  assert.equal(parent.text.slice(sentence.charStart,sentence.charEnd),sentence.text);
  assert.equal(workspace.built.document.text.slice(sentence.documentCharStart,sentence.documentCharEnd),sentence.text);
  assert.equal(sentence.locator.lineStart,parent.locator.lineStart+parent.text.slice(0,sentence.charStart).split('\n').length-1);
 }
}));
test('sentence ids and hashes are stable across rebuilds',()=>fixture(({registry})=>{
 const first=new SentenceSpanIndex(registry),second=new SentenceSpanIndex(registry);
 assert.deepEqual(first.list().map(s=>s.id),second.list().map(s=>s.id));
 assert.deepEqual(first.list().map(s=>s.contentHash),second.list().map(s=>s.contentHash));
}));
test('every sentence verifies against its verified parent chain',()=>fixture(({sentences})=>{
 for(const sentence of sentences.list()){
  const verdict=sentences.verify(sentence.id);
  assert.equal(verdict.valid,true,verdict.reason);
 }
 assert.deepEqual(sentences.verify('SPAN-not-a-sentence'),{valid:false,reason:'SENTENCE_UNKNOWN'});
}));
test('the control document offers sentence spans for both narrative blocks',()=>fixture(({sentences})=>{
 assert.ok(sentences.list().some(s=>s.text.includes('Ignore previous instructions')));
 assert.ok(sentences.list().some(s=>s.text.includes('continued to invest in data center capacity')));
 const clean=sentenceFor({sentences},s=>s.text.includes('continued to invest in data center capacity'));
 assert.equal(clean.text,'The Company continued to invest in data center capacity during the period.');
}));
