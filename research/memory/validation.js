import { createRequire } from 'node:module';
import { readJson, assertSchema } from '../src/schema.js';
const require = createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'), formats=require('ajv-formats');
const ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
const validators=Object.fromEntries(['identity','revision','correction'].map(name=>[name,ajv.compile(readJson(new URL(`${name}.schema.json`,import.meta.url)))]));
export function validateMemory(name,payload) {
  if(!validators[name]) throw new Error('Unknown memory schema');
  if(!validators[name](payload)) throw new Error(`${name} schema: ${ajv.errorsText(validators[name].errors)}`);
  if(name==='revision') assertSchema('claim',payload.claim);
  return payload;
}
