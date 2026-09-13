import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeSource } from '../src/normalize-source.js';
import { parseDocument,byteHash } from '../retrieval/parser.js';
import { RetrievalIndex } from '../retrieval/index.js';
import { RetrievalLayer } from '../retrieval/layer.js';
export const now='2026-09-13T12:00:00Z';
export function fixture(fn,{provider=null}={}) {
  const folder=mkdtempSync(join(tmpdir(),'fc-retrieval-')),index=new RetrievalIndex(join(folder,'index.sqlite'));
  const add=(key,text,{subjectId='synthetic',availableAt='2026-06-01T00:00:00Z'}={})=>{
    const filename=join(folder,key+'.html');writeFileSync(filename,text);
    const source=normalizeSource({subjectId,sourceType:'official_announcement',title:'Synthetic retrieval fixture '+key,publisher:'Synthetic Publisher',url:'https://example.invalid/'+key,documentDate:'2026-01-01',retrievedAt:now,fiscalPeriod:'synthetic',fiscalYear:2026,isPrimarySource:true,contentHash:byteHash(Buffer.from(text)),metadata:{documentKey:key,hashStatus:'verified_bytes',hashScope:'document_bytes',retrievalNote:'Synthetic test only',discoveryUrl:'https://example.invalid/'}});
    const document=parseDocument({source,filename,format:'html',availability:{availableAt,basis:availableAt?'Synthetic controlled time':'unknown',scope:'entire_document',firstPage:1},retrievedAt:now,createdAt:now});
    index.indexDocument(document);return document;
  };
  const a=add('past','<h1>Revenue</h1><p>Customer concentration revenue cash flow 100.</p>');
  const b=add('future','<h1>Future revenue</h1><p>Customer concentration revenue cash flow 999 future.</p>',{availableAt:'2026-08-01T00:00:00Z'});
  const other=add('other','<p>Customer concentration revenue cash flow 777.</p>',{subjectId:'other'});
  const layer=new RetrievalLayer(index,{provider,clock:()=>now});
  try{return fn({folder,index,layer,add,a,b,other});}finally{index.close();rmSync(folder,{recursive:true,force:true});}
}
export const replay={subjectId:'synthetic',asOf:'2026-07-01',timeMode:'replay'};
