import {createRequire} from 'node:module';
import {readJson} from '../src/schema.js';
const require=createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats'),ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
const schema=readJson(new URL('./schema.json',import.meta.url));ajv.addSchema(schema);
const validators=Object.fromEntries(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:schema.$id+'#/$defs/'+name})]));
export function assertRetrieval(name,value){const fn=validators[name];if(!fn || !fn(value))throw new Error('Retrieval '+name+' schema: '+ajv.errorsText(fn?.errors));return value;}
