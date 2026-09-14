import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {digest,stableId} from '../src/identity.js';
import {categories,concepts} from './domain.js';
import {interpretationSchema as frozenFactSchema} from '../evidence-support/schemas.js';
const require=createRequire(new URL('../../agent/package.json',import.meta.url)),Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats');
const ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
export const intentVersion='research-intent/v1',interpretationVersion='target-bound-interpretation/v1',sidecarVersion='candidate-intent-sidecar/v1',promptVersion='target-bound-interpretation/v1';
const date={type:'string',format:'date'},nullableDate={anyOf:[date,{type:'null'}]};
export const intentSchema={type:'object',additionalProperties:false,required:['intentId','intentVersion','subjectId','targetKind','targetCategory','targetMetricOrConcept','timeScope','dimension','actualOrGuidance','explicitOrDerived','createdAt'],properties:{intentId:{type:'string',pattern:'^INTENT-[a-f0-9]{24}$'},intentVersion:{const:intentVersion},subjectId:{type:'string',minLength:1,maxLength:80},targetKind:{enum:['financial_fact','quantitative_risk_disclosure']},targetCategory:{enum:categories},targetMetricOrConcept:{enum:concepts},timeScope:{type:'object',additionalProperties:false,required:['kind','start','end'],properties:{kind:{enum:['period','as_of']},start:nullableDate,end:date}},dimension:{type:'object',additionalProperties:false,required:['kind','value'],properties:{kind:{enum:['none','geography','customer_label']},value:{anyOf:[{type:'string',minLength:1,maxLength:80},{type:'null'}]}}},actualOrGuidance:{enum:['actual','guidance','risk_disclosure','other']},explicitOrDerived:{enum:['explicit','derived']},createdAt:{type:'string',format:'date-time'}}};
const validateIntent=ajv.compile(intentSchema);
export function assertIntent(intent){
 if(!validateIntent(intent)||intent.timeScope.kind==='period'&&!intent.timeScope.start||intent.timeScope.kind==='as_of'&&intent.timeScope.start!==null||intent.timeScope.start&&intent.timeScope.start>intent.timeScope.end||intent.dimension.kind==='none'&&intent.dimension.value!==null||intent.dimension.kind!=='none'&&intent.dimension.value===null)throw Error('RESEARCH_INTENT_INVALID');
 return intent;
}
export function createIntent(request,{createdAt=new Date().toISOString()}={}){
 const payload={intentVersion,createdAt,...request};return assertIntent({...payload,intentId:stableId('INTENT',payload)});
}
const factSchema=structuredClone(frozenFactSchema);delete factSchema.$id;delete factSchema.$schema;factSchema.properties.metric={enum:concepts};
export const boundSchema={oneOf:[{type:'object',additionalProperties:false,required:['targetMatch','fact'],properties:{targetMatch:{const:'supported'},fact:factSchema}},{type:'object',additionalProperties:false,required:['targetMatch','fact'],properties:{targetMatch:{enum:['not_supported','ambiguous']},fact:{type:'null'}}}]};
const validateBound=ajv.compile(boundSchema);
export function parseBound(raw){let value;try{if(typeof raw!=='string'||Buffer.byteLength(raw)>100000)throw Error();value=JSON.parse(raw);}catch{throw Error('INTERPRETATION_ERROR');}if(!validateBound(value))throw Error('INTERPRETATION_ERROR');return value;}
export const sidecarSchema={type:'object',additionalProperties:false,required:['id','version','candidateId','supportCandidateId','proposalId','intentId','intentVersion','intentHash','targetMatch','sourceSupportId','sourceSupportHash','rankUsed'],properties:{id:{type:'string'},version:{const:sidecarVersion},candidateId:{type:'string'},supportCandidateId:{type:'string'},proposalId:{type:'string'},intentId:intentSchema.properties.intentId,intentVersion:{const:intentVersion},intentHash:{type:'string'},targetMatch:{const:'supported'},sourceSupportId:{type:'string'},sourceSupportHash:{type:'string'},rankUsed:{type:'integer',minimum:1,maximum:3}}};
const validateSidecar=ajv.compile(sidecarSchema);
export function createSidecar({candidate,intent,support,rank}){assertIntent(intent);const value={version:sidecarVersion,candidateId:candidate.candidateId,supportCandidateId:candidate.supportCandidateId,proposalId:candidate.proposalId,intentId:intent.intentId,intentVersion,intentHash:digest(intent),targetMatch:'supported',sourceSupportId:support.spanId,sourceSupportHash:support.supportHash,rankUsed:rank},sidecar={id:stableId('INTENTBIND',value),...value};if(!validateSidecar(sidecar))throw Error('INTENT_SIDECAR_INVALID');return sidecar;}
export const instructions=readFileSync(new URL('../prompts/target-bound-interpretation-v1.txt',import.meta.url),'utf8');
export const promptHash=digest(instructions);
