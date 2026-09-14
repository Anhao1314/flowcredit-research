import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSelectionHandles,handleAt,parseHandleSelection,resolveSelectionHandles,selectionHandlesSchema} from '../selection-handles/handles.js';
import {renderSupport} from '../evidence-support/layer.js';
import {syntheticSupports} from './fixtures.js';

const ids=['SPAN-abc123','SPAN-abc124','SPAN-def456'];
const handles=buildSelectionHandles(ids);
const response=value=>JSON.stringify(value);

test('handles map to canonical ids in frozen candidate order',()=>{
 assert.deepEqual(handles.availableHandles,['S1','S2','S3']);
 assert.deepEqual(handles.map,{S1:'SPAN-abc123',S2:'SPAN-abc124',S3:'SPAN-def456'});
 assert.deepEqual(handles.entries.map(entry=>entry.rank),[1,2,3]);
 assert.equal(handleAt(8),'S8');
 assert.deepEqual(resolveSelectionHandles(['S3','S1'],handles),[{handle:'S3',spanId:'SPAN-def456'},{handle:'S1',spanId:'SPAN-abc123'}]);
});

test('a handle outside the frozen set is rejected by name, never repaired',()=>{
 for(const raw of [
  response([{selectedHandles:['S9'],factKind:'financial_metric'}]),
  response([{selectedHandles:['SS1'],factKind:'financial_metric'}]),
  response([{selectedHandles:['S01'],factKind:'financial_metric'}]),
  response([{selectedHandles:['Sl'],factKind:'financial_metric'}]),
  response([{selectedHandles:['s1'],factKind:'financial_metric'}]),
  response([{selectedHandles:[' S1'],factKind:'financial_metric'}]),
  response([{selectedHandles:['S1 '],factKind:'financial_metric'}]),
  response([{selectedHandles:['SPAN-abc123'],factKind:'financial_metric'}]),
  response([{selectedHandles:['SPAN-abc12'],factKind:'financial_metric'}]),
  response([{selectedHandles:[''],factKind:'financial_metric'}])
 ]){
  assert.throws(()=>parseHandleSelection(raw,handles),/^Error: INVALID_SELECTION_HANDLE$/,raw);
 }
});

test('the rejected handle is reported, and a duplicate is its own error',()=>{
 try{parseHandleSelection(response([{selectedHandles:['S9','S4'],factKind:'financial_metric'}]),handles);assert.fail('must throw');}
 catch(error){assert.equal(error.message,'INVALID_SELECTION_HANDLE');assert.deepEqual(error.invalid,['S9','S4']);}
 assert.throws(()=>parseHandleSelection(response([{selectedHandles:['S2','S2'],factKind:'financial_metric'}]),handles),/DUPLICATE_SELECTION_HANDLE/);
 assert.throws(()=>resolveSelectionHandles(['S1','S1'],handles),/DUPLICATE_SELECTION_HANDLE/);
});

test('an empty selection stays a legal abstention and a bad factKind stays a contract error',()=>{
 const parsed=parseHandleSelection('[]',handles);
 assert.deepEqual(parsed.selections,[]);
 assert.throws(()=>parseHandleSelection(response([{selectedHandles:['S1'],factKind:'not_a_kind'}]),handles),/CONTRACT_SCHEMA_INVALID/);
 assert.throws(()=>parseHandleSelection(response([{spanIds:['S1'],factKind:'financial_metric'}]),handles),/CONTRACT_SCHEMA_INVALID/);
 assert.throws(()=>parseHandleSelection('```json\n[{"selectedHandles":["S1"],"factKind":"financial_metric"}\n```',handles),/CONTRACT_SCHEMA_INVALID/);
 assert.equal(parseHandleSelection('```json\n[{"selectedHandles":["S1"],"factKind":"financial_metric"}]\n```',handles).wrapperRemoved,true);
});

test('the per-invocation schema carries the live enum and stays strict',()=>{
 const schema=selectionHandlesSchema(handles.availableHandles);
 assert.deepEqual(schema.items.properties.selectedHandles.items.enum,['S1','S2','S3']);
 assert.equal(schema.items.properties.selectedHandles.uniqueItems,true);
 assert.equal(schema.items.properties.selectedHandles.maxItems,3);
 assert.equal(schema.items.additionalProperties,false);
 assert.deepEqual(schema.items.required,['selectedHandles','factKind']);
 const other=selectionHandlesSchema(buildSelectionHandles(['SPAN-x']).availableHandles);
 assert.deepEqual(other.items.properties.selectedHandles.items.enum,['S1']);
});

test('a candidate set with a repeated canonical id cannot be addressed by handles',()=>{
 assert.throws(()=>buildSelectionHandles(['SPAN-a','SPAN-a']),/DUPLICATE_CANDIDATE_SPAN/);
 assert.throws(()=>buildSelectionHandles([]),/non-empty candidate set/);
});

test('near-identical canonical ids are only distinguishable by exact handle',()=>{
 const pair=buildSelectionHandles(['SPAN-abc123','SPAN-abc124']);
 assert.deepEqual(pair.map,{S1:'SPAN-abc123',S2:'SPAN-abc124'});
 const rendered=syntheticSupports({offeredSpanIds:['SPAN-abc123','SPAN-abc124'],offeredSpanTypes:['text','text']}).map((support,index)=>renderSupport(support,{handle:handleAt(index+1)})).join('\n\n');
 assert.equal(rendered.includes('SPAN-abc123'),false);
 assert.equal(rendered.includes('SPAN-abc124'),false);
 assert.ok(rendered.includes('[S1]')&&rendered.includes('[S2]'));
 for(const guess of ['SPAN-abc123','SPAN-abc124','SPAN-abc125','SPAN-abc12','SPAN-ABC123'])assert.throws(()=>parseHandleSelection(response([{selectedHandles:[guess],factKind:'financial_metric'}]),pair),/INVALID_SELECTION_HANDLE/);
});

test('the module contains no fuzzy-repair machinery',()=>{
 const source=readFileSync(new URL('../selection-handles/handles.js',import.meta.url),'utf8');
 for(const forbidden of ['levenshtein','fuzzy','nearest','closest','editDistance','damerau','startsWith(handle)','toLowerCase()'])assert.equal(source.includes(forbidden),false,'handles.js must not contain '+forbidden);
 assert.equal(/handle\s*[.=]=?\s*handle\.toLowerCase/.test(source),false);
});
