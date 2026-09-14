import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {normalizeSource} from '../src/normalize-source.js';
import {parseDocument,byteHash} from '../retrieval/parser.js';
import {RetrievalIndex} from '../retrieval/index.js';
import {buildDocument} from '../grounding/grounding.js';
import {SpanRegistry} from '../grounding/registry.js';
import {SentenceSpanIndex} from '../evidence-support/sentences.js';
import {TableIndex} from '../evidence-support/support.js';
import {defaultPython} from '../evidence-support/controls.js';
export const asOf='2028-04-01T00:00:00Z';
export function devWorkspace(){
 const folder=mkdtempSync(join(tmpdir(),'fc-target-dev-')),filename=join(folder,'dev.pdf'),python=defaultPython(),run=spawnSync(python,[fileURLToPath(new URL('./synthetic-dev.py',import.meta.url)),filename],{encoding:'utf8'});if(run.status!==0)throw Error(run.stderr);
 const source=normalizeSource({subjectId:'synthetic',sourceType:'official_announcement',title:'Independent target conversion dev',publisher:'Synthetic Publisher',url:'https://example.invalid/target-dev',documentDate:'2028-01-01',retrievedAt:asOf,fiscalPeriod:'FY2027',fiscalYear:2027,isPrimarySource:true,contentHash:byteHash(readFileSync(filename)),metadata:{documentKey:'target-dev',hashStatus:'verified_bytes',hashScope:'document_bytes',retrievalNote:'Independent synthetic fixtures',discoveryUrl:'https://example.invalid/'}}),availability={availableAt:'2028-01-01T00:00:00Z',basis:'Synthetic fixture availability',scope:'entire_document',firstPage:1},built=buildDocument({source,entry:{file:'dev.pdf',availability},rawDir:folder,python,clock:()=>asOf}),registry=new SpanRegistry({documents:[built.document],spans:built.spans}),sentences=new SentenceSpanIndex(registry),tables=new TableIndex(registry),index=new RetrievalIndex(resolve(folder,'index.sqlite'));
 index.indexDocument(parseDocument({source,filename,format:'pdf',availability,retrievedAt:asOf,createdAt:asOf,python}));
 return {folder,built,registry,sentences,tables,index,close(){index.close();}};
}
