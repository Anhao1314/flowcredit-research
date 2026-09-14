import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {digest} from '../src/identity.js';
const require=createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats');
const ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
export const version='claim-revision-proposal/v0.12',promptVersion='claim-impact/v0.12';
export const impacts=['confirm','strengthen','weaken','contradict','no_material_effect','insufficient_evidence'];
export const reasons=['new_supporting_evidence','new_counter_evidence','conflicting_evidence','period_update','metric_deterioration','metric_improvement','source_correction','insufficient_support','no_relevant_change'];
export const statuses=['supported','partially_supported','disputed','unverified','stale'];
const str={type:'string',minLength:1},hash={type:'string',pattern:'^sha256:[a-f0-9]{64}$'},time={type:'string',format:'date-time'};
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
export const attributionSchema=object({evidenceHandle:{type:'string',pattern:'^E[1-8]$'},relation:{enum:['supports','counters','context','unclear']},quote:{type:'string',minLength:1,maxLength:500}});
export const outputSchema=object({claimHandle:{const:'C1'},baseRevisionHandle:{const:'R1'},impact:{enum:impacts},suggestedStatus:{enum:statuses},suggestedConfidenceDirection:{enum:['increase','decrease','unchanged']},reasonCode:{enum:reasons},attributions:{type:'array',minItems:1,maxItems:8,items:attributionSchema}});
export const proposalSchema=object({proposalVersion:{const:version},proposalId:str,subjectId:str,claimId:str,baseRevisionId:str,baseRevisionHash:hash,evidenceIds:{type:'array',minItems:1,maxItems:8,uniqueItems:true,items:str},impact:{enum:impacts},suggestedStatus:{enum:statuses},suggestedConfidenceDirection:outputSchema.properties.suggestedConfidenceDirection,reasonCode:{enum:reasons},reasonSummary:{type:'string',minLength:1,maxLength:5000},attributions:{type:'array',minItems:1,maxItems:8,items:object({evidenceId:str,relation:attributionSchema.properties.relation,quote:attributionSchema.properties.quote,contextOnly:{type:'boolean'}})},modelProvider:str,modelName:str,modelConfig:{type:'object'},promptVersion:{const:promptVersion},promptHash:hash,inputHash:hash,outputHash:hash,asOf:time,timeMode:{const:'audit'},newEvidenceAvailableAt:{type:'array',minItems:1,maxItems:4,items:object({evidenceId:str,availableAt:{anyOf:[time,{type:'null'}]},knowledgeAt:time})},baseRevisionEffectiveAt:time,proposalCreatedAt:time,handleMap:{type:'object'},inputSnapshot:{type:'object'},modelOutput:outputSchema,lifecycle:{const:'pending'}});
const validators={output:ajv.compile(outputSchema),proposal:ajv.compile(proposalSchema)};
export function assertContract(kind,value){const check=validators[kind];if(!check?.(value))throw Error('SCHEMA_INVALID: '+ajv.errorsText(check?.errors));return value;}
export function parseOutput(raw){if(typeof raw!=='string'||Buffer.byteLength(raw)>30000)throw Error('SCHEMA_INVALID');let v;try{v=JSON.parse(raw);}catch{throw Error('SCHEMA_INVALID');}return assertContract('output',v);}
export const instructions=readFileSync(new URL('../prompts/claim-impact-v012.txt',import.meta.url),'utf8');
export const promptHash=digest(instructions);
