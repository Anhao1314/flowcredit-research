import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {digest,stableId} from '../src/identity.js';
import {readJson} from '../src/schema.js';
import {normalizeSources} from '../src/normalize-source.js';
import {byteHash} from '../retrieval/parser.js';
import {corpus,defaultRaw} from '../retrieval/corpus.js';

export const groundingVersion='source-span-registry/v1';
export const layoutParserVersion='pdf-layout-spans-pymupdf-1.26.5/v1';
export const unsupportedLayoutStatus='unsupported_table_layout';
const repository=fileURLToPath(new URL('../../',import.meta.url));

export function parseLayout({filename,python=process.env.FC_GROUNDING_PYTHON??process.env.FC_RETRIEVAL_PYTHON??resolve(repository,'..','fc-agent','tools','retrieval-python','bin','python')}){
 const run=spawnSync(python,[fileURLToPath(new URL('./pdfspans.py',import.meta.url)),filename],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:120000});
 if(run.status!==0)throw new Error('Grounding parser unavailable/failed: '+(run.error?.message??run.stderr).slice(0,600));
 const parsed=JSON.parse(run.stdout);
 if(parsed.parserVersion!==layoutParserVersion)throw new Error('Grounding parser version drift');
 return parsed;
}

function spanId(kind,fields){return stableId('SPAN',{kind,...fields});}
function frozen(payload){return Object.freeze({...payload});}

export function buildDocument({source,entry,rawDir=defaultRaw,python,clock=()=>new Date().toISOString()}){
 const filename=resolve(rawDir,entry.file),bytes=readFileSync(filename),contentHash=byteHash(bytes),parsed=parseLayout({filename,python});
 const firstPage=entry.availability.firstPage,createdAt=clock();
 const pages=parsed.pages.filter(page=>page.page>=firstPage),documentId=stableId('GDOC',{sourceId:source.id,contentHash,parserVersion:parsed.parserVersion,groundingVersion,scope:entry.availability.scope,firstPage});
 const spans=[],unsupported=[];
 let text='';
 for(const page of pages){
  const pageOffset=text.length;
  for(const [blockIndex,block] of page.textBlocks.entries()){
   const charStart=text.length;text+=block.text;const charEnd=text.length;text+='\n';
   const locator={type:'pdf_text_block',page:page.page,blockIndex,bbox:block.bbox,lineStart:block.lineStart,lineEnd:block.lineEnd};
   const payload={spanType:'text',subjectId:source.subjectId,sourceId:source.id,documentId,page:page.page,section:'PDF page '+page.page,locator,charStart,charEnd,text:block.text,parserVersion:parsed.parserVersion,groundingVersion,availableAt:entry.availability.availableAt,createdAt,rendererVersion:null};
   const contentHashSpan=digest({...payload,createdAt:undefined});
   spans.push(frozen({id:spanId('text',{documentId,page:page.page,blockIndex,textHash:digest(block.text)}),...payload,contentHash:contentHashSpan}));
  }
  text+='\n';
  if(pageOffset>text.length)throw new Error('Grounding text offset drift');
  for(const [tableIndex,table] of page.tables.entries()){
   if(table.status!==unsupportedLayoutStatus)continue;
   unsupported.push({documentId,sourceId:source.id,page:page.page,tableIndex,region:table.region,reason:table.reason,sample:table.sample});
  }
  for(const [tableIndex,table] of page.tables.entries()){
   if(table.status===unsupportedLayoutStatus)continue;
   const unitContext=table.caption?{match:table.caption.match,scale:table.caption.scale,currency:'USD',captionText:table.caption.text,bbox:table.caption.bbox}:null;
   for(const cell of table.cells){
    const locator={type:'pdf_table_cell',page:page.page,tableIndex,rowIndex:cell.rowIndex,columnIndex:cell.columnIndex,rowLabel:cell.rowLabel,columnLabel:cell.headerPath,headerText:table.headerText,caption:table.caption?table.caption.text:null,bbox:cell.bbox,region:table.region};
    const payload={spanType:'table',subjectId:source.subjectId,sourceId:source.id,documentId,page:page.page,section:'PDF page '+page.page,locator,cellText:cell.text,rowLabel:cell.rowLabel,headerPath:cell.headerPath,unitContext,parserVersion:parsed.parserVersion,groundingVersion,availableAt:entry.availability.availableAt,createdAt};
    const contentHashSpan=digest({...payload,createdAt:undefined});
    spans.push(frozen({id:spanId('table',{documentId,page:page.page,tableIndex,rowIndex:cell.rowIndex,columnIndex:cell.columnIndex,cellHash:digest(cell.text),header:cell.headerPath.join(' ')}) ,...payload,contentHash:contentHashSpan}));
   }
  }
 }
 const document=Object.freeze({id:documentId,subjectId:source.subjectId,sourceId:source.id,format:'pdf',file:entry.file,contentHash,parserVersion:parsed.parserVersion,groundingVersion,pageCount:parsed.pageCount,firstPage,availability:entry.availability,availableAt:entry.availability.availableAt,createdAt,textLength:text.length,textHash:digest(text),text,spanCount:spans.length});
 return {document,spans,unsupported};
}

export function buildGrounding({rawDir=defaultRaw,python,clock=()=>new Date().toISOString(),documents=corpus.documents}={}){
 const sources=normalizeSources(readJson(new URL('../fixtures/coreweave/sources.json',import.meta.url)));
 const built=[],spans=[],unsupported=[];
 for(const entry of documents){
  const source=sources.find(candidate=>candidate.metadata.documentKey===entry.sourceKey);
  if(!source)throw new Error('Grounding corpus source missing: '+entry.sourceKey);
  const result=buildDocument({source,entry,rawDir,python,clock});
  built.push(result.document);spans.push(...result.spans);unsupported.push(...result.unsupported);
 }
 return Object.freeze({subjectId:corpus.subjectId,version:groundingVersion,documents:built,spans,unsupported});
}
