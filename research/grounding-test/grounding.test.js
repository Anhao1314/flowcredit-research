import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {fixture,python,availability,now,tableSpans} from './fixtures.js';
import {buildControlWorkspace} from '../grounding/controls.js';
import {parseLayout,buildDocument} from '../grounding/grounding.js';
import {SpanRegistry,spanHash} from '../grounding/registry.js';
import {renderSpan,spanPeriodText} from '../grounding/renderer.js';
import {placeholderCell,bindingLiteral,sourceQuote,normalizeSpace} from '../grounding/facts.js';
import {parseNumeric,parsePeriod} from '../analyst-staged/parsers.js';
import {selectionCandidates} from '../grounding/layer.js';
const entry={file:'synthetic-control.pdf',availability};

test('layout parser output is byte-identical across runs',()=>fixture(({pdf})=>{
 assert.equal(JSON.stringify(parseLayout({filename:pdf})),JSON.stringify(parseLayout({filename:pdf})));
}));

test('control documents are byte-stable across independent builds',()=>fixture(({folder,built})=>{
 const second=buildControlWorkspace(join(folder,'second'),{python,clock:()=>now});
 try{
  assert.equal(second.built.document.contentHash,built.document.contentHash);
  assert.equal(second.built.document.id,built.document.id);
  assert.deepEqual(second.built.spans.map(span=>span.id),built.spans.map(span=>span.id));
 }finally{second.close();}
}));

test('span ids and hashes are stable for the same source and parser version',()=>fixture(({folder,source,built})=>{
 const again=buildDocument({source,entry,rawDir:folder,python,clock:()=>now});
 assert.equal(again.document.id,built.document.id);
 assert.deepEqual(again.spans.map(span=>span.id),built.spans.map(span=>span.id));
 assert.deepEqual(again.spans.map(span=>span.contentHash),built.spans.map(span=>span.contentHash));
 assert.equal(again.document.textHash,built.document.textHash);
 assert.ok(built.document.id.startsWith('GDOC-'));
 for(const span of built.spans)assert.ok(span.id.startsWith('SPAN-'));
}));

test('registry rejects duplicate span ids',()=>fixture(({built})=>{
 assert.throws(()=>new SpanRegistry({documents:[built.document],spans:[...built.spans,built.spans[0]]}),/Duplicate span id/);
}));

test('registry rejects spans without a grounded document',()=>fixture(({built})=>{
 const orphan={...built.spans[0],documentId:'GDOC-missing'};
 assert.throws(()=>new SpanRegistry({documents:[built.document],spans:[orphan]}),/Span without grounded document/);
}));

test('registry rejects grounding version drift',()=>fixture(({built})=>{
 const drifted={...built.spans[0],groundingVersion:'source-span-registry/v2'};
 assert.throws(()=>new SpanRegistry({documents:[built.document],spans:[drifted]}),/Grounding version drift/);
}));

test('verify detects tampered span content',()=>fixture(({built})=>{
 const original=built.spans.find(span=>span.spanType==='table'&&span.cellText==='$ 2,575');
 const tampered={...original,cellText:'$ 9,999'};
 const registry=new SpanRegistry({documents:[built.document],spans:[tampered]});
 assert.deepEqual(registry.verify(tampered.id),{valid:false,reason:'CONTENT_HASH_MISMATCH'});
}));

test('verify detects tampered document text',()=>fixture(({built})=>{
 const document={...built.document,text:built.document.text.replace('Revenue','Expenses')};
 const registry=new SpanRegistry({documents:[document],spans:built.spans});
 assert.equal(registry.verify(built.spans[0].id).reason,'SOURCE_HASH_MISMATCH');
}));

test('verify enforces page identity inside the document range',()=>fixture(({built})=>{
 const original=built.spans[0],forged={...original,page:99};
 const registry=new SpanRegistry({documents:[built.document],spans:[forged]});
 assert.equal(registry.verify(forged.id).reason,'PAGE_OUT_OF_RANGE');
 assert.deepEqual(registry.verify('SPAN-does-not-exist'),{valid:false,reason:'SPAN_UNKNOWN'});
}));

test('table row and column mapping binds every cell to its header path',()=>fixture(({registry,built})=>{
 const [revenue2025,revenue2024]=tableSpans(registry,'Revenue');
 assert.equal(revenue2025.cellText,'$ 2,575');
 assert.deepEqual(revenue2025.headerPath,['Year Ended December 31,','2025']);
 assert.equal(revenue2025.locator.type,'pdf_table_cell');
 assert.equal(revenue2025.locator.tableIndex,0);
 assert.equal(revenue2025.locator.rowIndex,0);
 assert.equal(revenue2025.locator.columnIndex,0);
 assert.equal(revenue2025.locator.rowLabel,'Revenue');
 assert.deepEqual(revenue2025.locator.columnLabel,revenue2025.headerPath);
 assert.equal(revenue2025.locator.caption,'Revenue (in millions)');
 assert.equal(revenue2024.locator.rowIndex,0);
 assert.equal(revenue2024.locator.columnIndex,1);
 for(const span of built.spans.filter(span=>span.spanType==='table'))assert.equal(registry.verify(span.id).valid,true);
}));

test('multi-period columns stay separate spans with separate periods',()=>fixture(({registry})=>{
 const [revenue2025,revenue2024]=tableSpans(registry,'Revenue');
 assert.notEqual(revenue2025.id,revenue2024.id);
 assert.equal(spanPeriodText(revenue2025),'Year Ended December 31, 2025');
 assert.equal(spanPeriodText(revenue2024),'Year Ended December 31, 2024');
 assert.equal(parsePeriod(spanPeriodText(revenue2025)).end,'2025-12-31');
 assert.equal(parsePeriod(spanPeriodText(revenue2024)).end,'2024-12-31');
 assert.notEqual(revenue2025.contentHash,revenue2024.contentHash);
}));

test('header preservation keeps every header level',()=>fixture(({registry,built})=>{
 const [revenue2025]=tableSpans(registry,'Revenue');
 assert.equal(revenue2025.locator.headerText[0],'Year Ended December 31,');
 assert.equal(revenue2025.locator.headerText[1],'2025 2024');
 assert.deepEqual(revenue2025.headerPath,['Year Ended December 31,','2025']);
}));

test('cell value fidelity is exact for every deterministic cell',()=>fixture(({registry,built})=>{
 const cells=built.spans.filter(span=>span.spanType==='table').map(span=>`${span.rowLabel}|${span.locator.columnIndex}|${span.cellText}`);
 assert.deepEqual(cells,['Revenue|0|$ 2,575','Revenue|1|$ 1,912','Cost of revenue|0|$ 1,507','Cost of revenue|1|$ 1,231','Gross profit|0|$ 1,068','Gross profit|1|*']);
}));

test('unit context fidelity binds the caption to every cell of the table',()=>fixture(({registry})=>{
 for(const span of registry.list({spanType:'table'})){
  assert.equal(span.unitContext.match,'(in millions)');
  assert.equal(span.unitContext.scale,'millions');
  assert.equal(span.unitContext.currency,'USD');
  assert.equal(span.unitContext.captionText,'Revenue (in millions)');
 }
 const [revenue2025]=tableSpans(registry,'Revenue');
 assert.equal(bindingLiteral(revenue2025),'$ 2,575 million');
 const parsed=parseNumeric(bindingLiteral(revenue2025),null,{quote:bindingLiteral(revenue2025)});
 assert.equal(parsed.status,'known');
 assert.equal(parsed.normalizedValue,2575000000);
 assert.equal(parsed.rawUnit,'USD_millions');
 assert.equal(parseNumeric('2,575',null,{quote:'2,575'}).status,'unsupported');
}));

test('placeholder cells stay grounded but are excluded from the candidate set',()=>fixture(({registry,built})=>{
 const placeholder=built.spans.find(span=>span.spanType==='table'&&span.cellText==='*');
 assert.ok(placeholderCell.test(placeholder.cellText));
 assert.equal(registry.verify(placeholder.id).valid,true);
 assert.equal(selectionCandidates(built.spans).includes(placeholder),false);
 assert.equal(selectionCandidates(built.spans).length,built.spans.length-1);
}));

test('unsupported table layouts abstain instead of guessing',()=>fixture(({registry,built})=>{
 assert.equal(built.unsupported.length,1);
 const [unsupported]=built.unsupported;
 assert.equal(unsupported.page,2);
 assert.equal(unsupported.reason,'row/column structure not deterministically recoverable');
 assert.ok(unsupported.sample.includes('Widget revenue'));
 assert.equal(registry.findSpansByPage(built.document.id,2).some(span=>span.spanType==='table'),false);
 const text=registry.findSpansByPage(built.document.id,2).filter(span=>span.spanType==='text');
 for(const span of text)assert.equal(registry.verify(span.id).valid,true);
 assert.ok(text.some(span=>span.text.includes('Widget revenue')));
 assert.ok(text.some(span=>span.text.includes('Ignore previous instructions')));
}));

test('text spans stay contiguous, addressable and hash-verified',()=>fixture(({registry,built})=>{
 const narrative=registry.list({spanType:'text'}).find(span=>span.text.includes('data center capacity'));
 assert.equal(built.document.text.slice(narrative.charStart,narrative.charEnd),narrative.text);
 assert.ok(narrative.locator.lineStart<=narrative.locator.lineEnd);
 assert.equal(registry.verify(narrative.id).valid,true);
 assert.equal(sourceQuote(built.document.text,narrative),narrative.text);
}));

test('table renderer is deterministic and traceable to the source cell',()=>fixture(({registry})=>{
 const [revenue2025]=tableSpans(registry,'Revenue');
 assert.equal(renderSpan(revenue2025),['SPAN '+revenue2025.id,'TABLE: Revenue (in millions)','ROW: Revenue','COLUMN: Year Ended December 31,, 2025','VALUE: $ 2,575','UNIT CONTEXT: (in millions)'].join('\n'));
 const narrative=registry.list({spanType:'text'})[0];
 assert.equal(renderSpan(narrative),['SPAN '+narrative.id,'TEXT: '+narrative.text].join('\n'));
}));

test('source quote keeps the contiguous row text and strips footnote markers',()=>fixture(({registry,index})=>{
 const [revenue2025]=tableSpans(registry,'Revenue');
 const chunk=index.list('chunk').find(candidate=>candidate.page===1);
 const quoted=sourceQuote(chunk.text,revenue2025);
 assert.ok(quoted.includes('Revenue'));
 assert.ok(quoted.includes('2,575'));
 assert.ok(chunk.text.includes(quoted));
 const footnote={...revenue2025,rowLabel:'Revenue (1)'};
 assert.ok(sourceQuote(chunk.text,footnote).includes('Revenue'));
}));

test('span hash is recomputable from span content',()=>fixture(({built})=>{
 for(const span of built.spans)assert.equal(spanHash(span),span.contentHash);
}));

test('non-breaking spaces do not break fidelity comparison',()=>{
 assert.equal(normalizeSpace('June\u00a030, 2026'),'June 30, 2026');
 assert.ok(normalizeSpace('As of June\u00a030, 2026').includes(normalizeSpace('June 30, 2026')));
});
