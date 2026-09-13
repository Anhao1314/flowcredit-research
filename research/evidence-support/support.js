import {digest,stableId} from '../src/identity.js';
import {spanHash} from '../grounding/registry.js';
import {spanPeriodText} from '../grounding/renderer.js';
import {bindingLiteral} from '../grounding/facts.js';
import {parseNumeric,parsePeriod} from '../analyst-staged/parsers.js';

// SourceSupport union: TextSupport (exact sentence slice of a verified block)
// or TableSupport (exact cell plus its verified row/column/unit context).
// Supports are built only from verified registry spans; the model supplies ids
// and semantics, never source text.
export const supportVersion='source-support/v1';

export function tableIdOf({documentId,page,tableIndex}){
 return stableId('GTBL',{documentId,page,tableIndex});
}
export function tableIdOfSpan(span){
 return tableIdOf({documentId:span.documentId,page:span.locator.page,tableIndex:span.locator.tableIndex});
}
export class TableIndex {
 #byId;#cells;#byDocument;
 constructor(registry){
  this.#byId=new Map();this.#cells=new Map();this.#byDocument=new Map();
  for(const span of registry.list({spanType:'table'})){
   const {page,tableIndex,rowIndex,columnIndex}=span.locator,documentId=span.documentId,id=tableIdOf({documentId,page,tableIndex});
   let table=this.#byId.get(id);
   if(!table){table={id,documentId,page,tableIndex,headerText:span.locator.headerText??null,caption:span.locator.caption??null,region:span.locator.region??null,unitContext:span.unitContext??null,rowCount:0,columnCount:0,cells:new Map()};this.#byId.set(id,table);const list=this.#byDocument.get(documentId)??[];list.push(table);this.#byDocument.set(documentId,list);}
   const key=rowIndex+':'+columnIndex;
   if(table.cells.has(key))throw new Error('Duplicate table cell: '+id+' '+key);
   table.cells.set(key,span);
   table.rowCount=Math.max(table.rowCount,rowIndex+1);table.columnCount=Math.max(table.columnCount,columnIndex+1);
  }
 }
 get(id){return this.#byId.get(id)??null;}
 list({documentId=null,page=null}={}){
  const base=documentId?this.#byDocument.get(documentId)??[]:[...this.#byId.values()];
  return base.filter(table=>page===null||table.page===page);
 }
 cell(tableId,rowIndex,columnIndex){return this.#byId.get(tableId)?.cells.get(rowIndex+':'+columnIndex)??null;}
 hasRow(tableId,rowIndex){const t=this.#byId.get(tableId);return !!t&&rowIndex>=0&&rowIndex<t.rowCount;}
 hasColumn(tableId,columnIndex){const t=this.#byId.get(tableId);return !!t&&columnIndex>=0&&columnIndex<t.columnCount;}
}

function unitContextView(unitContext){
 if(!unitContext)return null;
 return {match:unitContext.match,scale:unitContext.scale,currency:unitContext.currency,captionText:unitContext.captionText};
}
export function tableSupportFromSpan(span,table){
 if(span.spanType!=='table')throw new Error('TableSupport requires a table span');
 if(table.id!==tableIdOfSpan(span))throw new Error('Table identity mismatch');
 const headerPath=[...span.headerPath];
 const support={type:'table',supportVersion,subjectId:span.subjectId,sourceId:span.sourceId,documentId:span.documentId,spanId:span.id,tableId:table.id,page:span.page,tableIndex:span.locator.tableIndex,rowIndex:span.locator.rowIndex,columnIndex:span.locator.columnIndex,rowLabel:span.rowLabel??'',columnLabel:headerPath.at(-1)??'',headerPath,cellText:span.cellText,cellHash:digest(span.cellText),unitContext:unitContextView(span.unitContext),tableTitle:table.caption,parserVersion:span.parserVersion,groundingVersion:span.groundingVersion,spanHash:span.contentHash,availableAt:span.availableAt};
 return support;
}
export function textSupportFromSpan(sentence){
 if(sentence.spanType!=='sentence')throw new Error('TextSupport requires a sentence span');
 const support={type:'text',supportVersion,subjectId:sentence.subjectId,sourceId:sentence.sourceId,documentId:sentence.documentId,spanId:sentence.id,parentSpanId:sentence.parentSpanId,page:sentence.page,section:sentence.section,text:sentence.text,textHash:digest(sentence.text),charStart:sentence.charStart,charEnd:sentence.charEnd,documentCharStart:sentence.documentCharStart,documentCharEnd:sentence.documentCharEnd,lineStart:sentence.locator.lineStart,lineEnd:sentence.locator.lineEnd,parserVersion:sentence.parserVersion,groundingVersion:sentence.groundingVersion,segmentationVersion:sentence.segmentationVersion,spanHash:sentence.contentHash,availableAt:sentence.availableAt};
 return support;
}
export function supportHash(support){
 const immutable={...support};
 delete immutable.createdAt;
 delete immutable.supportHash;
 return digest(immutable);
}
export function freezeSupport(support){
 return Object.freeze({...support,supportHash:supportHash(support)});
}

// Deterministic table fact extraction: value from cellText, unit from the
// verified unit context, period from the column label / header path. The model
// never computes or copies these.
export function parseTableValue(support){
 const literal=bindingLiteral({spanType:'table',cellText:support.cellText,unitContext:support.unitContext});
 return parseNumeric(literal,null,{quote:literal});
}
export function parseTablePeriod(support){
 const text=spanPeriodText({spanType:'table',headerPath:support.headerPath});
 if(!text)return {status:'unknown',reason:'period_missing'};
 return parsePeriod(text);
}
export function tableFactText(support){
 return {value:bindingLiteral({spanType:'table',cellText:support.cellText,unitContext:support.unitContext}),period:spanPeriodText({spanType:'table',headerPath:support.headerPath}),unit:support.unitContext?.match??null};
}
