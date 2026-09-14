import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {digest} from '../src/identity.js';
import {resolveSelectionHandles} from '../selection-handles/handles.js';
const require=createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js');
export const promptVersion='span-ranking-handles/v1';
export const schemaVersion='ranked-handles/v1';
export const instructions=readFileSync(new URL('../prompts/span-ranking-handles-v1.txt',import.meta.url),'utf8');
export const promptHash=digest(instructions);
const baseSchema=JSON.parse(readFileSync(new URL('./ranking-output.schema.json',import.meta.url),'utf8'));
export function rankingSchema(handles){
 if(!Array.isArray(handles)||!handles.length||handles.length>8||new Set(handles).size!==handles.length||handles.some((h,i)=>h!=='S'+(i+1)))throw Error('INVALID_AVAILABLE_HANDLES');
 const schema=structuredClone(baseSchema);schema.properties.rankedHandles.items.enum=[...handles];return schema;
}
export function parseRanking(raw,handles){
 let value;try{value=JSON.parse(raw);}catch{throw Error('PARSER_ERROR');}
 const validate=new Ajv({strict:true,allErrors:true}).compile(rankingSchema(handles.availableHandles));
 if(!validate(value)){
  if(validate.errors.some(e=>e.keyword==='enum'||e.keyword==='uniqueItems'||(e.keyword==='type'&&/^\/rankedHandles\/\d+$/.test(e.instancePath))))throw Error('INVALID_SELECTION_HANDLE');
  throw Error('PARSER_ERROR');
 }
 return {value,resolved:resolveSelectionHandles(value.rankedHandles,handles)};
}
