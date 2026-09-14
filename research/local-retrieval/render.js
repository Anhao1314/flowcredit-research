import {digest} from '../src/identity.js';

// Deterministic retrieval representation of a v0.9 SourceSupport. It carries the
// same source-exact fields the frozen prompt renderer carries, minus the identity
// line: retrieval relevance must not be influenced by span ids. The renderer is
// versioned because embedding inputs are frozen artifacts; changing it invalidates
// every stored vector.
export const spanRenderVersion='span-retrieval-render/v1';
export const tableRetrievalStatus='supported';
export function retrievalText(support){
 if(support.type==='table'){
  const lines=['TABLE: '+(support.tableTitle??'table row'),'ROW: '+(support.rowLabel||'(none)'),'COLUMN: '+support.headerPath.join(', '),'VALUE: '+support.cellText];
  if(support.unitContext)lines.push('UNIT CONTEXT: '+support.unitContext.match);
  return lines.join('\n');
 }
 if(support.type==='text')return support.text;
 throw new Error('RETRIEVAL_SUPPORT_UNSUPPORTED');
}
export function retrievalRenderHash(supports){
 return digest(supports.map(support=>[support.spanId,support.spanHash,retrievalText(support)]));
}
// Identity of one retrievable unit: source span content plus renderer version.
export function renderRecordHash(support){
 return digest({spanId:support.spanId,spanHash:support.spanHash,rendererVersion:spanRenderVersion});
}
