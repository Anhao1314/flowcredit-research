import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { digest, stableId } from '../src/identity.js';
import { assertSchema } from '../src/schema.js';
import { normalizeSource } from '../src/normalize-source.js';
import { instant } from '../memory/time.js';
export const byteHash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
export const parserVersions={pdf:'pdf-blocks-pymupdf-1.26.5/v1',html:'html-addressable/v1'};

// Small faithful HTML tokenizer. Offsets address the original markup, entities
// decode without numeric rewriting. Nonvisible script/style/template is omitted.
function decode(text) {
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',minus:'−',trade:'™',copy:'©'};
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(all,key)=>{
    if(key[0]!=='#')return named[key]??all;
    const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    return code>0 && code<=0x10ffff?String.fromCodePoint(code):all;
  });
}
export function parseHtml(markup) {
  const tokens=markup.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+/gi);
  const units=[];let hidden=0,buffer='',start=0,end=0,section='HTML document';
  const flush=()=>{if(buffer.trim())units.push({text:buffer,page:null,section,rawLocator:{type:'html_range',rawStart:start,rawEnd:end}});buffer='';};
  for(const token of tokens) {
    const value=token[0],offset=token.index;
    if(value.startsWith('<!--') || value.startsWith('<!'))continue;
    if(value.startsWith('<')) {
      const tag=/^<\/?([a-z][\w:-]*)/i.exec(value)?.[1].toLowerCase(),closing=value.startsWith('</');
      if(['script','style','template','noscript'].includes(tag)){if(closing)hidden=Math.max(0,hidden-1);else hidden++;continue;}
      if(hidden)continue;
      if(/^h[1-6]$/.test(tag) || ['p','div','table','ul','ol','section','article'].includes(tag)) {
        if(closing){end=offset+value.length;flush();}else{flush();start=offset;}
      }
      if(tag==='tr' && closing)buffer+='\n';
      if(['td','th'].includes(tag) && closing)buffer+='\t';
      if(tag==='br')buffer+='\n';
      continue;
    }
    if(hidden)continue;
    if(!buffer)start=offset;
    buffer+=decode(value);end=offset+value.length;
    // Section metadata is addressable context, not an inserted summary.
    const previous=markup.slice(Math.max(0,offset-200),offset);
    if(/<h[1-6][^>]*>\s*$/i.test(previous))section=decode(value).trim();
  }
  flush();if(!units.length)throw new Error('No visible HTML text');return {units,pageCount:null};
}
export function parseDocument({source,filename,format,availability={availableAt:null,basis:'unknown',scope:'entire_document',firstPage:1},retrievedAt,createdAt,python=process.env.FC_RETRIEVAL_PYTHON??resolve(fileURLToPath(new URL('../../',import.meta.url)),'..','fc-agent','tools','retrieval-python','bin','python')}) {
  assertSchema('source',source);
  if(normalizeSource(source).id!==source.id)throw new Error('Source identity mismatch');
  if(!source.isPrimarySource)throw new Error('Retrieval corpus requires reviewed primary Sources');
  if(!Object.hasOwn(parserVersions,format))throw new Error('Unsupported document format');
  const bytes=readFileSync(filename),contentHash=byteHash(bytes);
  if(source.contentHash && source.contentHash!==contentHash)throw new Error('Raw Source content hash mismatch');
  const retrieval=instant(retrievedAt),creation=instant(createdAt);
  if(retrieval>creation)throw new Error('Document created before raw retrieval');
  const availableAt=availability.availableAt===null?null:instant(availability.availableAt);
  if(!availability.basis || !['entire_document','embedded_filing'].includes(availability.scope) || !Number.isInteger(availability.firstPage) || availability.firstPage<1)throw new Error('Invalid availability scope/basis');
  if(availableAt && availableAt>retrieval)throw new Error('Public availability after actual retrieval');
  let parsed;
  if(format==='html'){if(availability.firstPage!==1)throw new Error('HTML page range unsupported');parsed=parseHtml(bytes.toString('utf8'));}
  else {
    const run=spawnSync(python,[fileURLToPath(new URL('./pdf-parser.py',import.meta.url)),filename],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:30000});
    if(run.status!==0)throw new Error('PDF parser unavailable/failed: '+(run.error?.message??run.stderr).slice(0,600));
    parsed=JSON.parse(run.stdout);
  }
  if(availability.firstPage>1 && availability.scope!=='embedded_filing')throw new Error('Partial PDF scope requires embedded_filing');
  const units=[];let text='';
  for(const input of parsed.units.filter(unit=>unit.page===null || unit.page>=availability.firstPage)) {
    const charStart=text.length;text+=input.text;units.push({...input,charStart,charEnd:text.length});text+='\n\n';
  }
  if(!units.length)throw new Error('Selected document scope has no text');
  const parserVersion=parserVersions[format];
  const id=stableId('DOC',{sourceId:source.id,contentHash,parserVersion,scope:availability.scope,firstPage:availability.firstPage});
  return {id,sourceId:source.id,subjectId:source.subjectId,source,format,filename:resolve(filename),contentHash,textHash:digest(text),text,units,pageCount:parsed.pageCount,parserVersion,documentDate:source.documentDate,availableAt,availabilityBasis:availability.basis,availabilityScope:availability.scope,firstPage:availability.firstPage,retrievedAt:retrieval,createdAt:creation};
}
