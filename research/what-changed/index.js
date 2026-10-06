// Pairwise What Changed preview.
//
// This layer intentionally stops before Impact and Claim revision. It surfaces
// directional RelationReceipts as review candidates. Humans retain authority.
import {createHash} from 'node:crypto';
import {deepFreeze} from '../claim-relation/contract.js';
import {evaluateRelation} from '../relation-runtime/runtime.js';

export const CANDIDATE_VERSION='flowcredit.what_changed_candidate/dev-v0.1';

function stableId(value){
 return 'WC-'+createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20);
}

export function buildPair(item){
 if(!item||typeof item!=='object')throw new Error('WHAT_CHANGED_PAIR_INVALID');
 for(const key of ['evidenceId','claimId','claimRevisionId','asOf','claimStatement','evidenceStatement']){
  if(typeof item[key]!=='string'||!item[key].trim())throw new Error('WHAT_CHANGED_PAIR_MISSING_'+key);
 }
 const relationInput=deepFreeze({
  evidence:{evidenceId:item.evidenceId},
  claim:{claimId:item.claimId,revisionId:item.claimRevisionId},
  asOf:item.asOf,
  evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},
  claimSide:{semantics:{state:'NOT_MATERIALIZED'}}
 });
 const material=deepFreeze({
  evidenceId:item.evidenceId,
  claimId:item.claimId,
  revisionId:item.claimRevisionId,
  asOf:item.asOf,
  subjectId:item.subjectId??null,
  claim:{statement:item.claimStatement},
  evidence:{statement:item.evidenceStatement}
 });
 return {relationInput,material};
}

export function candidateFromReceipt(receipt,material){
 if(receipt.processingStatus!=='RESOLVED')return null;
 if(!['SUPPORTS','COUNTERS'].includes(receipt.relation))return null;
 const core={
  relationReceiptId:receipt.receiptId,
  evidenceId:receipt.evidenceId,
  claimId:receipt.claimId,
  claimRevisionId:receipt.claimRevisionId,
  asOf:receipt.asOf,
  subjectId:material.subjectId??null,
  relation:receipt.relation,
  claimStatement:material.claim.statement,
  evidenceStatement:material.evidence.statement,
  state:'PENDING_HUMAN_REVIEW',
  humanReview:{required:true,claimMutationAllowed:false}
 };
 return deepFreeze({version:CANDIDATE_VERSION,candidateId:stableId(core),...core});
}

export function runWhatChangedBatch(document){
 if(!document||typeof document!=='object'||!Array.isArray(document.pairs))throw new Error('WHAT_CHANGED_DOCUMENT_INVALID');
 const receipts=[];
 const candidates=[];
 for(const item of document.pairs){
  const {relationInput,material}=buildPair(item);
  const receipt=evaluateRelation({relationInput,material,evaluatedAt:item.evaluatedAt??item.asOf});
  receipts.push(receipt);
  const candidate=candidateFromReceipt(receipt,material);
  if(candidate)candidates.push(candidate);
 }
 const counts={
  pairs:receipts.length,
  resolved:receipts.filter(item=>item.processingStatus==='RESOLVED').length,
  abstained:receipts.filter(item=>item.processingStatus==='ABSTAINED').length,
  notEvaluated:receipts.filter(item=>item.processingStatus==='NOT_EVALUATED').length,
  errors:receipts.filter(item=>item.processingStatus==='ERROR').length,
  candidates:candidates.length
 };
 return deepFreeze({
  version:'flowcredit.what_changed_batch/dev-v0.1',
  sourceVersion:document.version??null,
  counts,
  receipts,
  candidates
 });
}
