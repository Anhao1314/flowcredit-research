import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {localEmbeddingProvider,configuredEmbeddingProvider,validateEmbeddingProvider,embeddingProviderVersion,defaultEmbeddingModel} from '../local-retrieval/provider.js';
import {assertLoopbackEndpoint,withRemoteNetworkGuard} from '../local-model/provider.js';

const digestValue='sha256:'+'f'.repeat(64);
const tags=()=>({models:[{name:defaultEmbeddingModel,model:defaultEmbeddingModel,digest:digestValue,size:274302450,details:{family:'nomic-bert',parameter_size:'137M',quantization_level:'F16',embedding_length:4,format:'gguf'}}]});
// The whole local embedding path is exercised over real loopback HTTP against a
// deterministic stand-in runtime, so CI never needs Ollama, weights or a GPU.
async function fakeRuntime({dimension=4,handler=null}={}){
 const calls=[];
 const server=createServer((request,response)=>{
  const chunks=[];
  request.on('data',chunk=>chunks.push(chunk));
  request.on('end',()=>{
   const send=value=>{response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(value));};
   if(request.url==='/api/version')return send({version:'fixture-runtime/1'});
   if(request.url==='/api/tags')return send(tags());
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   calls.push(body);
   if(handler)return handler({body,send,calls});
   send({model:body.model,embeddings:body.input.map((text,index)=>Array.from({length:dimension},(_,position)=>Number((((text.length+index+position)%7)/7)))),prompt_eval_count:body.input.length*3,total_duration:2000000});
  });
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const {port}=server.address();
 return {endpoint:'http://127.0.0.1:'+port,calls,close:()=>new Promise(done=>server.close(done))};
}
test('the embedding runtime is pinned by digest and dimension from the local runtime',async()=>{
 const runtime=await fakeRuntime();
 try{
  const provider=localEmbeddingProvider({endpoint:runtime.endpoint});
  assert.equal(provider.metadata.kind,'real');
  assert.equal(provider.metadata.provider,'ollama');
  assert.equal(provider.metadata.embeddingVersion,embeddingProviderVersion);
  const info=await provider.preflight();
  assert.equal(info.modelDigest,digestValue);
  assert.equal(info.dimension,4);
  assert.equal(provider.metadata.modelVersion,digestValue);
  const vectors=await provider.embedMany(['alpha','beta']);
  assert.equal(vectors.length,2);
  assert.equal(vectors[0].length,4);
  assert.equal(provider.receipts.at(-1).status,'completed');
  assert.equal(provider.receipts.at(-1).promptEvalCount,6);
 }finally{await runtime.close();}
});
test('batches are bounded and preserve input order',async()=>{
 const runtime=await fakeRuntime();
 try{
  const provider=localEmbeddingProvider({endpoint:runtime.endpoint,batchSize:3});
  await provider.preflight();
  const vectors=await provider.embedMany(['a','bb','ccc','dddd','eeeee','ffffff','ggggggg']);
  assert.equal(runtime.calls.length,3);
  assert.deepEqual(runtime.calls.map(call=>call.input.length),[3,3,1]);
  assert.deepEqual(vectors.map(vector=>Math.round(vector[0]*7)),[1,3,5,4,6,1,0]);
 }finally{await runtime.close();}
});
test('an unavailable runtime fails loudly and never falls back to a remote embedder',async()=>{
 await assert.rejects(localEmbeddingProvider({endpoint:'http://127.0.0.1:1'}).preflight(),/LOCAL_EMBEDDING_UNAVAILABLE/);
 await assert.rejects(localEmbeddingProvider({endpoint:'http://127.0.0.1:1'}).embedMany(['x']),/PROVIDER_NETWORK_ERROR/);
});
test('a non loopback endpoint is refused before any socket is opened',()=>{
 for(const remote of ['http://example.com:11434','https://api.openai.com','http://192.168.1.20:11434'])
  assert.throws(()=>localEmbeddingProvider({endpoint:remote}),/LOCAL_ENDPOINT_NOT_LOOPBACK|LOCAL_ENDPOINT_INVALID/,remote);
 assert.throws(()=>configuredEmbeddingProvider({env:{FC_LOCAL_ENDPOINT:'https://api.cohere.ai'}}),/LOCAL_ENDPOINT_NOT_LOOPBACK/);
 assert.equal(assertLoopbackEndpoint('http://127.0.0.1:11434'),'http://127.0.0.1:11434');
});
test('malformed or inconsistent embedding outputs are rejected',async()=>{
 const bad=await fakeRuntime({handler:({body,send})=>send({model:body.model,embeddings:[[1,2]],prompt_eval_count:1})});
 try{
  const provider=localEmbeddingProvider({endpoint:bad.endpoint});
  await provider.preflight();
  await assert.rejects(provider.embedMany(['alpha']),/EMBEDDING_OUTPUT_INVALID|EMBEDDING_DIMENSION_DRIFT/);
  assert.equal(provider.receipts.at(-1).status,'provider_error');
 }finally{await bad.close();}
});
test('a hung runtime is bounded by an explicit timeout',async()=>{
 const hung=await fakeRuntime({handler:()=>{}});
 try{
  const provider=localEmbeddingProvider({endpoint:hung.endpoint,timeoutMs:50});
  await assert.rejects(provider.embedMany(['alpha']),/PROVIDER_TIMEOUT/);
 }finally{await hung.close();}
});
test('a remote network guard blocks any non loopback call during embedding',async()=>{
 const runtime=await fakeRuntime();
 try{
  const provider=localEmbeddingProvider({endpoint:runtime.endpoint});
  await provider.preflight();
  await withRemoteNetworkGuard(async guard=>{
   await provider.embedMany(['alpha']);
   await assert.rejects(globalThis.fetch('https://api.deepseek.com/v1/embeddings'),/REMOTE_NETWORK_FORBIDDEN/);
   assert.ok(guard.blocked().length>=1);
  });
 }finally{await runtime.close();}
});
test('provider validation refuses a synchronous-only or incomplete provider',()=>{
 assert.throws(()=>validateEmbeddingProvider({metadata:{kind:'real',provider:'x',model:'m',modelVersion:'d',embeddingVersion:'v',dimension:3}}),/Invalid embedding provider interface/);
 assert.throws(()=>validateEmbeddingProvider({embedMany:async()=>[],metadata:{kind:'real',provider:'x',model:'m',modelVersion:'d',embeddingVersion:'v',dimension:null}}),/Invalid embedding provider metadata\/interface/);
});
