import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {SpanEmbeddingIndex,spanEmbeddingId,spanIndexVersion,roundVector} from '../local-retrieval/index.js';
import {spanRenderVersion} from '../local-retrieval/render.js';

const folder=()=>mkdtempSync(join(tmpdir(),'fc-span-index-'));
const identity={spanId:'SPAN-1',spanHash:'sha256:one',rendererVersion:spanRenderVersion,embeddingModel:'nomic-embed-text',embeddingModelDigest:'sha256:model',indexVersion:spanIndexVersion};
const record=(overrides={})=>({...identity,documentId:'GDOC-1',subjectId:'coreweave',sourceId:'SRC-1',page:12,dimension:3,vector:[0.1,0.2,0.3],sourceHash:'sha256:support',createdAt:'2026-09-14T00:00:00.000Z',...overrides,id:overrides.id??spanEmbeddingId({...identity,...overrides})});
test('a span embedding id is derived only from content, renderer and model identity',()=>{
 assert.equal(spanEmbeddingId(identity),spanEmbeddingId({...identity}));
 assert.notEqual(spanEmbeddingId(identity),spanEmbeddingId({...identity,spanHash:'sha256:two'}));
 assert.notEqual(spanEmbeddingId(identity),spanEmbeddingId({...identity,rendererVersion:'span-retrieval-render/v2'}));
 assert.notEqual(spanEmbeddingId(identity),spanEmbeddingId({...identity,embeddingModel:'other-model'}));
 assert.notEqual(spanEmbeddingId(identity),spanEmbeddingId({...identity,embeddingModelDigest:'sha256:other'}));
 assert.notEqual(spanEmbeddingId(identity),spanEmbeddingId({...identity,indexVersion:'span-embedding-index/v2'}));
});
test('re-indexing the same span is idempotent and a conflicting vector is refused',()=>{
 const index=new SpanEmbeddingIndex(join(folder(),'span-index.sqlite'));
 try{
  assert.equal(index.put(record()).inserted,true);
  assert.equal(index.put(record()).inserted,false);
  assert.equal(index.count(),1);
  assert.throws(()=>index.put(record({vector:[0.9,0.9,0.9]})),/Immutable span embedding conflict/);
  assert.equal(index.count(),1);
 }finally{index.close();}
});
test('a changed span hash is a new record and the old hash stops resolving',()=>{
 const index=new SpanEmbeddingIndex(join(folder(),'span-index.sqlite'));
 try{
  const first=record();
  const second=record({spanHash:'sha256:two',vector:[0.4,0.5,0.6]});
  index.put(first);index.put(second);
  assert.equal(index.count(),2);
  assert.equal(index.get('SPAN-1','sha256:one').vector[0],0.1);
  assert.equal(index.get('SPAN-1','sha256:two').vector[0],0.4);
  assert.equal(index.get('SPAN-1','sha256:gone'),null);
  assert.deepEqual(index.stale().map(row=>({...row})),[{spanId:'SPAN-1',hashes:2}]);
 }finally{index.close();}
});
test('stored records are immutable at the database level and malformed records are refused',()=>{
 const file=join(folder(),'span-index.sqlite');
 const index=new SpanEmbeddingIndex(file);
 index.put(record());
 index.close();
 const raw=new DatabaseSync(file);
 try{
  assert.throws(()=>raw.exec("UPDATE span_embeddings SET span_hash='sha256:x'"),/Immutable span embeddings/);
  raw.exec('DROP TRIGGER span_embeddings_no_update');
  raw.exec("UPDATE span_embeddings SET vector='[9,9,9]'");
 }finally{raw.close();}
 const reopened=new SpanEmbeddingIndex(file);
 try{
  assert.throws(()=>reopened.get('SPAN-1','sha256:one'),/Corrupt span embedding record/);
  assert.throws(()=>reopened.put(record({page:0})),/Invalid span embedding page/);
  assert.throws(()=>reopened.put(record({dimension:4})),/Invalid span embedding dimension/);
  assert.throws(()=>roundVector([1,NaN]),/Invalid embedding vector/);
 }finally{reopened.close();}
});
test('the index must live outside the repository and models() reports the pinned provenance',()=>{
 assert.throws(()=>new SpanEmbeddingIndex('research/span-index.sqlite'),/Span index must be outside repository/);
 const index=new SpanEmbeddingIndex(join(folder(),'span-index.sqlite'));
 try{
  index.put(record());
  assert.deepEqual(index.models().map(row=>({...row})),[{model:'nomic-embed-text',digest:'sha256:model',renderer:spanRenderVersion,version:spanIndexVersion,n:1}]);
 }finally{index.close();}
});
test('vector rounding keeps stored vectors deterministic',()=>{
 assert.deepEqual(roundVector([0.123456789,0.5]),[0.123457,0.5]);
 const index=new SpanEmbeddingIndex(join(folder(),'span-index.sqlite'));
 try{
  index.put(record({vector:[0.10,0.2,0.3]}));
  assert.deepEqual(index.get('SPAN-1','sha256:one').vector,[0.1,0.2,0.3]);
 }finally{index.close();}
});
