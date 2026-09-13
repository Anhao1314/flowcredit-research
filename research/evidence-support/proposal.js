import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {digest,stableId} from '../src/identity.js';
import {validationVersionV2,validatorV2Hash} from './validator.js';
const require=createRequire(new URL('../../agent/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats'),ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
export const proposalSchema=JSON.parse(readFileSync(new URL('./proposal-v2.schema.json',import.meta.url),'utf8'));
const validate=ajv.compile(proposalSchema);
export function assertProposalV2(value){if(!validate(value))throw new Error('Proposal v2 schema: '+ajv.errorsText(validate.errors));return value;}
export function valueFromParse(numeric){
 return numeric.status==='known'?{rawValue:numeric.numericValue,normalizedValue:numeric.normalizedValue,rawUnit:numeric.rawUnit,unit:numeric.unit,normalization:numeric.normalization}:null;
}
export function periodFromParse(period){
 return period.status==='known'?{start:period.start,end:period.end,observedAt:period.observedAt,basis:period.basis}:null;
}
export function buildProposalV2({support,fact,validated,provenance,createdAt,outputHash,inputHash}){
 const payload={proposalVersion:'evidence-proposal/v2',subjectId:support.subjectId,category:fact.metricOrCategory,metric:fact.metric,scope:'consolidated_company',support,fact:{actualOrGuidance:fact.actualOrGuidance,explicitOrDerived:fact.explicitOrDerived},rawValueText:support.type==='table'?null:(fact.rawValueText??null),rawUnitText:support.type==='table'?null:(fact.rawUnitText??null),periodText:support.type==='table'?null:(fact.periodText??null),value:valueFromParse(validated.parse.numeric),period:periodFromParse(validated.parse.period),provenance,inputHash,outputHash,rawResponseHash:outputHash,createdAt,validation:{status:validated.status,findings:validated.findings,version:validationVersionV2}};
 return assertProposalV2({id:stableId('EPROP',payload),...payload});
}
export function proposalFactV2(proposal){
 return {subjectId:proposal.subjectId,category:proposal.category,metric:proposal.metric,scope:proposal.scope,value:proposal.value,period:proposal.period,supportType:proposal.support.type};
}
export function provenanceOf(metadata,{parserVersion,groundingVersion,segmentationVersion=null,selection,interpretation}){
 return {supportContractVersion:'source-support/v1',validationVersion:validationVersionV2,validatorHash:validatorV2Hash,parserVersion,groundingVersion,segmentationVersion,modelProvider:metadata.provider,modelName:metadata.model,modelVersion:metadata.modelVersion,providerKind:metadata.kind,temperature:metadata.temperature,selectionPromptVersion:selection.version,selectionPromptHash:selection.hash,interpretationPromptVersion:interpretation.version,interpretationPromptHash:interpretation.hash};
}
