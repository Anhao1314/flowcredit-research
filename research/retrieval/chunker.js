import { digest, stableId } from '../src/identity.js';
export const chunkerVersion='page-section-lines/v1';
export const chunkPolicy={maxLength:6000,overlap:400,offsetUnit:'UTF-16 code units'};
export function chunkDocument(document) {
  if(digest(document.text)!==document.textHash)throw new Error('Parsed document text hash mismatch');
  const chunks=[];
  for(const [unitIndex,unit] of document.units.entries()) {
    if(document.text.slice(unit.charStart,unit.charEnd)!==unit.text)throw new Error('Parsed unit offset mismatch');
    let start=0;
    while(start<unit.text.length) {
      let end=Math.min(start+chunkPolicy.maxLength,unit.text.length);
      if(end<unit.text.length){const line=unit.text.lastIndexOf('\n',end);if(line>start+chunkPolicy.maxLength/2)end=line+1;}
      // Never split a surrogate pair at an arbitrary hard boundary.
      if(end<unit.text.length && /[\uD800-\uDBFF]/.test(unit.text[end-1]))end--;
      const charStart=unit.charStart+start,charEnd=unit.charStart+end,text=document.text.slice(charStart,charEnd);
      const locator={unitIndex,unitStart:start,unitEnd:end,raw:unit.rawLocator};
      const contentHash=digest(text);
      const id=stableId('CHUNK',{sourceId:document.sourceId,documentHash:document.contentHash,parserVersion:document.parserVersion,chunkerVersion,locator,charStart,charEnd,contentHash});
      if(text.trim())chunks.push({id,documentId:document.id,sourceId:document.sourceId,subjectId:document.subjectId,text,section:unit.section,page:unit.page,locator,charStart,charEnd,contentHash,documentDate:document.documentDate,availableAt:document.availableAt,retrievedAt:document.retrievedAt,createdAt:document.createdAt,parserVersion:document.parserVersion,chunkerVersion});
      if(end===unit.text.length)break;
      let next=Math.max(start+1,end-chunkPolicy.overlap);
      const line=unit.text.indexOf('\n',next);if(line>=0 && line<end)next=line+1;
      if(/[\uDC00-\uDFFF]/.test(unit.text[next]))next++;
      start=next;
    }
  }
  return chunks;
}
