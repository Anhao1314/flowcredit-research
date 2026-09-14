import {prepareContext} from './context.js';
import {instructions,outputSchema,parseOutput} from './contract.js';
import {makeProposal,validateProposal} from './validation.js';
export async function proposeRevision({reader,provider,store,request,onProgress=()=>{}}){
 const context=prepareContext(reader,request);
 const modelConfig=structuredClone(provider.metadata);
 const key=makeInputKey(context,modelConfig);
 const existing=store?.byInput(key);
 if(existing){validateProposal(existing,{...context,createdAt:existing.proposalCreatedAt});return {proposal:existing,validation:{valid:true,idempotent:true},modelCalls:0};}
 onProgress({event:'claim-impact',status:'start'});
 const raw=await provider.analyzeEvidence({instructions,outputSchema,data:context.data},{signal:AbortSignal.timeout(60000)});
 const output=parseOutput(raw),proposal=makeProposal(output,context,modelConfig),validation=validateProposal(proposal,context);
 store?.append(proposal);onProgress({event:'claim-impact',status:'pending',proposalId:proposal.proposalId});
 return {proposal,validation,modelCalls:1};
}
import {digest} from '../src/identity.js';
import {promptHash,promptVersion} from './contract.js';
export function makeInputKey(context,modelConfig){return digest({snapshot:context.snapshot,promptVersion,promptHash,modelConfig});}
