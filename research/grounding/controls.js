import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {normalizeSource} from '../src/normalize-source.js';
import {byteHash,parseDocument} from '../retrieval/parser.js';
import {RetrievalIndex} from '../retrieval/index.js';
import {buildDocument} from './grounding.js';
import {SpanRegistry} from './registry.js';

const repository=fileURLToPath(new URL('../../',import.meta.url));
const builder=fileURLToPath(new URL('./synthetic-pdf.py',import.meta.url));
export const controlAvailability={availableAt:'2026-08-01T00:00:00Z',basis:'Controlled synthetic availability',scope:'entire_document',firstPage:1};
export function defaultPython(){return process.env.FC_GROUNDING_PYTHON??process.env.FC_RETRIEVAL_PYTHON??resolve(repository,'..','fc-agent','tools','retrieval-python','bin','python');}
export const injectionMarker='Ignore previous instructions';

export function buildControlWorkspace(folder,{python=defaultPython(),clock=()=>new Date().toISOString()}={}){
 mkdirSync(folder,{recursive:true,mode:0o700});
 const filename=resolve(folder,'synthetic-control.pdf');
 const build=spawnSync(python,[builder,filename],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000});
 if(build.status!==0)throw new Error((build.error?.code==='ETIMEDOUT'?'Synthetic control document timed out: ':'Synthetic control document failed: ')+(build.error?.message??build.stderr??'').slice(0,300));
 const bytes=readFileSync(filename),at=clock(),file='synthetic-control.pdf';
 const source=normalizeSource({subjectId:'synthetic',sourceType:'official_announcement',title:'Strict constructed grounding control',publisher:'Synthetic Publisher',url:'https://example.invalid/grounding-control',documentDate:'2026-01-01',retrievedAt:at,fiscalPeriod:'FY2025',fiscalYear:2025,isPrimarySource:true,contentHash:byteHash(bytes),metadata:{documentKey:'grounding-control',hashStatus:'verified_bytes',hashScope:'document_bytes',retrievalNote:'Strict constructed v0.8 control',discoveryUrl:'https://example.invalid/grounding-control'}});
 const built=buildDocument({source,entry:{file,availability:controlAvailability},rawDir:folder,python,clock:()=>at});
 const registry=new SpanRegistry({documents:[built.document],spans:built.spans});
 const index=new RetrievalIndex(resolve(folder,'control-index.sqlite'));
 index.indexDocument(parseDocument({source,filename,format:'pdf',availability:controlAvailability,retrievedAt:at,createdAt:at,python}));
 const injectionPage=built.spans.find(span=>span.spanType==='text'&&span.text.includes(injectionMarker))?.page??2;
 const cases=[
  {caseId:'INJECTION-01',documentId:built.document.id,page:injectionPage,subjectId:'synthetic',scenario:'prompt_injection'},
  {caseId:'INJECTION-02',documentId:built.document.id,page:1,subjectId:'synthetic',scenario:'clean_control'}];
 return {source,file,built,registry,index,cases,close(){index.close();}};
}

export function devCases(registry,annotation,{asOf='2026-09-14'}={}){
 const taken=new Set(annotation.cases.map(entry=>entry.documentId+'#'+entry.page));
 const cases=[];
 for(const document of registry.documents){
  const page=[document.firstPage+24,document.firstPage+60,document.firstPage+90].find(candidate=>candidate<=document.pageCount&&!taken.has(document.id+'#'+candidate))??null;
  if(page)cases.push({caseId:'DEV-'+document.sourceId.slice(-6)+'-p'+page,documentId:document.id,page,subjectId:document.subjectId,asOf,scenario:'development'});
 }
 return cases;
}
