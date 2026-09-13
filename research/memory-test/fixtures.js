import { normalizeSource } from '../src/normalize-source.js';
import { extractEvidence } from '../src/extract-evidence.js';
import { stableId } from '../src/identity.js';
// Entirely synthetic: no CoreWeave metrics or real corporate publications.
export const times={initial:'2026-01-02T12:00:00Z',counter:'2026-02-02T12:00:00Z',correction:'2026-03-02T12:00:00Z',stale:'2027-03-02T12:00:00Z'};
export function source(subjectId='synthetic-research') {
  return normalizeSource({subjectId,sourceType:'official_announcement',title:'Synthetic memory test document',publisher:'Synthetic Fixture Publisher',url:'https://example.invalid/memory-fixture',documentDate:'2026-01-01',retrievedAt:times.initial,fiscalPeriod:'synthetic',fiscalYear:2025,isPrimarySource:true,contentHash:null,
    metadata:{documentKey:`synthetic-${subjectId}`,hashStatus:'unavailable',hashScope:'document_bytes',retrievalNote:'Synthetic test only; not a real publication or issuer fact.',discoveryUrl:'https://example.invalid/'}});
}
export function evidence(s,{rawValue=32,rawUnit='USD',normalization='identity',label='original synthetic unit extraction',createdAt=times.initial}={}) {
  return extractEvidence([s],[{sourceKey:s.metadata.documentKey,researchField:'revenue',category:'revenue',metric:'synthetic_revenue',scope:'consolidated_company',statement:label,rawValue,rawUnit,unit:'USD',normalization,section:'Synthetic fixture',page:null,location:`Synthetic test ${label}`,periodStart:'2025-10-01',periodEnd:'2025-12-31',observedAt:'2025-12-31',confidence:0.9}],createdAt)[0];
}
export function claim(e,{subjectId=e.subjectId}={}) {
  return {id:stableId('CLAIM',{subjectId,logicalKey:'synthetic-revenue-observation'}),subjectId,statement:'Synthetic research proposition for memory tests only.',category:'revenue',supportingEvidenceIds:[e.id],counterEvidenceIds:[],confidence:0.82,status:'supported',method:'Synthetic explicit manual review, no risk inference.',createdAt:times.initial,updatedAt:times.initial};
}
export function scenario(memory,setTime) {
  const s=source(),original=evidence(s),c=claim(original);
  setTime(times.initial);memory.ingest({sources:[s],evidence:[original],claims:[c]});
  setTime(times.counter);
  const counter=evidence(s,{rawValue:10,label:'synthetic counter observation',createdAt:times.counter});memory.putEvidence(counter);
  memory.reviseClaim(c.id,{status:'partially_supported',confidence:0.65,counterEvidenceIds:[counter.id]},{revisionReason:'new_counter_evidence',note:'Synthetic counter observation qualifies the original proposition.',expectedVersion:1});
  setTime(times.correction);
  const corrected=evidence(s,{rawValue:32,rawUnit:'USD_millions',normalization:'usd_millions_to_usd',label:'corrected synthetic unit extraction',createdAt:times.correction});
  const correction=memory.correctEvidence(original.id,corrected,{correctionReason:'unit_extraction_error',note:'Synthetic original extraction treated millions as USD; normalize explicitly.',claimRevisions:[{claimId:c.id,changes:{supportingEvidenceIds:[corrected.id],confidence:0.7},note:'Replace the incorrect-unit supporting fact while retaining counter evidence.'}]});
  return {subjectId:s.subjectId,claimId:c.id,originalId:original.id,counterId:counter.id,correctedId:corrected.id,correction};
}
