import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildPublicDemo} from '../surface/fixtures/public-demo/build.js';
import {createSurfaceServer} from '../surface/server.js';
import {loadWhatChangedDemo} from '../surface/data-source.js';

async function withServer(memoryPath,fn){
 const server=createSurfaceServer({memoryPath,publicDemo:true,log:{log(){},error(){}}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const base='http://127.0.0.1:'+server.address().port;
 try{await fn(base);}finally{await new Promise(resolve=>server.close(resolve));}
}

test('committed What Changed fixture is executed through the real pairwise runtime',()=>{
 const demo=loadWhatChangedDemo();
 assert.ok(demo);
 assert.deepEqual(demo.counts,{pairs:5,resolved:3,abstained:1,notEvaluated:1,errors:0,candidates:2});
 assert.deepEqual(demo.receipts.map(item=>item.relation),['SUPPORTS','COUNTERS','AMBIGUOUS',null,'NEUTRAL']);
});

test('What Changed surface shows runtime receipts and keeps Claim mutation disabled',async()=>{
 const path=join(tmpdir(),'fc-what-changed-runtime.sqlite');
 buildPublicDemo(path,{log:{log(){}}});
 await withServer(path,async(base)=>{
  const response=await fetch(base+'/changes?demo=1');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/Pairwise Relation runtime/);
  assert.match(html,/SUPPORTS/);
  assert.match(html,/COUNTERS/);
  assert.match(html,/AMBIGUOUS/);
  assert.match(html,/NOT_EVALUATED/);
  assert.match(html,/PENDING HUMAN REVIEW/);
  assert.match(html,/Claim mutation allowed: no/);
 });
});
