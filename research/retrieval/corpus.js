import { readJson } from '../src/schema.js';
import { normalizeSources } from '../src/normalize-source.js';
import { parseDocument } from './parser.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const corpus=readJson(new URL('./corpus.json',import.meta.url));
export const defaultRaw=resolve(fileURLToPath(new URL('../../',import.meta.url)),'..','fc-agent','research-retrieval','raw');
export function indexCoreweave(index,{rawDir=process.env.FC_RETRIEVAL_RAW??defaultRaw,clock=()=>new Date().toISOString(),python}={}) {
  const sources=normalizeSources(readJson(new URL('../fixtures/coreweave/sources.json',import.meta.url)));
  const results=[];
  for(const entry of corpus.documents) {
    const source=sources.find(s=>s.metadata.documentKey===entry.sourceKey),now=clock();
    const document=parseDocument({source,filename:resolve(rawDir,entry.file),format:entry.format,availability:entry.availability,retrievedAt:now,createdAt:now,python});
    results.push(index.indexDocument(document));
  }
  return {subjectId:'coreweave',results,counts:index.counts(),excluded:corpus.excluded};
}
