import { digest } from '../src/identity.js';
const ranks={supported:4,partially_supported:3,disputed:2,unverified:1,stale:0};
function beliefs(revision) {
  const {createdAt,updatedAt,...claim}=revision.claim;
  return {...claim,supportingEvidenceIds:[...claim.supportingEvidenceIds].sort(),counterEvidenceIds:[...claim.counterEvidenceIds].sort()};
}
export function classifyChange(before,after) {
  for(const revision of [before,after].filter(Boolean)) if(!Object.hasOwn(ranks,revision.claim.status)) throw new Error('Unknown diff claim status');
  if(!before)return 'added';if(!after)return 'removed';
  if(digest(beliefs(before))===digest(beliefs(after)))return 'unchanged';
  if(after.claim.status==='stale' && before.claim.status!=='stale')return 'stale';
  if(after.claim.status==='disputed' && before.claim.status!=='disputed')return 'disputed';
  const delta=ranks[after.claim.status]-ranks[before.claim.status];
  if(delta>0)return 'strengthened';if(delta<0)return 'weakened';
  if(after.claim.confidence>before.claim.confidence)return 'strengthened';
  if(after.claim.confidence<before.claim.confidence)return 'weakened';
  return 'changed';
}
export function diffStates(before,after) {
  const index=rows=>{const map=new Map();for(const row of rows){if(map.has(row.claimId))throw new Error('Duplicate diff Claim identity');map.set(row.claimId,row);}return map;};
  const a=index(before),b=index(after),counts=Object.fromEntries(['added','removed','strengthened','weakened','disputed','stale','unchanged','changed'].map(name=>[name,0]));
  const changes=[...new Set([...a.keys(),...b.keys()])].sort().map(claimId=> {
    const old=a.get(claimId)??null,next=b.get(claimId)??null,classification=classifyChange(old,next);counts[classification]++;
    const refs=row=>row?[...row.claim.supportingEvidenceIds,...row.claim.counterEvidenceIds]:[];
    return {claimId,classification,before:old,after:next,revisionReason:next?.revisionReason??null,addedEvidenceIds:refs(next).filter(id=>!refs(old).includes(id)).sort(),removedEvidenceIds:refs(old).filter(id=>!refs(next).includes(id)).sort()};
  });
  return {counts,changes};
}
