import {prepareContext} from './context.js';
import {developmentCases,seedCase,expectedOutput} from './fixtures.js';
import {proposeRevision} from './layer.js';
import {ProposalStore} from './store.js';
import {digest} from '../src/identity.js';
export const testModel={kind:'test',provider:'scripted-offline',model:'deterministic-fixture',modelVersion:'v1',temperature:0,contextLength:8192,think:false};
export async function runDevelopment(){
 const rows=[];
 for(const d of developmentCases()){
  const f=seedCase(d),store=new ProposalStore(':memory:',{reader:f.reader,allowSystemTest:true,clock:()=>f.request.createdAt});
  try{const before=f.reader.snapshot(),context=prepareContext(f.reader,f.request),answer=expectedOutput(d,context);let calls=0;
   const provider={metadata:testModel,async analyzeEvidence(input){calls++;if(JSON.stringify(input.data).includes(f.request.claimId))throw Error('ID_LEAK');return JSON.stringify(answer);}};
   const r=await proposeRevision({reader:f.reader,provider,store,request:f.request});
   const repeat=await proposeRevision({reader:f.reader,provider,store,request:{...f.request,createdAt:'2026-03-03T12:00:00.000Z'}});
   if(calls!==1||!repeat.validation.idempotent||r.proposal.impact!==d.impact||store.state(r.proposal.proposalId).state!=='pending')throw Error('DEV_PROPOSAL');
   const review=store.review(r.proposal.proposalId,{decision:'rejected',reviewerType:'system_test',reviewerId:'synthetic-dev-review',reason:'Retained synthetic negative example.',expectedProposalHash:digest(r.proposal)});
   if(store.state(r.proposal.proposalId).state!=='rejected'||store.history(r.proposal.proposalId).length!==1||digest(f.reader.snapshot())!==digest(before))throw Error('DEV_AUTHORITY');
   rows.push({name:d.name,impact:d.impact,valid:true,pendingBeforeReview:true,rejectionRetained:true,idempotent:true,simulatedCalls:calls,reviewId:review.id,authorityUnchanged:true});
  }finally{store.close();f.close();}
 }
 return {version:'claim-impact-development/v0.12',offline:true,realModelCalls:0,embeddingCalls:0,passed:true,cases:rows.length,rows};
}
