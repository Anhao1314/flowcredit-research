// Offline end-to-end tests for FlowCredit Research Workbench UI-2.0.
// Hermetic fixture data lives in the system temp directory. Safety/integrity
// assertions are product gates, not screenshot-copy assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { buildFixture, extraEvidenceId } from './fixtures.js';
import { MemorySource, resolveMemoryPath } from '../surface/data-source.js';
import { startSurface } from '../surface/server.js';

const silentLog={log(){},error(){}};
const REAL_MEMORY=resolveMemoryPath();
const REAL_MEMORY_AVAILABLE=existsSync(REAL_MEMORY)&&/coreweave|recovery-final/.test(REAL_MEMORY);

function httpGet(url,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=request(url,{method},res=>{
   let body='';res.setEncoding('utf8');
   res.on('data',chunk=>{body+=chunk;});
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
  });
  req.on('error',reject);req.end();
 });
}
function fileHash(path){return createHash('sha256').update(readFileSync(path)).digest('hex');}

async function withSurface(t,run,overrides={},fixtureOptions={}){
 const fixture=buildFixture(fixtureOptions);t.after(()=>fixture.cleanup());
 const {server,url}=await startSurface({port:0,log:silentLog,memoryPath:fixture.memoryPath,demoDir:fixture.demoDir,demoFallback:fixture.fallbackPath,...overrides});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 return run({...fixture,url,server});
}

test('server binds loopback only and serves the UI-2 Workbench shell',async t=>{
 await withSurface(t,async({url,server})=>{
  assert.equal(server.address().address,'127.0.0.1');
  const response=await httpGet(url+'/');
  assert.equal(response.status,200);
  assert.match(response.headers['content-type'],/text\/html/);
  for(const marker of ['Research Workbench','Research Inbox','href="/beliefs"','href="/review"','href="/evidence"','href="/timeline"','READ ONLY','AI OFF']) assert.ok(response.body.includes(marker),marker);
  assert.match(response.headers['content-security-policy'],/default-src 'none'/);
  assert.match(response.headers['content-security-policy'],/form-action 'self'/);
  assert.equal(response.headers['referrer-policy'],'no-referrer');
  const css=await httpGet(url+'/assets/surface.css');
  const js=await httpGet(url+'/assets/surface.js');
  assert.equal(css.status,200);assert.equal(js.status,200);
  assert.doesNotThrow(()=>new Function(js.body));
  assert.equal(/\bfetch\s*\(/.test(js.body),false);
  assert.equal(/localStorage|sessionStorage/.test(js.body),false);
  assert.equal(/@import\b/.test(css.body),false);
 });
});

test('Inbox leads with actionable signals computed from persisted Research Memory',async t=>{
 await withSurface(t,async({url})=>{
  const response=await httpGet(url+'/');
  assert.equal(response.status,200);
  for(const marker of ['Needs attention','Evidence waiting for a belief','Beliefs with thin support','Unlinked Evidence','Recently recorded Evidence','Evidence linking','Provenance depth']) assert.ok(response.body.includes(marker),marker);
  assert.ok(response.body.includes('30'));
  assert.ok(response.body.includes('href="/evidence?link=unlinked"'));
  assert.ok(response.body.includes('href="/beliefs"'));
  assert.ok(response.body.includes('2026-05-10 10:30 UTC'));
  assert.ok(response.body.indexOf('Needs attention')<response.body.indexOf('Research state'));
 },{}, {extraEvidence:30});
});

test('Inbox does not invent zero-count attention blocks',async t=>{
 await withSurface(t,async({url})=>{
  const response=await httpGet(url+'/');
  assert.equal(response.status,200);
  assert.equal(response.body.includes('Unlinked Evidence'),false);
  assert.equal(response.body.includes('Evidence waiting for a belief'),false);
  assert.ok(response.body.includes('Beliefs with thin support'));
 });
});

test('subject context renders beliefs, evidence and scoped Workbench links',async t=>{
 await withSurface(t,async({url,paths})=>{
  const response=await httpGet(url+'/company/'+paths.subject);
  assert.equal(response.status,200);
  for(const marker of ['Fixture claims receipts are rising.','Fixture claims costs are contained.','Current beliefs','Recent Evidence','Sources','/beliefs?subject=fixturecorp','/evidence?subject=fixturecorp','Research Timeline']) assert.ok(response.body.includes(marker),marker);
 });
});

test('unknown subject returns a friendly 404 without stack leakage',async t=>{
 await withSurface(t,async({url})=>{
  const response=await httpGet(url+'/company/unknown-subject');
  assert.equal(response.status,404);
  assert.ok(response.body.includes('Subject not found'));
  assert.equal(response.body.includes('at Object.'),false);
 });
});

test('Belief Workbench explains recorded evidence roles without fabricating RelationReceipts',async t=>{
 await withSurface(t,async({url,paths})=>{
  const response=await httpGet(url+'/claim/'+paths.claimOne);
  assert.equal(response.status,200);
  for(const marker of ['Belief Workbench','Fixture claims receipts are rising.','Reasoning','SUPPORTS','Recorded role:','not a persisted pairwise RelationReceipt','Belief history','Technical record','Human authority']) assert.ok(response.body.includes(marker),marker);
  assert.ok(response.body.includes('/evidence/'+paths.evidenceOne));
  assert.ok(response.body.includes('No persisted real RelationReceipt exists'));
  assert.equal(response.body.includes('RelationReceipt</span><span class="state-value">SUPPORTS'),false);
  const missing=await httpGet(url+'/claim/CLAIM-0000000000000000000');
  assert.equal(missing.status,404);assert.ok(missing.body.includes('Belief not found'));
 });
});

test('Evidence Receipt exposes source, admission and belief links above technical ids',async t=>{
 await withSurface(t,async({url,paths})=>{
  const response=await httpGet(url+'/evidence/'+paths.evidenceOne);
  assert.equal(response.status,200);
  for(const marker of ['Evidence Receipt','Recorded fact','Admission','Used by beliefs','Provenance','Evidence → Admission → Source','verified_existing_evidence','Fixture quarterly report','SUPPORTS','Authority boundary']) assert.ok(response.body.includes(marker),marker);
  assert.ok(response.body.includes('/claim/'+paths.claimOne));
  assert.ok(response.body.indexOf('Evidence Receipt')<response.body.indexOf('Technical record'));
 });
});

test('Evidence Receipt states partial provenance and escapes persisted strings',async t=>{
 await withSurface(t,async({url,paths})=>{
  const response=await httpGet(url+'/evidence/'+paths.evidenceTwo);
  assert.equal(response.status,200);
  assert.ok(response.body.includes('Evidence → Source'));
  assert.ok(response.body.includes('No admission review recorded for this Evidence record.'));
  assert.ok(response.body.includes('&lt;script&gt;alert(&#39;escape-check&#39;)&lt;/script&gt;'));
  assert.equal(response.body.includes("<script>alert('escape-check')</script>"),false);
 });
});

test('unlinked Evidence remains inspectable without being called worthless or authoritative',async t=>{
 await withSurface(t,async({url})=>{
  const response=await httpGet(url+'/evidence/'+extraEvidenceId(1));
  assert.equal(response.status,200);
  assert.ok(response.body.includes('Not currently linked to a Belief.'));
  assert.ok(response.body.includes('The Evidence remains inspectable in Research Memory'));
  assert.ok(response.body.includes('Claim mutation'));
  assert.ok(response.body.includes('not allowed'));
 },{}, {extraEvidence:3});
});

test('Beliefs index is the product route and /claims stays a compatibility alias',async t=>{
 await withSurface(t,async({url,paths})=>{
  const beliefs=await httpGet(url+'/beliefs');
  assert.equal(beliefs.status,200);
  assert.ok(beliefs.body.includes('2 recorded beliefs'));
  assert.ok(beliefs.body.includes('/claim/'+paths.claimOne));
  assert.ok(beliefs.body.includes('/claim/'+paths.claimTwo));
  assert.ok(beliefs.body.includes('Coverage is not confidence'));
  assert.ok(beliefs.body.includes('value="revenue"'));
  const filtered=await httpGet(url+'/beliefs?category=costs');
  assert.ok(filtered.body.includes('Fixture claims costs are contained.'));
  assert.equal(filtered.body.includes('Fixture claims receipts are rising.'),false);
  const searched=await httpGet(url+'/beliefs?q=RECEIPTS');
  assert.ok(searched.body.includes('Fixture claims receipts are rising.'));
  const empty=await httpGet(url+'/beliefs?q=zzz-nothing');
  assert.ok(empty.body.includes('No beliefs match these filters.'));
  const alias=await httpGet(url+'/claims');
  assert.equal(alias.status,200);
  assert.ok(alias.body.includes('Beliefs'));
 });
});

test('Evidence index paginates, filters and searches deterministically',async t=>{
 await withSurface(t,async({url,paths})=>{
  const pageOne=await httpGet(url+'/evidence');
  assert.equal(pageOne.status,200);
  assert.ok(pageOne.body.includes('Recorded facts · 32 records'));
  assert.ok(pageOne.body.includes('1–20 of 32'));
  assert.ok(pageOne.body.includes('aria-label="Pagination"'));
  const pageTwo=await httpGet(url+'/evidence?page=2');
  assert.ok(pageTwo.body.includes('21–32 of 32'));
  assert.ok(pageTwo.body.includes('/evidence/'+paths.evidenceOne));
  const linked=await httpGet(url+'/evidence?link=linked');
  assert.ok(linked.body.includes('Recorded facts · 2 of 32 match the current filters'));
  assert.ok(linked.body.includes('/evidence/'+paths.evidenceOne));
  assert.ok(linked.body.includes('/evidence/'+paths.evidenceTwo));
  assert.ok(linked.body.includes('Linked · 1 Belief'));
  const unlinked=await httpGet(url+'/evidence?link=unlinked');
  assert.ok(unlinked.body.includes('1–20 of 30'));
  assert.ok(unlinked.body.includes('Not linked to a Belief'));
  const reviewed=await httpGet(url+'/evidence?review=reviewed');
  assert.ok(reviewed.body.includes('Recorded facts · 1 of 32 match the current filters'));
  const searched=await httpGet(url+'/evidence?q=COMPLIANCE%20costs%20reference%20item%207');
  assert.ok(searched.body.includes('Recorded facts · 1 of 32 match the current filters'));
  const partialId=await httpGet(url+'/evidence?q='+extraEvidenceId(7).slice(9,20));
  assert.ok(partialId.body.includes('No Evidence records match these filters.'));
 },{}, {extraEvidence:30});
});

test('Evidence index rows keep one metadata rhythm and explicit labelled states',async t=>{
 await withSurface(t,async({url})=>{
  const response=await httpGet(url+'/evidence');
  const rows=[...response.body.matchAll(/<li class="row row-dense">([\s\S]*?)<\/li>/g)].map(match=>match[1]);
  assert.equal(rows.length,20);
  for(const row of rows){
   assert.equal([...row.matchAll(/class="row-meta"/g)].length,1);
   const side=row.split('class="row-side"')[1]??'';
   assert.equal([...side.matchAll(/<span class="chip/g)].length,2);
   assert.match(row,/Linked · 1 Belief|Not linked to a Belief/);
   assert.match(row,/Deep trace|Partial trace/);
  }
 },{}, {extraEvidence:30});
});

test('index return context restores filters and canonicalizes historical Claim routes to Beliefs',async t=>{
 await withSurface(t,async({url,paths})=>{
  const evidenceFrom='/evidence?link=linked&sort=page';
  const evidenceIndex=await httpGet(url+evidenceFrom);
  assert.ok(evidenceIndex.body.includes(`/evidence/${paths.evidenceOne}?from=${encodeURIComponent(evidenceFrom)}`));
  const evidenceDetail=await httpGet(url+`/evidence/${paths.evidenceOne}?from=${encodeURIComponent(evidenceFrom)}`);
  assert.ok(evidenceDetail.body.includes('href="/evidence?link=linked&amp;sort=page"'));

  const beliefFrom='/beliefs?q=receipts&status=supported';
  const beliefIndex=await httpGet(url+beliefFrom);
  assert.ok(beliefIndex.body.includes(`/claim/${paths.claimOne}?from=${encodeURIComponent(beliefFrom)}`));
  const beliefDetail=await httpGet(url+`/claim/${paths.claimOne}?from=${encodeURIComponent(beliefFrom)}`);
  assert.ok(beliefDetail.body.includes('href="/beliefs?q=receipts&amp;status=supported"'));

  const legacyFrom='/claims?q=receipts&status=supported';
  const legacyDetail=await httpGet(url+`/claim/${paths.claimOne}?from=${encodeURIComponent(legacyFrom)}`);
  assert.ok(legacyDetail.body.includes('href="/beliefs?q=receipts&amp;status=supported"'));
 });
});

test('hostile return contexts fall back to the plain safe index',async t=>{
 await withSurface(t,async({url,paths})=>{
  for(const hostile of ['//evil.com/evidence','https://evil.com/evidence','javascript:alert(1)','/../../etc/passwd','/claim/CLAIM-X']){
   const evidence=await httpGet(url+`/evidence/${paths.evidenceOne}?from=${encodeURIComponent(hostile)}`);
   assert.ok(evidence.body.includes('href="/evidence"'));
   assert.equal(evidence.body.includes('evil.com'),false);
   const belief=await httpGet(url+`/claim/${paths.claimOne}?from=${encodeURIComponent(hostile)}`);
   assert.ok(belief.body.includes('href="/beliefs"'));
  }
 });
});

test('Timeline is built from persisted events and does not invent belief changes',async t=>{
 await withSurface(t,async({url})=>{
  const response=await httpGet(url+'/timeline');
  assert.equal(response.status,200);
  for(const marker of ['Research history','Timeline','Evidence recorded','Belief entered Research Memory','Evidence admission review recorded','As-of integrity']) assert.ok(response.body.includes(marker),marker);
  assert.ok(response.body.includes('Real proposals'));
  assert.equal(response.body.includes('Synthetic proposal created'),false);
  const alias=await httpGet(url+'/changes');
  assert.equal(alias.status,200);
  assert.ok(alias.body.includes('Timeline'));
 });
});

test('Review is honest in real mode and isolated in synthetic preview mode',async t=>{
 await withSurface(t,async({url})=>{
  const real=await httpGet(url+'/review');
  assert.equal(real.status,200);
  assert.ok(real.body.includes('No persisted review candidates yet.'));
  assert.ok(real.body.includes('Review mutation'));
  assert.ok(real.body.includes('disabled'));
  assert.ok(real.body.includes('Human authority'));

  const demo=await httpGet(url+'/review?demo=1');
  assert.equal(demo.status,200);
  assert.ok(demo.body.includes('Review Queue'));
  assert.ok(demo.body.includes('PENDING HUMAN REVIEW'));
  assert.ok(demo.body.includes('Claim mutation allowed: no'));
  assert.ok(demo.body.includes('NEEDS INVESTIGATION'));
  assert.ok(demo.body.includes('Preview only'));
 });
});

test('demo navigation remains isolated and carries demo=1 through Workbench routes',async t=>{
 await withSurface(t,async({url})=>{
  const demo=await httpGet(url+'/review?demo=1');
  assert.ok(demo.body.includes('Synthetic preview'));
  for(const href of ['/beliefs?demo=1','/review?demo=1','/evidence?demo=1','/timeline?demo=1']) assert.ok(demo.body.includes(`href="${href}"`),href);
  const real=await httpGet(url+'/');
  assert.equal(real.body.includes('Synthetic preview'),false);
 });
});

test('favicon remains local and every page references it',async t=>{
 await withSurface(t,async({url})=>{
  const svg=await httpGet(url+'/favicon.svg');
  assert.equal(svg.status,200);assert.match(svg.headers['content-type'],/image\/svg\+xml/);assert.ok(svg.body.includes('<svg'));
  const ico=await httpGet(url+'/favicon.ico');
  assert.equal(ico.status,200);
  const page=await httpGet(url+'/');
  assert.ok(page.body.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'));
 });
});

test('accessibility basics survive the redesign',async t=>{
 await withSurface(t,async({url,paths})=>{
  const inbox=await httpGet(url+'/');
  assert.ok(inbox.body.includes('>Skip to main content</a>'));
  assert.ok(inbox.body.includes('<main class="page" id="main"'));
  assert.ok(inbox.body.includes('role="search"'));
  const belief=await httpGet(url+'/claim/'+paths.claimOne);
  assert.ok(belief.body.includes('aria-current="page"'));
  const evidence=await httpGet(url+'/evidence/'+paths.evidenceOne);
  assert.equal(/<th(?=[\s>])(?![^>]*scope=)/.test(evidence.body),false);
  const demo=await httpGet(url+'/review?demo=1');
  const buttons=[...demo.body.matchAll(/<button[^>]*data-preview-button[^>]*>/g)].map(match=>match[0]);
  assert.ok(buttons.length>=3);
  for(const button of buttons) assert.ok(button.includes('aria-pressed="false"'));
 });
});

test('unsupported methods return 405 and HEAD returns headers only',async t=>{
 await withSurface(t,async({url})=>{
  const post=await httpGet(url+'/','POST');
  assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');
  const head=await httpGet(url+'/','HEAD');
  assert.equal(head.status,200);assert.equal(head.body,'');assert.match(head.headers['content-type'],/text\/html/);
 });
});

test('identifiers and traversal attempts are rejected',async t=>{
 await withSurface(t,async({url})=>{
  for(const path of ['/company/..%2f..%2fetc%2fpasswd','/evidence/%2e%2e%2fserver.js','/claim/a%2Fb','/assets/../server.js','/assets/does-not-exist.css','/nope']){
   const response=await httpGet(url+path);assert.equal(response.status,404,path);
  }
 });
});

test('unknown routes list the UI-2 Workbench routes',async t=>{
 await withSurface(t,async({url})=>{
  const response=await httpGet(url+'/nothing-here');
  assert.equal(response.status,404);
  for(const route of ['/beliefs','/review','/evidence','/timeline']) assert.ok(response.body.includes(route),route);
 });
});

test('unavailable Research Memory renders a friendly read-only notice',async t=>{
 const fixture=buildFixture();t.after(()=>fixture.cleanup());
 const {server,url}=await startSurface({port:0,log:silentLog,memoryPath:join(fixture.root,'missing.sqlite'),demoDir:fixture.demoDir,demoFallback:fixture.fallbackPath});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const response=await httpGet(url+'/');
 assert.equal(response.status,200);
 assert.ok(response.body.includes('Research Memory unavailable'));
 assert.ok(response.body.includes('MEMORY_MISSING'));
 assert.equal(response.body.includes('at Object.'),false);
});

test('browsing every UI-2 route leaves Research Memory and proposal stores byte-identical',async t=>{
 const fixture=buildFixture({extraEvidence:30});t.after(()=>fixture.cleanup());
 const proposalsPath=join(fixture.demoDir,'LOCK-99','proposals.sqlite');
 const before={memory:fileHash(fixture.memoryPath),proposals:fileHash(proposalsPath)};
 const reader=MemorySource.open(fixture.memoryPath);const authorityBefore=reader.authorityDigest();const countsBefore=reader.counts();reader.close();
 const {server,url}=await startSurface({port:0,log:silentLog,memoryPath:fixture.memoryPath,demoDir:fixture.demoDir,demoFallback:fixture.fallbackPath});
 try{
  for(const path of ['/',`/company/${fixture.paths.subject}`,`/claim/${fixture.paths.claimOne}`,`/evidence/${fixture.paths.evidenceOne}`,'/beliefs','/claims?q=fixture&category=revenue','/review','/review?demo=1','/evidence','/evidence?page=2','/evidence?link=unlinked&sort=category','/timeline','/changes','/timeline?demo=1','/?demo=1']){
   const response=await httpGet(url+path);assert.equal(response.status,200,path);
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
 assert.equal(fileHash(fixture.memoryPath),before.memory);
 assert.equal(fileHash(proposalsPath),before.proposals);
 const after=MemorySource.open(fixture.memoryPath);
 assert.equal(after.authorityDigest(),authorityBefore);assert.deepEqual(after.counts(),countsBefore);after.close();
});

test('real Research Memory renders current Workbench counts when available',{skip:!REAL_MEMORY_AVAILABLE?'real Research Memory not present':false},async t=>{
 const source=MemorySource.open(REAL_MEMORY);
 try{
  const counts=source.counts();
  assert.equal(counts.claims,4);assert.equal(counts.revisions,4);assert.equal(counts.evidence,32);assert.equal(counts.sources,3);
  if(REAL_MEMORY.includes('v0.4-recovery-final')) assert.equal(counts.reviews,13);
 }finally{source.close();}
 const {server,url}=await startSurface({port:0,log:silentLog,memoryPath:REAL_MEMORY});
 try{
  const subject=await httpGet(url+'/company/coreweave');assert.equal(subject.status,200);assert.ok(subject.body.includes('Current beliefs'));
  const beliefs=await httpGet(url+'/beliefs');assert.ok(beliefs.body.includes('4 recorded beliefs'));
  const evidence=await httpGet(url+'/evidence');assert.ok(evidence.body.includes('Recorded facts · 32 records'));
  const timeline=await httpGet(url+'/timeline');assert.ok(timeline.body.includes('Research history'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
