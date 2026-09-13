import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
import {parseStructured} from '../analyst-staged/contract.js';
const require=createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats'),ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
export const selectionPromptVersion='span-selection/v2';
export const interpretationPromptVersion='fact-interpretation-span/v2';
export const selectionInstructions=readFileSync(new URL('../prompts/span-selection-v2.txt',import.meta.url),'utf8');
export const interpretationInstructions=readFileSync(new URL('../prompts/fact-interpretation-span-v2.txt',import.meta.url),'utf8');
export const selectionPromptHash=digest(selectionInstructions),interpretationPromptHash=digest(interpretationInstructions);
export const selectionSchema=JSON.parse(readFileSync(new URL('./selection-output.schema.json',import.meta.url),'utf8'));
const validateSelection=ajv.compile(selectionSchema);
export function parseSelection(raw,allowedSpanIds,{allowFence=true}={}){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>100000)throw new Error('CONTRACT_SCHEMA_INVALID');
 let text=raw.trim(),wrapperRemoved=false;
 if(allowFence&&text.startsWith('```')){const match=/^```json\r?\n([\s\S]*)\r?\n```$/.exec(text);if(!match||match[1].includes('```'))throw new Error('CONTRACT_SCHEMA_INVALID');text=match[1];wrapperRemoved=true;}
 let value;try{value=JSON.parse(text);}catch{throw new Error('CONTRACT_SCHEMA_INVALID');}
 if(!validateSelection(value))throw new Error('CONTRACT_SCHEMA_INVALID');
 const allowed=new Set(allowedSpanIds),fabricated=[];
 for(const item of value)for(const id of item.spanIds)if(!allowed.has(id))fabricated.push(id);
 if(fabricated.length){const error=new Error('INVALID_SPAN_REFERENCE');error.fabricated=[...new Set(fabricated)];throw error;}
 return {value,wrapperRemoved,rawHash:digest(raw),normalizedHash:digest(text)};
}
export function parseInterpretation(raw){return parseStructured(raw,'interpretation-output');}
export function validateProvider(provider){
 const metadata=provider?.metadata;
 if(typeof provider?.analyzeEvidence!=='function'||!metadata||!['test','real'].includes(metadata.kind)||['provider','model','modelVersion'].some(key=>typeof metadata[key]!=='string'||!metadata[key].trim())||!Number.isFinite(metadata.temperature))throw new Error('Pure provider and explicit model metadata required');
 return provider;
}
export function testProvider(responder,{model='scripted-support',modelVersion='v1'}={}){
 return {metadata:{kind:'test',provider:'deterministic-test',model,modelVersion,temperature:0},async analyzeEvidence(input){return typeof responder==='function'?responder(input):JSON.stringify(responder);}};
}
