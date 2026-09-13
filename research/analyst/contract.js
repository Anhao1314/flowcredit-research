import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
const require=createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats'),ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
export const outputSchema=JSON.parse(readFileSync(new URL('./output.schema.json',import.meta.url),'utf8'));
const validate=ajv.compile(outputSchema);
const proposalValidator=ajv.compile(JSON.parse(readFileSync(new URL('./proposal.schema.json',import.meta.url),'utf8')));
export function assertProposal(value){if(!proposalValidator(value))throw new Error('Proposal schema: '+ajv.errorsText(proposalValidator.errors));return value;}
export const promptVersion='evidence-analyst/v1';
export const instructions=readFileSync(new URL('../prompts/evidence-analyst-v1.txt',import.meta.url),'utf8');
export const promptHash=digest(instructions);
export function parseOutput(raw){
 if(typeof raw!=='string' || Buffer.byteLength(raw)>200000)throw new Error('Invalid/oversized structured response');
 const output=JSON.parse(raw);if(!validate(output))throw new Error('Analyst output schema: '+ajv.errorsText(validate.errors));return output;
}
export function validateProvider(provider){
 const m=provider?.metadata;
 if(typeof provider?.analyzeEvidence!=='function' || !m || !['test','real'].includes(m.kind) || ['provider','model','modelVersion'].some(k=>typeof m[k]!=='string' || !m[k].trim()) || !Number.isFinite(m.temperature) || m.temperature<0 || m.temperature>2)throw new Error('Pure Analyst provider and explicit model metadata required');
 return provider;
}
export function testProvider(responder,{model='scripted-fixture',modelVersion='v1'}={}){
 return {metadata:{kind:'test',provider:'deterministic-test',model,modelVersion,temperature:0},async analyzeEvidence(input){return typeof responder==='function'?responder(input):JSON.stringify(responder);}};
}
