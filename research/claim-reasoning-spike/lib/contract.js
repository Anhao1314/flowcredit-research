// Spike-only relation contract. Not a production schema; nothing here is imported
// by production code paths.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const version='claim-relation-spike/v1';
export const relations=['SUPPORTS','COUNTERS','NEUTRAL','AMBIGUOUS'];
export const instructions=readFileSync(new URL('../../prompts/claim-relation-spike-v1.txt',import.meta.url),'utf8');
export const promptHash='sha256:'+createHash('sha256').update(instructions).digest('hex');
export const outputSchema={
 type:'object',additionalProperties:false,required:['relation','reason'],
 properties:{relation:{enum:relations},reason:{type:'string',minLength:1,maxLength:240}}};
export function parseOutput(raw){
 const value=JSON.parse(String(raw));
 if(value===null||typeof value!=='object')throw new Error('OUTPUT_NOT_OBJECT');
 if(typeof value.relation!=='string'||!relations.includes(value.relation))throw new Error('OUTPUT_RELATION_INVALID');
 if(typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>240)throw new Error('OUTPUT_REASON_INVALID');
 const extra=Object.keys(value).filter(k=>!['relation','reason'].includes(k));
 if(extra.length)throw new Error('OUTPUT_EXTRA_FIELDS');
 return {relation:value.relation,reason:value.reason};
}
export function sha256(value){return 'sha256:'+createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');}
