import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
const require=createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats'),ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
export const spanPromptVersion='evidence-span/v1',interpretationPromptVersion='fact-interpretation/v1';
export const spanInstructions=readFileSync(new URL('../prompts/evidence-span-v1.txt',import.meta.url),'utf8'),interpretationInstructions=readFileSync(new URL('../prompts/fact-interpretation-v1.txt',import.meta.url),'utf8');
export const spanPromptHash=digest(spanInstructions),interpretationPromptHash=digest(interpretationInstructions);
export const schema=name=>JSON.parse(readFileSync(new URL(name+'.schema.json',import.meta.url),'utf8'));
export const spanSchema=schema('span-output'),interpretationSchema=schema('interpretation-output');
const validators=Object.fromEntries(['span-output','interpretation-output','span-proposal','interpreted-fact'].map(n=>[n,ajv.compile(schema(n))]));
export function assertContract(name,value){if(!validators[name]?.(value))throw new Error('CONTRACT_SCHEMA_INVALID');return value;}
export function parseStructured(raw,name,{allowFence=true}={}){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>100000)throw new Error('CONTRACT_SCHEMA_INVALID');
 let text=raw.trim(),wrapperRemoved=false;
 if(allowFence&&text.startsWith('```')){const m=/^```json\r?\n([\s\S]*)\r?\n```$/.exec(text);if(!m||m[1].includes('```'))throw new Error('CONTRACT_SCHEMA_INVALID');text=m[1];wrapperRemoved=true;}
 let value;try{value=JSON.parse(text);}catch{throw new Error('CONTRACT_SCHEMA_INVALID');}
 return {value:assertContract(name,value),wrapperRemoved,rawHash:digest(raw),normalizedHash:digest(text)};
}
