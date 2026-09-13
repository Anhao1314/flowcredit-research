import { DatabaseSync } from 'node:sqlite';
import { digest } from '../src/identity.js';
import { instant } from '../memory/time.js';
// Capability boundary: no Memory instance, append method, SQL mutation or writer.
export function lookupAccepted(filename,subjectId,{asOf}={}) {
  const at=instant(asOf,{query:true}),db=new DatabaseSync(filename,{readOnly:true});
  try {
    if(db.prepare('PRAGMA user_version').get().user_version!==2)throw new Error('Expected v0.2 Memory database');
    db.exec('BEGIN');
    const rows=db.prepare("SELECT kind,payload,content_hash,created_at FROM records WHERE subject_id=? AND kind IN ('source','evidence','revision','correction') ORDER BY id").all(subjectId).map(row=>{
      const payload=JSON.parse(row.payload);if(digest(payload)!==row.content_hash)throw new Error('Corrupt accepted Memory record');return {...row,payload};
    }).filter(row=>row.created_at<=at && (!row.payload.effectiveAt || row.payload.effectiveAt<=at));
    const claims=new Map();for(const row of rows.filter(row=>row.kind==='revision'))if(!claims.has(row.payload.claimId) || claims.get(row.payload.claimId).version<row.payload.version)claims.set(row.payload.claimId,row.payload);
    db.exec('COMMIT');return {subjectId,asOf:at,timeMode:'audit',sources:rows.filter(row=>row.kind==='source').map(row=>row.payload),corrections:rows.filter(row=>row.kind==='correction').map(row=>row.payload),acceptedEvidence:rows.filter(row=>row.kind==='evidence').map(row=>row.payload),claims:[...claims.values()].sort((a,b)=>a.claimId.localeCompare(b.claimId))};
  }finally{db.close();}
}
