import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeSource} from '../src/normalize-source.js';
import {parseDocument,byteHash} from '../retrieval/parser.js';
import {RetrievalIndex} from '../retrieval/index.js';
import {RetrievalLayer} from '../retrieval/layer.js';
import {openMemory} from '../memory/open.js';
import {AdmissionLayer,candidateHash} from '../admission/layer.js';
import {stableId} from '../src/identity.js';
import {readOnlyMemory} from './reader.js';
export const auditAsOf='2026-03-01T12:00:00.000Z',proposalTime='2026-03-02T12:00:00.000Z';
const initial='2026-01-02T12:00:00.000Z',newTime='2026-02-02T12:00:00.000Z';
// Independent synthetic propositions. No CoreWeave/locked acquisition values or labels.
export function developmentCases(){return [
 {name:'confirm',impact:'confirm',claim:'The disclosed November revenue exceeded 20 USD.',old:'November revenue was 29 USD.',fresh:['The finalized November revenue was 29 USD.']},
 {name:'strengthen',impact:'strengthen',status:'partially_supported',claim:'The November revenue exceeded 20 USD.',old:'The preliminary estimate suggests November revenue may exceed 20 USD.',fresh:['The finalized November revenue was 29 USD.']},
 {name:'weaken',impact:'weaken',claim:'Revenue expansion remains broadly sustained across the business.',old:'Revenue rose in every business segment in November.',fresh:['In January, one small segment contracted while the larger segments continued expanding.']},
 {name:'contradict',impact:'contradict',claim:'The disclosed November revenue exceeded 20 USD.',old:'November revenue was 29 USD.',fresh:['A second direct disclosure reports November revenue of 12 USD.']},
 {name:'no-effect',impact:'no_material_effect',claim:'The disclosed November revenue exceeded 20 USD.',old:'November revenue was 29 USD.',fresh:['The revenue reporting team moved to a different office.']},
 {name:'insufficient',impact:'insufficient_evidence',claim:'The disclosed November revenue exceeded 20 USD.',old:'November revenue was 29 USD.',fresh:['A qualitative note describes revenue as substantial without providing an amount or period.']},
 {name:'conflicting',impact:'contradict',reason:'conflicting_evidence',claim:'The disclosed November revenue exceeded 20 USD.',old:'November revenue was 29 USD.',fresh:['A direct disclosure reports November revenue of 31 USD.','A separate direct disclosure reports November revenue of 12 USD.'],relations:['supports','counters']},
 {name:'latest-period',impact:'contradict',reason:'period_update',claim:'The latest disclosed monthly revenue exceeds 20 USD.',old:'November revenue was 29 USD.',fresh:['The latest January revenue was 12 USD.'],periodUpdate:true},
 {name:'correction',impact:'contradict',reason:'source_correction',claim:'The disclosed November revenue exceeded 20 USD.',old:'November revenue was 29 USD.',fresh:['Correction: November revenue was 12 USD, replacing the earlier 29 USD disclosure.'],correction:true}
 ];}
export function lockedCases(){
 // Called only after development and prompt/schema/code freeze. A separate, fixed held-out set.
 const a=[
 ['confirm','The published December receipts were greater than 45 USD.','December receipts were 58 USD.','The final December receipts were 58 USD.'],
 ['strengthen','December receipts were greater than 45 USD.','An incomplete preliminary note estimates December receipts above 45 USD.','The final December receipts were 58 USD.'],
 ['weaken','Receipts expansion is broadly maintained across the company.','All operating divisions reported rising receipts in December.','In February, a smaller division declined, although the major divisions still grew.'],
 ['contradict','Published December receipts were greater than 45 USD.','December receipts were 58 USD.','A new direct filing reports December receipts of 33 USD.'],
 ['no_material_effect','Published December receipts were greater than 45 USD.','December receipts were 58 USD.','The receipts reporting department changed its office address.'],
 ['insufficient_evidence','Published December receipts were greater than 45 USD.','December receipts were 58 USD.','Receipts are described favorably, but no amount or reporting period is given.']
 ];
 const rows=[];
 for(let round=0;round<3;round++)for(const [impact,claim,old,fresh] of a){
  const noun=['receipts','service revenue','subscription revenue'][round];
  const replace=s=>s.replaceAll('receipts',noun).replaceAll('Receipts',noun[0].toUpperCase()+noun.slice(1)).replaceAll('45',String(45+round*7)).replaceAll('58',String(58+round*7)).replaceAll('33',String(33+round*7));
  rows.push({name:`LOCK-${String(rows.length+1).padStart(2,'0')}`,impact,claim:replace(claim),old:replace(old),fresh:[replace(fresh)],status:impact==='strengthen'?'partially_supported':'supported'});
 }
 const conflict=rows[9];conflict.fresh.unshift('A separate finalized statement reports service revenue of 65 USD for December.');conflict.relations=['supports','counters'];conflict.reason='conflicting_evidence';
 const period=rows[15];period.claim='The latest disclosed monthly subscription revenue exceeds 59 USD.';period.fresh=['The newest January subscription revenue was 47 USD.'];period.reason='period_update';period.periodUpdate=true;
 const correction=rows[3];correction.fresh=['Correction: December receipts were 33 USD, replacing the earlier 58 USD disclosure.'];correction.reason='source_correction';correction.correction=true;
 return rows;
}
export function expectedOutput(descriptor,context){
 const impact=descriptor.impact;
 const status=['confirm','no_material_effect','insufficient_evidence'].includes(impact)?context.base.claim.status:impact==='strengthen'?'supported':impact==='weaken'?'partially_supported':descriptor.correction?'unverified':'disputed';
 const relation=impact==='confirm'||impact==='strengthen'?'supports':impact==='weaken'||impact==='contradict'?'counters':impact==='no_material_effect'?'context':'unclear';
 return {claimHandle:'C1',baseRevisionHandle:'R1',impact,suggestedStatus:status,suggestedConfidenceDirection:impact==='strengthen'?'increase':['weaken','contradict'].includes(impact)?'decrease':'unchanged',reasonCode:descriptor.reason??(impact==='confirm'||impact==='strengthen'?'new_supporting_evidence':impact==='weaken'||impact==='contradict'?'new_counter_evidence':impact==='no_material_effect'?'no_relevant_change':'insufficient_support'),attributions:context.data.evidence.filter(e=>e.isNew).map((e,i)=>({evidenceHandle:e.handle,relation:descriptor.relations?.[i]??relation,quote:e.statement}))};
}
export function seedCase(descriptor,{folder=null}={}){
 const temporary=!folder;folder??=mkdtempSync(join(tmpdir(),'fc-claim-proposal-'));
 let time=initial;const clock=()=>time,index=new RetrievalIndex(join(folder,'index.sqlite')),memory=openMemory({filename:join(folder,'memory.sqlite'),clock}),admission=new AdmissionLayer(index,memory,{clock,allowSystemTest:true}),layer=new RetrievalLayer(index,{clock});
 const subjectId='synthetic-claim-impact';
 function accept(text,key,{periodUpdate=false}={}){
  const html='<p>'+text+'</p>',filename=join(folder,key+'.html');writeFileSync(filename,html);
  const source=normalizeSource({subjectId,sourceType:'official_announcement',title:'Synthetic impact '+key,publisher:'Synthetic Publisher',url:'https://example.invalid/claim-impact/'+key,documentDate:time.slice(0,10),retrievedAt:time,fiscalPeriod:'synthetic',fiscalYear:2025,isPrimarySource:true,contentHash:byteHash(Buffer.from(html)),metadata:{documentKey:descriptor.name+'-'+key,hashStatus:'verified_bytes',hashScope:'document_bytes',retrievalNote:'Synthetic controlled fixture; not actual issuer evidence.',discoveryUrl:'https://example.invalid/'}});
  const doc=parseDocument({source,filename,format:'html',availability:{availableAt:time,basis:'Synthetic explicit public time',scope:'entire_document',firstPage:1},retrievedAt:time,createdAt:time});index.indexDocument(doc);
  const chunk=index.list('chunk').find(c=>c.documentId===doc.id),candidate=layer.createCandidate(chunk.id,{subjectId,asOf:time,timeMode:'audit',mode:'lexical',query:text,quotedText:text});
  const rawNumber=text.match(/\b\d+\b/)?.[0];
  const fact={researchField:'revenue',category:'revenue',metric:'synthetic_revenue',scope:'consolidated_company',rawValue:rawNumber?Number(rawNumber):text,rawUnit:rawNumber?'USD':'quoted_text',unit:rawNumber?'USD':'quoted_text',normalization:'identity',periodStart:null,periodEnd:periodUpdate?'2026-01-31':text.includes('November')?'2025-11-30':'2025-12-31',observedAt:periodUpdate?'2026-01-31':text.includes('November')?'2025-11-30':'2025-12-31',confidence:0.9};
  return admission.acceptCandidate(candidate.id,{candidateHash:candidateHash(index.get('candidate',candidate.id)),subjectId,reviewerType:'system_test',reviewerId:'synthetic-impact-seed',reasonCode:'verified_primary_source',note:'Controlled synthetic acceptance; not a human review.',fact}).evidenceId;
 }
 try{
  const oldId=accept(descriptor.old,'old');
  const c={id:stableId('CLAIM',{subjectId,name:descriptor.name}),subjectId,statement:descriptor.claim,category:'revenue',supportingEvidenceIds:[oldId],counterEvidenceIds:[],confidence:descriptor.status==='partially_supported'?0.5:0.8,status:descriptor.status??'supported',method:'Explicit synthetic proposition for controlled knowledge-state impact tests; no financial recommendation.',createdAt:time,updatedAt:time};
  const base=memory.createClaim(c);time=newTime;
  const newIds=descriptor.fresh.map((s,i)=>accept(s,'new-'+i,{periodUpdate:descriptor.periodUpdate}));
  if(descriptor.correction){
   // Memory corrections require the same source/subject/metric. Fixture source differs:
   // preserve truthful source lineage by creating the correction on the old source.
   const replacement=memory.getEvidence(newIds[0]).evidence;
   const {extractEvidence}=fixtureDependencies;
   const oldSource=memory.getEvidence(oldId).source.source;
   const corrected=extractEvidence([oldSource],[{sourceKey:oldSource.metadata.documentKey,researchField:'revenue',category:'revenue',metric:'synthetic_revenue',scope:'consolidated_company',statement:descriptor.fresh[0],rawValue:replacement.rawValue,rawUnit:replacement.rawUnit,unit:replacement.unit,normalization:'identity',section:'Synthetic correction',page:null,location:'Synthetic correction replacement',periodStart:null,periodEnd:memory.getEvidence(oldId).evidence.periodEnd,observedAt:memory.getEvidence(oldId).evidence.observedAt,confidence:0.9}],time)[0];
   // Correction provenance is separate. The newly accepted disclosure explains that the
   // old source was corrected; the formal replacement itself lacks admission and is context only.
   memory.correctEvidence(oldId,corrected,{correctionReason:'value_extraction_error',note:'Explicit synthetic correction; new accepted disclosure retained separately.'});
  }
  const request={claimId:c.id,baseRevisionId:base.id,newEvidenceIds:newIds,asOf:auditAsOf,timeMode:'audit',createdAt:proposalTime};
  const before=memory.counts();memory.close();index.close();
  const reader=readOnlyMemory(join(folder,'memory.sqlite'));
  return {folder,reader,request,before,descriptor,close(){reader.close();if(temporary)rmSync(folder,{recursive:true,force:true});}};
 }catch(e){memory.close();index.close();if(temporary)rmSync(folder,{recursive:true,force:true});throw e;}
}
import {extractEvidence} from '../src/extract-evidence.js';
const fixtureDependencies={extractEvidence};
