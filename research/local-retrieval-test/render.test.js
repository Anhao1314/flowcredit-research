import test from 'node:test';
import assert from 'node:assert/strict';
import {retrievalText,retrievalRenderHash,renderRecordHash,spanRenderVersion} from '../local-retrieval/render.js';

const textSupport={type:'text',spanId:'SPAN-t1',spanHash:'sha256:t',text:'Revenue increased by 12% for the quarter.'};
const tableSupport={type:'table',spanId:'SPAN-b1',spanHash:'sha256:b',tableTitle:'revenue by geography (in millions):',rowLabel:'United States',headerPath:['Year Ended December 31,','2025'],cellText:'$ 4,801',unitContext:{match:'(in millions)',scale:'millions',currency:'USD',captionText:'revenue by geography (in millions):'}};

test('text retrieval rendering is the source-exact sentence',()=>{
 assert.equal(retrievalText(textSupport),'Revenue increased by 12% for the quarter.');
});
test('table retrieval rendering is deterministic and carries verified context without identity',()=>{
 const rendered=retrievalText(tableSupport);
 assert.equal(rendered,'TABLE: revenue by geography (in millions):\nROW: United States\nCOLUMN: Year Ended December 31,, 2025\nVALUE: $ 4,801\nUNIT CONTEXT: (in millions)');
 assert.ok(!rendered.includes(tableSupport.spanId));
 assert.equal(retrievalText(tableSupport),rendered);
});
test('a table without unit context renders without the unit line',()=>{
 assert.ok(!retrievalText({...tableSupport,unitContext:null}).includes('UNIT CONTEXT'));
});
test('render hashes move with content, identity and renderer version',()=>{
 assert.equal(retrievalRenderHash([tableSupport]),retrievalRenderHash([tableSupport]));
 assert.notEqual(retrievalRenderHash([tableSupport]),retrievalRenderHash([{...tableSupport,cellText:'$ 4,802'}]));
 assert.notEqual(retrievalRenderHash([tableSupport]),retrievalRenderHash([{...tableSupport,spanId:'SPAN-b2'}]));
 assert.equal(spanRenderVersion,'span-retrieval-render/v1');
 assert.notEqual(renderRecordHash(tableSupport),renderRecordHash({...tableSupport,spanHash:'sha256:other'}));
});
test('unsupported support types are rejected instead of silently rendered',()=>{
 assert.throws(()=>retrievalText({type:'image',spanId:'SPAN-x'}),/RETRIEVAL_SUPPORT_UNSUPPORTED/);
});
