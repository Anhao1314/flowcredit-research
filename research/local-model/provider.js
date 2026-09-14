import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {digest} from '../src/identity.js';

export const localProviderVersion='local-provider/v0.10';
export const defaultEndpoint='http://127.0.0.1:11434';
export const defaultModel='qwen3.5:9b';
export const defaultContextLength=8192;
export const loopbackHosts=['127.0.0.1','::1','localhost'];
// Every loopback call carries a deadline even when the caller passes no signal:
// an unanswered request must never leave a run waiting forever.
export const probeTimeoutMs=30000;
export const warmUpTimeoutMs=300000;
export const callTimeoutMs=300000;

// Loopback-only enforcement. LocalProvider may only ever talk to the machine's
// own inference runtime; any other host is rejected before a socket is opened.
export function assertLoopbackEndpoint(value){
 let url;
 try{url=new URL(String(value));}catch{throw new Error('LOCAL_ENDPOINT_INVALID');}
 if(!['http:','https:'].includes(url.protocol))throw new Error('LOCAL_ENDPOINT_INVALID');
 if(url.username||url.password||url.search||url.hash)throw new Error('LOCAL_ENDPOINT_INVALID');
 const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 if(!loopbackHosts.includes(host))throw new Error('LOCAL_ENDPOINT_NOT_LOOPBACK');
 const port=url.port||(url.protocol==='https:'?'443':'80');
 return url.protocol+'//'+(host==='::1'?'[::1]':host)+':'+port;
}
export function isLoopbackTarget(value){
 try{const host=new URL(String(value)).hostname.replace(/^\[|\]$/g,'').toLowerCase();return loopbackHosts.includes(host);}catch{return false;}
}
// Explicit no-remote policy for the offline operation test and the guarded real
// run. The guard covers every network path this benchmark code uses: the local
// transport below, and global fetch for anything else.
const networkPolicy={remoteForbidden:false};
const guardState={active:false,blocked:[]};
export function installRemoteNetworkGuard(){
 if(guardState.active)throw new Error('Network guard already installed');
 networkPolicy.remoteForbidden=true;guardState.active=true;guardState.blocked.length=0;
 const originalFetch=globalThis.fetch;
 if(typeof originalFetch==='function'){
  globalThis.fetch=async (input,...rest)=>{
   const target=typeof input==='string'||input instanceof URL?String(input):input?.url;
   if(!isLoopbackTarget(target)){guardState.blocked.push('fetch:'+String(target).slice(0,120));throw new Error('REMOTE_NETWORK_FORBIDDEN');}
   return originalFetch(input,...rest);
  };
 }
 return {blocked:()=>[...guardState.blocked],uninstall(){networkPolicy.remoteForbidden=false;guardState.active=false;if(typeof originalFetch==='function')globalThis.fetch=originalFetch;}};
}
export async function withRemoteNetworkGuard(fn){
 const guard=installRemoteNetworkGuard();
 try{return await fn(guard);}finally{guard.uninstall();}
}

// Minimal JSON transport for the loopback runtime. Errors use PROVIDER_* codes so
// the analyst layer passes them through unchanged.
export function requestJson(target,{method='POST',body=null,signal=null}={}){
 return new Promise((done,reject)=>{
  let settled=false;const settle=(fn,value)=>{if(!settled){settled=true;fn(value);}};
  let url;
  try{url=new URL(String(target));}catch{settle(reject,new Error('PROVIDER_ENDPOINT_INVALID'));return;}
  if(!isLoopbackTarget(target)){settle(reject,new Error('REMOTE_NETWORK_FORBIDDEN'));return;}
  const send=url.protocol==='https:'?httpsRequest:httpRequest;
  const payload=body===null?null:Buffer.from(JSON.stringify(body));
  const request=send(url,{method,headers:payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}},response=>{
   let size=0,parts=[];
   response.on('data',chunk=>{size+=chunk.length;if(size>2000000){request.destroy();settle(reject,new Error('PROVIDER_RESPONSE_OVERSIZED'));}else parts.push(chunk);});
   response.on('end',()=>{
    let envelope=null;
    try{envelope=JSON.parse(Buffer.concat(parts).toString('utf8'));}
    catch{settle(reject,new Error('PROVIDER_ENVELOPE_INVALID'));return;}
    if(response.statusCode!==200){const error=new Error('PROVIDER_HTTP_'+response.statusCode);error.code=error.message;settle(reject,error);return;}
    if(envelope&&typeof envelope==='object'&&typeof envelope.error==='string'){const error=new Error('PROVIDER_RUNTIME_ERROR');error.code=error.message;error.detail=envelope.error.slice(0,300);settle(reject,error);return;}
    settle(done,envelope);
   });
   response.on('error',()=>settle(reject,new Error('PROVIDER_NETWORK_ERROR')));
  });
  request.on('error',()=>settle(reject,new Error(signal?.aborted?'PROVIDER_ABORTED':'PROVIDER_NETWORK_ERROR')));
  if(signal)signal.addEventListener('abort',()=>{request.destroy();settle(reject,new Error('PROVIDER_ABORTED'));},{once:true});
  if(payload)request.write(payload);
  request.end();
 });
}
export async function probeRuntime({endpoint,transport=requestJson,signal}={}){
 const base=assertLoopbackEndpoint(endpoint);
 const version=await transport(base+'/api/version',{method:'GET',signal});
 const tags=await transport(base+'/api/tags',{method:'GET',signal});
 if(typeof version?.version!=='string'||!Array.isArray(tags?.models))throw new Error('LOCAL_RUNTIME_INVALID');
 return {runtimeName:'ollama',runtimeVersion:version.version,models:tags.models};
}
export function modelEntryFor(models,model){
 return models.find(entry=>entry?.name===model||entry?.model===model)??null;
}
export function providerMetadataOf({model,modelVersion,temperature,contextLength,think,format,endpointOrigin,modelInfo,runtimeName,runtimeVersion}){
 return {kind:'real',provider:'ollama',model,modelVersion,temperature,contextLength,think,structuredOutputMode:format==='schema'?'ollama_json_schema':'ollama_json_text',endpointOrigin,runtime:{name:runtimeName,version:runtimeVersion},modelInfo:modelInfo??null};
}
export function ollamaProvider({endpoint=defaultEndpoint,model=defaultModel,modelVersion='runtime-unreported',temperature=0,contextLength=defaultContextLength,think=false,format='schema',maxOutputTokens=2048,transport=requestJson,digestValue=null}={}){
 const base=assertLoopbackEndpoint(endpoint);
 if(!Number.isInteger(contextLength)||contextLength<1024||contextLength>131072)throw new Error('LOCAL_CONTEXT_INVALID');
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>32768)throw new Error('LOCAL_OUTPUT_BOUND_INVALID');
 if(!['schema','json'].includes(format))throw new Error('LOCAL_FORMAT_INVALID');
 if(typeof model!=='string'||!model.trim())throw new Error('LOCAL_MODEL_REQUIRED');
 const receipts=[];
 let metadata=providerMetadataOf({model,modelVersion,temperature,contextLength,think,format,endpointOrigin:base,modelInfo:null,runtimeName:'ollama',runtimeVersion:null});
 return {metadata,receipts,
  async preflight({signal}={}){
   let probe;
   try{probe=await probeRuntime({endpoint:base,transport,signal:signal??AbortSignal.timeout(probeTimeoutMs)});}
   catch{throw new Error('LOCAL_MODEL_UNAVAILABLE');}
   const entry=modelEntryFor(probe.models,model);
   if(!entry||typeof entry.digest!=='string'||!entry.digest)throw new Error('LOCAL_MODEL_UNAVAILABLE');
   metadata.modelVersion=entry.digest;
   metadata.runtime={name:probe.runtimeName,version:probe.runtimeVersion};
   metadata.modelInfo={size:entry.size??null,family:entry.details?.family??null,parameterSize:entry.details?.parameter_size??null,quantization:entry.details?.quantization_level??null,contextLength:entry.details?.context_length??null,format:entry.details?.format??null};
   return {runtimeVersion:probe.runtimeVersion,modelDigest:entry.digest,modelInfo:metadata.modelInfo,contextLength,think,format};
  },
  async warmUp({signal}={}){
   const started=performance.now();
   const envelope=await transport(base+'/api/chat',{method:'POST',signal:signal??AbortSignal.timeout(warmUpTimeoutMs),body:{model,messages:[{role:'user',content:'Reply with the single word READY.'}],stream:false,keep_alive:'30m',think:false,options:{temperature:0,num_ctx:contextLength,num_predict:8}}});
   const loadMs=Number.isFinite(envelope?.load_duration)?Math.round(envelope.load_duration/1e6):null;
   return {coldStartMs:Math.round(performance.now()-started),loadMs,keepAlive:'30m'};
  },
  async analyzeEvidence(input,{signal}={}){
   const started=performance.now();
   const payload={model,messages:[{role:'system',content:input.instructions},{role:'user',content:JSON.stringify({outputSchema:input.outputSchema,data:input.data})}],stream:false,keep_alive:'30m',think:Boolean(think),options:{temperature,num_ctx:contextLength,num_predict:maxOutputTokens}};
   if(format==='schema')payload.format=input.outputSchema;
   else payload.format='json';
   let envelope;
   try{envelope=await transport(base+'/api/chat',{method:'POST',body:payload,signal:signal??AbortSignal.timeout(callTimeoutMs)});}
   catch(error){receipts.push({status:'provider_error',latencyMs:performance.now()-started,errorCode:/^(?:PROVIDER_[A-Z0-9_]+|REMOTE_NETWORK_FORBIDDEN)$/.test(error.code??error.message)?(error.code??error.message):'PROVIDER_ERROR'});throw new Error(receipts.at(-1).errorCode);}
   const content=envelope?.message?.content;
   const usage={inputTokens:Number.isFinite(envelope?.prompt_eval_count)?envelope.prompt_eval_count:null,outputTokens:Number.isFinite(envelope?.eval_count)?envelope.eval_count:null,totalTokens:Number.isFinite(envelope?.prompt_eval_count)&&Number.isFinite(envelope?.eval_count)?envelope.prompt_eval_count+envelope.eval_count:null};
   const timings={loadMs:Number.isFinite(envelope?.load_duration)?Math.round(envelope.load_duration/1e6):null,promptEvalMs:Number.isFinite(envelope?.prompt_eval_duration)?Math.round(envelope.prompt_eval_duration/1e6):null,evalMs:Number.isFinite(envelope?.eval_duration)?Math.round(envelope.eval_duration/1e6):null,totalMs:Number.isFinite(envelope?.total_duration)?Math.round(envelope.total_duration/1e6):null};
   const tokensPerSecond=Number.isFinite(envelope?.eval_count)&&Number.isFinite(envelope?.eval_duration)&&envelope.eval_duration>0?envelope.eval_count/(envelope.eval_duration/1e9):null;
   receipts.push({status:envelope?.done===true?'completed':'incomplete',latencyMs:performance.now()-started,usage,timings,tokensPerSecond,model:envelope?.model??model,modelVersion:metadata.modelVersion,doneReason:envelope?.done_reason??null,rawResponseHash:digest(envelope?.message?.content??'')});
   if(typeof content!=='string'||!content.trim())throw new Error('PROVIDER_OUTPUT_INVALID');
   return content;
  },
  describe(){return {endpoint:base,model,modelVersion:metadata.modelVersion,contextLength,think,format,receipts:receipts.length};}};
}
export function configuredLocalProvider({env=process.env}={}){
 const endpoint=env.FC_LOCAL_ENDPOINT??defaultEndpoint;
 const model=env.FC_LOCAL_MODEL??defaultModel;
 const modelVersion=env.FC_LOCAL_MODEL_VERSION??'runtime-unreported';
 const contextLength=env.FC_LOCAL_CTX?Number(env.FC_LOCAL_CTX):defaultContextLength;
 const think=env.FC_LOCAL_THINK==='true';
 const format=env.FC_LOCAL_FORMAT??'schema';
 let base;
 try{base=assertLoopbackEndpoint(endpoint);}
 catch(error){throw new Error('LOCAL_MODEL_UNAVAILABLE: '+error.message);}
 return ollamaProvider({endpoint:base,model,modelVersion,contextLength,think,format});
}
