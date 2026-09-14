import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {digest} from '../src/identity.js';

const require=createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats');

export const selectionHandleVersion='selection-handles/v1';
export const selectionHandlesPromptVersion='span-selection/v3';
export const selectionHandlesInstructions=readFileSync(new URL('../prompts/span-selection-handles-v3.txt',import.meta.url),'utf8');
export const selectionHandlesPromptHash=digest(selectionHandlesInstructions);
export const selectionHandlesBaseSchema=JSON.parse(readFileSync(new URL('./selection-output-handles.schema.json',import.meta.url),'utf8'));
export const handlePattern=/^S[1-9][0-9]{0,2}$/;

// Handles are invocation-local labels for a frozen candidate order. They are not
// identity: the same span is S1 on one page and S7 on another, and nothing
// outside the invocation may persist them as a source reference.
export function handleAt(rank){return 'S'+rank;}

export function buildSelectionHandles(spanIds){
 if(!Array.isArray(spanIds)||!spanIds.length)throw new Error('Selection handles require a non-empty candidate set');
 const seen=new Set(),entries=[];
 for(const [position,spanId] of spanIds.entries()){
  if(typeof spanId!=='string'||!spanId)throw new Error('Selection handles require canonical span ids');
  // A candidate set with a repeated canonical id has no 1:1 handle mapping, so
  // it is refused instead of quietly resolving two handles to one span.
  if(seen.has(spanId))throw new Error('DUPLICATE_CANDIDATE_SPAN');
  seen.add(spanId);
  entries.push(Object.freeze({handle:handleAt(position+1),spanId,rank:position+1}));
 }
 const map=Object.freeze(Object.fromEntries(entries.map(entry=>[entry.handle,entry.spanId])));
 return Object.freeze({version:selectionHandleVersion,entries:Object.freeze(entries),availableHandles:Object.freeze(entries.map(entry=>entry.handle)),map});
}

export function selectionHandlesSchema(handles){
 const schema=structuredClone(selectionHandlesBaseSchema);
 schema.items.properties.selectedHandles.items.enum=[...handles];
 return schema;
}

const compiled=new Map();
function validatorFor(handles){
 const key=handles.join(','),cached=compiled.get(key);
 if(cached)return cached;
 const ajv=new Ajv({strict:true,allErrors:true});
 formats(ajv);
 const validate=ajv.compile(selectionHandlesSchema(handles));
 compiled.set(key,validate);
 return validate;
}

// Exact resolution only. A handle that is not character-for-character in the
// frozen set is a program-visible error and is never approximated to a
// neighbouring candidate.
export function resolveSelectionHandles(selected,handles){
 const available=handles?.availableHandles??[],map=handles?.map??{};
 const known=new Set(available),invalid=[],resolved=[],seen=new Set();
 if(!Array.isArray(selected))throw new Error('INVALID_SELECTION_HANDLE');
 for(const handle of selected){
  if(typeof handle!=='string'||!known.has(handle)){invalid.push(typeof handle==='string'?handle:JSON.stringify(handle));continue;}
  if(seen.has(handle))throw new Error('DUPLICATE_SELECTION_HANDLE');
  seen.add(handle);
  resolved.push({handle,spanId:map[handle]});
 }
 if(invalid.length){const error=new Error('INVALID_SELECTION_HANDLE');error.invalid=[...new Set(invalid)];throw error;}
 return resolved;
}

export function parseHandleSelection(raw,handles,{allowFence=true}={}){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>100000)throw new Error('CONTRACT_SCHEMA_INVALID');
 let text=raw.trim(),wrapperRemoved=false;
 if(allowFence&&text.startsWith('```')){const match=/^```json\r?\n([\s\S]*)\r?\n```$/.exec(text);if(!match||match[1].includes('```'))throw new Error('CONTRACT_SCHEMA_INVALID');text=match[1];wrapperRemoved=true;}
 let value;try{value=JSON.parse(text);}catch{throw new Error('CONTRACT_SCHEMA_INVALID');}
 const validate=validatorFor(handles.availableHandles);
 if(!validate(value)){
  // Everything the model got wrong inside the handle array is a handle error
  // (the live enum is only one of the ways to get a reference wrong); anything
  // wrong outside it stays a contract error, so a bad factKind is never reported
  // as a bad identifier.
  const errors=validate.errors??[],inHandles=error=>/^\/\d+\/selectedHandles(\/\d+)?$/.test(error.instancePath);
  if(errors.every(inHandles)&&errors.length){
   if(errors.some(error=>error.keyword==='uniqueItems'))throw new Error('DUPLICATE_SELECTION_HANDLE');
   const error=new Error('INVALID_SELECTION_HANDLE');
   error.invalid=[...new Set((value??[]).flatMap(item=>Array.isArray(item?.selectedHandles)?item.selectedHandles:[]).filter(handle=>typeof handle!=='string'||!handles.map[handle]))];
   throw error;
  }
  throw new Error('CONTRACT_SCHEMA_INVALID');
 }
 const selections=[];
 for(const item of value)for(const resolved of resolveSelectionHandles(item.selectedHandles,handles))selections.push({handle:resolved.handle,spanId:resolved.spanId,factKind:item.factKind});
 return {value,selections,wrapperRemoved,rawHash:digest(raw),normalizedHash:digest(text),handleVersion:selectionHandleVersion};
}
