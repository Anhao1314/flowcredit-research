import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeSource} from '../src/normalize-source.js';
import {parseDocument,byteHash} from '../retrieval/parser.js';
import {RetrievalIndex} from '../retrieval/index.js';
import {ProposalStore} from '../analyst/store.js';
import {EvidenceAnalyst} from '../analyst/layer.js';
import {testProvider} from '../analyst/contract.js';
export const now='2026-09-13T12:00:00.000Z';
export const quote='Revenue for the year ended December 31, 2025 was $32 million.';
export function proposal(chunk,changes={}){return {subjectId:chunk.subjectId,sourceIds:[chunk.sourceId],chunkIds:[chunk.id],statement:quote,quotedText:quote,researchField:'revenue',category:'revenue',metric:'consolidated_revenue',scope:'consolidated_company',factType:'explicit',rawValue:32,proposedNormalizedValue:32000000,rawUnit:'USD_millions',unit:'USD',normalization:'usd_millions_to_usd',observedAt:'2025-12-31',periodStart:'2025-01-01',periodEnd:'2025-12-31',periodStatus:'known',periodBasis:'quote',...changes};}
export async function fixture(fn){
 const folder=mkdtempSync(join(tmpdir(),'fc-analyst-')),index=new RetrievalIndex(join(folder,'index.sqlite')),store=new ProposalStore(join(folder,'proposals.sqlite'));
 const add=(key,text=quote,{subjectId='synthetic',availableAt='2026-06-01T00:00:00.000Z',isPrimarySource=true}={})=>{
  const html='<p>'+text+'</p>',filename=join(folder,key+'.html');writeFileSync(filename,html);
  const source=normalizeSource({subjectId,sourceType:'official_announcement',title:'Synthetic '+key,publisher:'Synthetic Publisher',url:'https://example.invalid/'+key,documentDate:'2026-01-01',retrievedAt:now,fiscalPeriod:'FY2025',fiscalYear:2025,isPrimarySource,contentHash:byteHash(Buffer.from(html)),metadata:{documentKey:key,hashStatus:'verified_bytes',hashScope:'document_bytes',retrievalNote:'Synthetic test only',discoveryUrl:'https://example.invalid/'}});
  const document=parseDocument({source,filename,format:'html',availability:{availableAt,basis:'Controlled synthetic availability',scope:'entire_document',firstPage:1},retrievedAt:now,createdAt:now});index.indexDocument(document);return {document,chunk:index.list('chunk').find(c=>c.documentId===document.id),filename};
 };
 const past=add('past'),future=add('future','Future revenue for December 31, 2025 was $999 million.',{availableAt:'2026-08-01T00:00:00.000Z'}),other=add('other',quote,{subjectId:'other'});
 const analyst=(output=[proposal(past.chunk)],options={})=>new EvidenceAnalyst(index,store,{provider:testProvider(typeof output==='function'?output:output),clock:()=>now,...options});
 try{return await fn({folder,index,store,add,past,future,other,analyst});}finally{store.close();index.close();rmSync(folder,{recursive:true,force:true});}
}
export const replay={subjectId:'synthetic',asOf:'2026-07-01',timeMode:'replay'};
