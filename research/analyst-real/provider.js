import {request} from 'node:https';
import {readFileSync,statSync,existsSync,realpathSync} from 'node:fs';
import {resolve,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../src/identity.js';
const repository=fileURLToPath(new URL('../../',import.meta.url));
export const defaultCredential=resolve(repository,'..','fc-agent','runtime','dsh-home','.credentials.yaml');
export function readCredential({env=process.env,path=defaultCredential}={}){
 if(env.DEEPSEEK_API_KEY)return String(env.DEEPSEEK_API_KEY).trim();
 if(!existsSync(path))return null;
 const p=realpathSync(resolve(path)),rel=relative(realpathSync(repository),p);if(rel==='' || (!rel.startsWith('..'+sep) && rel!=='..' && !isAbsolute(rel)))throw new Error('Credential config must be external');
 if(statSync(p).mode&0o077)throw new Error('Credential config requires private permissions');
 const line=readFileSync(p,'utf8').match(/^\s{2}DEEPSEEK_API_KEY:\s*(.+)$/m);if(!line)return null;
 let key;try{key=JSON.parse(line[1]);}catch{throw new Error('Unsupported safe credential scalar; no YAML execution');}
 if(typeof key!=='string')throw new Error('Credential scalar must be a string');return key.trim()||null;
}
export function httpsJson(url,payload,key,{signal}={}){
 return new Promise((done,reject)=>{
  const req=request(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},signal},res=>{
   let size=0,parts=[];res.on('data',b=>{size+=b.length;if(size>1000000){req.destroy();reject(new Error('PROVIDER_RESPONSE_OVERSIZED'));}else parts.push(b);});
   res.on('end',()=>{if(res.statusCode!==200){const e=new Error('PROVIDER_HTTP_'+res.statusCode);e.code=e.message;reject(e);return;}try{done(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch{reject(new Error('PROVIDER_ENVELOPE_INVALID'));}});
   res.on('error',()=>reject(new Error('PROVIDER_NETWORK_ERROR')));
  });req.on('error',()=>reject(new Error(signal?.aborted?'PROVIDER_ABORTED':'PROVIDER_NETWORK_ERROR')));req.end(JSON.stringify(payload));
 });
}
export function responsesProvider({key,model='deepseek-v4-flash',modelVersion='provider-unreported',provider='deepseek',endpoint='https://api.deepseek.com/responses',transport=httpsJson,maxOutputTokens=8192,structuredOutputMode='native_json_schema'}={}){
 const url=new URL(endpoint);if(url.protocol!=='https:' || url.username || url.password || url.search)throw new Error('Explicit safe HTTPS endpoint required');
 if(typeof key!=='string' || !key.trim())throw new Error('REAL_MODEL_BENCHMARK_BLOCKED: credentials missing');
 if(!['native_json_schema','strict_json_text'].includes(structuredOutputMode))throw new Error('Explicit structured mode required');
 const receipts=[];
 return {metadata:{kind:'real',provider,model,modelVersion,temperature:0,structuredOutputMode,endpointOrigin:url.origin},receipts,
  async analyzeEvidence(input,{signal}={}){
   const started=performance.now(),payload={model,instructions:input.instructions,input:JSON.stringify({outputSchema:input.outputSchema,data:input.data}),text:{format:structuredOutputMode==='native_json_schema'?{type:'json_schema',name:'flowcredit_evidence_proposals',schema:input.outputSchema}:{type:'text'}},reasoning:{effort:'none'},temperature:0,max_output_tokens:maxOutputTokens,tools:[],tool_choice:'none',stream:false,store:false};
   let envelope;try{envelope=await transport(url,payload,key,{signal});}catch(error){receipts.push({status:'provider_error',latencyMs:performance.now()-started,errorCode:/^PROVIDER_[A-Z0-9_]+$/.test(error.code??error.message)?(error.code??error.message):'PROVIDER_ERROR'});throw new Error(receipts.at(-1).errorCode);}
   const output=envelope.output??[],texts=output.filter(x=>x.type==='message' && x.role==='assistant').flatMap(x=>(x.content??[]).filter(c=>c.type==='output_text').map(c=>c.text));
   const receipt={status:envelope.status,latencyMs:performance.now()-started,responseId:envelope.id??null,reportedModel:envelope.model??null,reportedFingerprint:envelope.system_fingerprint??null,usage:{inputTokens:envelope.usage?.input_tokens??null,outputTokens:envelope.usage?.output_tokens??null,totalTokens:envelope.usage?.total_tokens??null,cachedTokens:envelope.usage?.input_tokens_details?.cached_tokens??null},providerReportedCost:envelope.usage?.cost??null,rawResponseHash:digest(envelope)};receipts.push(receipt);
   if(envelope.status!=='completed' || output.some(x=>x.type!=='message') || texts.length!==1 || typeof texts[0]!=='string')throw new Error('PROVIDER_OUTPUT_INVALID');
   return texts[0];
  }};
}
export function configuredProvider({env=process.env,credentialPath,provider='deepseek'}={}){
 if(provider==='unavailable')return null;
 if(provider!=='deepseek')throw new Error('Unknown configured provider; hosts may inject any v0.5 pure provider');
 const key=readCredential({env,path:credentialPath??defaultCredential});if(!key)return null;
 return responsesProvider({key,model:env.DEEPSEEK_MODEL??env.FC_MODEL??'deepseek-v4-flash',modelVersion:env.FC_REAL_MODEL_VERSION??'provider-unreported',structuredOutputMode:env.FC_REAL_STRUCTURED_MODE??'native_json_schema'});
}
