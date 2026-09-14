import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSelectionHandles,handleAt,parseHandleSelection} from '../selection-handles/handles.js';
import {renderSupport} from '../evidence-support/layer.js';
import {gold08,syntheticSupports} from './fixtures.js';

test('GOLD-08 replays deterministically: the v0.11 typo is an invalid handle, not a repaired id',()=>{
 const handles=buildSelectionHandles(gold08.offeredSpanIds);
 assert.deepEqual(handles.availableHandles,['S1','S2','S3','S4','S5','S6','S7','S8']);
 assert.equal(handles.map[gold08.expectedHandleOfTypo],gold08.canonicalSpanIdOfTypo);
 // The recorded response speaks the old contract (spanIds), so under the handle
 // contract it does not even parse: the model is no longer asked for, and no
 // longer able to return, a canonical id. This is the regression rationale for
 // the whole phase.
 assert.throws(()=>parseHandleSelection(gold08.typoResponse,handles),/CONTRACT_SCHEMA_INVALID/);
 // The same ids placed in the handle field are refused by name, never matched to
 // the near neighbour that differs by one character.
 assert.throws(()=>parseHandleSelection(JSON.stringify([{selectedHandles:[gold08.typoSpanId],factKind:'financial_metric'}]),handles),error=>{
  assert.equal(error.message,'INVALID_SELECTION_HANDLE');
  assert.ok(error.invalid.includes(gold08.typoSpanId));
  return true;
 });
});

test('GOLD-08 model-facing text is handles only, with no canonical id anywhere',()=>{
 const supports=syntheticSupports();
 const context=supports.map((support,index)=>renderSupport(support,{handle:handleAt(index+1)})).join('\n\n');
 for(const id of gold08.offeredSpanIds)assert.equal(context.includes(id),false,'the model must never see '+id);
 assert.equal(context.includes('SPAN-'),false);
 for(const handle of ['[S1]','[S4]','[S7]','[S8]'])assert.ok(context.includes(handle));
 // The canonical interface stays available for the frozen v0.10/v0.11 path.
 const canonical=renderSupport(supports[6]);
 assert.equal(canonical.startsWith('SPAN '+gold08.canonicalSpanIdOfTypo+'\n'),true);
});

test('the same GOLD-08 candidate set resolves to the right canonical span through its handle',()=>{
 const handles=buildSelectionHandles(gold08.offeredSpanIds);
 const parsed=parseHandleSelection(JSON.stringify([{selectedHandles:[gold08.expectedHandleOfTypo],factKind:'financial_metric'}]),handles);
 assert.deepEqual(parsed.selections,[{handle:'S7',spanId:gold08.canonicalSpanIdOfTypo,factKind:'financial_metric'}]);
 const card=parsed.selections[0];
 assert.equal(card.spanId,gold08.offeredSpanIds[6]);
 assert.notEqual(card.spanId,gold08.typoSpanId);
});

test('the replay fixture still describes the recorded v0.11 run',()=>{
 assert.equal(gold08.offeredSpanIds.length,gold08.retrieval.limit);
 assert.equal(gold08.offeredSpanIds.length,gold08.offeredSpanTypes.length);
 assert.equal(gold08.canonicalSpanIdOfTypo,gold08.offeredSpanIds[6]);
 assert.equal(gold08.typoSpanId.length,gold08.canonicalSpanIdOfTypo.length+2);
 assert.ok(gold08.typoResponse.includes(gold08.typoSpanId));
 assert.ok(gold08.typoResponse.includes(gold08.canonicalSpanIdOfTypo)===false);
});
