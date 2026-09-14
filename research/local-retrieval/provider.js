import {digest} from '../src/identity.js';
import {assertLoopbackEndpoint,probeRuntime,modelEntryFor,requestJson,defaultEndpoint} from '../local-model/provider.js';

// Local embedding runtime adapter. It reuses the v0.10 loopback Ollama transport,
// so the same no-remote/ no-silent-cloud-fallback policy applies: a non loopback
// endpoint is rejected before a socket is opened and an unavailable runtime fails
// loudly instead of degrading to a cloud embedding API.
export const embeddingProviderVersion='local-embedding-provider/v1';
export const defaultEmbeddingModel='nomic-embed-text';
export const embeddingBatchSize=32;
export const embeddingCallTimeoutMs=120000;
export const embeddingProbeTimeoutMs=30000;
export const maxEmbeddingTextChars=8000;

export function validateEmbeddingProvider(provider){
 const metadata=provider?.metadata;
 if(typeof provider?.embedMany!=='function')throw new Error('Invalid embedding provider interface');
 if(!metadata||!['real','test'].includes(metadata.kind))throw new Error('Invalid embedding provider metadata/interface');
 if(['provider','model','modelVersion','embeddingVersion'].some(key=>typeof metadata[key]!=='string'||!metadata[key].trim()))throw new Error('Invalid embedding provider metadata/interface');
 if(!Number.isInteger(metadata.dimension)||metadata.dimension<1||metadata.dimension>8192)throw new Error('Invalid embedding provider metadata/interface');
 return metadata;
}
// Ollama reports the pulled tag (for example `nomic-embed-text:latest`). The
// configured name without a tag must resolve to that entry instead of failing
// the preflight, and an explicitly pinned tag always wins over the fallback.
export function embeddingModelEntryFor(models,model){
 return modelEntryFor(models,model)??modelEntryFor(models,model+':latest')??null;
}
export function embeddingProviderMetadataOf({model,modelVersion,dimension=null,kind='real',endpointOrigin}) {
 return {kind,provider:'ollama',model,modelVersion,dimension,embeddingVersion:embeddingProviderVersion,endpointOrigin,maxInputChars:maxEmbeddingTextChars,pooling:'runtime-default',normalized:true};
}
export function localEmbeddingProvider({endpoint=defaultEndpoint,model=defaultEmbeddingModel,modelVersion='runtime-unreported',dimension=null,batchSize=embeddingBatchSize,kind='real',transport=requestJson,timeoutMs=embeddingCallTimeoutMs,clock=()=>new Date().toISOString()}={}){
 const base=assertLoopbackEndpoint(endpoint);
 if(typeof model!=='string'||!model.trim())throw new Error('EMBEDDING_MODEL_REQUIRED');
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>256)throw new Error('EMBEDDING_BATCH_INVALID');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw new Error('EMBEDDING_TIMEOUT_INVALID');
 const metadata=embeddingProviderMetadataOf({model,modelVersion,dimension,kind,endpointOrigin:base});
 const receipts=[];
 const embedBatch=async (texts,{signal}={})=>{
  if(!texts.length)return [];
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  if(signal)signal.addEventListener('abort',()=>controller.abort(),{once:true});
  const started=performance.now();
  try{
   const envelope=await transport(base+'/api/embed',{method:'POST',body:{model,input:texts,truncate:true,keep_alive:'30m'},signal:controller.signal});
   const vectors=envelope?.embeddings;
   if(!Array.isArray(vectors)||vectors.length!==texts.length||vectors.some(vector=>!Array.isArray(vector)||!vector.length||vector.some(value=>!Number.isFinite(value))))throw new Error('EMBEDDING_OUTPUT_INVALID');
   const size=vectors[0].length;
   if(vectors.some(vector=>vector.length!==size))throw new Error('EMBEDDING_DIMENSION_INCONSISTENT');
   if(metadata.dimension===null)metadata.dimension=size;
   if(metadata.dimension!==size)throw new Error('EMBEDDING_DIMENSION_DRIFT');
   receipts.push({status:'completed',latencyMs:performance.now()-started,count:texts.length,dimension:size,promptEvalCount:Number.isFinite(envelope?.prompt_eval_count)?envelope.prompt_eval_count:null,loadMs:Number.isFinite(envelope?.load_duration)?Math.round(envelope.load_duration/1e6):null,totalMs:Number.isFinite(envelope?.total_duration)?Math.round(envelope.total_duration/1e6):null,vectorHash:digest(vectors),createdAt:clock()});
   return vectors;
  }catch(error){
   const code=/^(?:PROVIDER_[A-Z_]+|EMBEDDING_[A-Z_]+|REMOTE_NETWORK_FORBIDDEN)$/.test(error.code??error.message)?(error.code??error.message):'PROVIDER_ERROR';
   receipts.push({status:'provider_error',latencyMs:performance.now()-started,errorCode:controller.signal.aborted?'PROVIDER_TIMEOUT':code,createdAt:clock()});
   throw new Error(receipts.at(-1).errorCode);
  }finally{clearTimeout(timer);}
 };
 const provider={metadata,receipts,
  async preflight({signal}={}){
   let probe;
   try{probe=await probeRuntime({endpoint:base,transport,signal:signal??AbortSignal.timeout(embeddingProbeTimeoutMs)});}
   catch{throw new Error('LOCAL_EMBEDDING_UNAVAILABLE');}
   const entry=embeddingModelEntryFor(probe.models,model);
   if(!entry||typeof entry.digest!=='string'||!entry.digest)throw new Error('LOCAL_EMBEDDING_UNAVAILABLE');
   metadata.modelVersion=entry.digest;
   metadata.runtime={name:probe.runtimeName,version:probe.runtimeVersion};
   metadata.modelInfo={size:entry.size??null,family:entry.details?.family??null,parameterSize:entry.details?.parameter_size??null,quantization:entry.details?.quantization_level??null,embeddingLength:entry.details?.embedding_length??null,format:entry.details?.format??null};
   if(Number.isInteger(entry.details?.embedding_length))metadata.dimension=entry.details.embedding_length;
   return {runtimeVersion:probe.runtimeVersion,modelDigest:entry.digest,modelInfo:metadata.modelInfo,dimension:metadata.dimension};
  },
  async embedMany(texts,{signal,onBatch=null}={}){
   if(!Array.isArray(texts))throw new Error('EMBEDDING_INPUT_INVALID');
   const list=texts.map(text=>{if(typeof text!=='string'||!text.trim())throw new Error('EMBEDDING_INPUT_INVALID');return text.slice(0,maxEmbeddingTextChars);});
   const vectors=[];
   for(let start=0;start<list.length;start+=batchSize){
    const started=performance.now();
    vectors.push(...await embedBatch(list.slice(start,start+batchSize),{signal}));
    onBatch?.({done:Math.min(start+batchSize,list.length),total:list.length,batch:Math.floor(start/batchSize)+1,batches:Math.ceil(list.length/batchSize),elapsedMs:performance.now()-started});
   }
   return vectors;
  },
  describe(){return {endpoint:base,model,modelVersion:metadata.modelVersion,dimension:metadata.dimension,batches:receipts.length};}};
 return provider;
}
export function configuredEmbeddingProvider({env=process.env,transport=requestJson}={}){
 const endpoint=env.FC_LOCAL_ENDPOINT??defaultEndpoint;
 const model=env.FC_EMBEDDING_MODEL??defaultEmbeddingModel;
 const modelVersion=env.FC_EMBEDDING_MODEL_VERSION??'runtime-unreported';
 const dimension=env.FC_EMBEDDING_DIM?Number(env.FC_EMBEDDING_DIM):null;
 return localEmbeddingProvider({endpoint,model,modelVersion,dimension,transport});
}
