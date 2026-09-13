import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
async function frontend(options={}) {
  const memory=options.memory || new Map(), tab=options.tab || new Map(), scheduled=[];
  const store=(map,blocked)=>({getItem:k=>map.get(k)||null,setItem(k,v){if(blocked)throw Error('blocked');map.set(k,v);},removeItem:k=>map.delete(k)});
  const c=vm.createContext({crypto:{randomUUID:(()=>{let n=0;return()=>`enterprise-${++n}`;})()},localStorage:store(memory,options.localBlocked),sessionStorage:store(tab,options.tabBlocked),setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},clearTimeout(){}});
  vm.runInContext('window=globalThis',c);
  for(const file of ['data','state','ui','risk-engine-v021','example-v03','intake-v03','view-ingest','view-ai','view-audit','view-report','view-workspace']) vm.runInContext(await readFile(new URL(`../../assets/js/${file}.js`,import.meta.url),'utf8'),c);
  c.App.state.route='#/ingest'; c.App.renderCurrent=()=>{}; c.App.nav=route=>{c.App.state.route=route;};
  return {c,memory,tab,flush:()=>{while(scheduled.length)scheduled.shift()();}};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function node(attrs={},value='') { return {value,checked:false,disabled:false,events:{},getAttribute:k=>attrs[k]??null,addEventListener(name,fn){this.events[name]=fn;},setAttribute(){},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;},querySelectorAll:()=>[],querySelector:()=>null}; }
function host(nodes={},lists={}) { return {innerHTML:'',querySelector:s=>nodes[s]||null,querySelectorAll:s=>lists[s]||[]}; }
test('all conclusion states are conservative, stable and independent of grade',async()=>{
 const {c}=await frontend(), intake=c.FC_INTAKE;
 for(const [status,title] of Object.entries({'insufficient-evidence':'More evidence needed','enhanced-review':'Further review required','standard-review':'Standard manual review required','eligible-for-review':'Eligible for manual review','simulation-only':'Example assessment',unknown:'Review required'})) assert.equal(intake.summary({decisionStatus:status,grade:'A'}).title,title);
 const run={decisionStatus:'enhanced-review',grade:'A',requiredActions:[{priority:3,message:'later'},{priority:1,message:'first'},{priority:1,message:'second'}],anchors:[{score:null,reason:'Missing collections'}],limitations:['lower precedence']};
 assert.equal(intake.summary(run).next.message,'first'); assert.equal(intake.summary(run).reason,'Missing collections');
 run.confirmedIntegrityEvents=[{message:'Confirmed fabricated usage'}];run.vetoApplied=true;
 assert.equal(intake.summary(run).title,'Confirmed integrity concern');assert.equal(intake.summary(run).reason,'Confirmed fabricated usage');
 assert.equal(intake.summary({}).next,null); assert.equal(intake.summary({}, {source:'example'}).synthetic,true);
});
test('persistence labels reflect actual write result; Undo restores order, selection and limit',async()=>{
 for(const [opts,label] of [[{},'Saved in this browser'],[{localBlocked:true},'Saved for this tab'],[{localBlocked:true,tabBlocked:true},'Memory only']]){
  const {c}=await frontend(opts), i=c.FC_INTAKE;for(let n=0;n<6;n++)i.create({label:`Case ${n}`});assert.equal(i.list().length,5);assert.equal(i.saveStatus(),label);
  const before=plain(i.list()), active=i.active().draftId;i.remove(active);assert.equal(i.canUndo(),true);assert.equal(i.undo(),true);assert.deepEqual(plain(i.list()),before);assert.equal(i.active().draftId,active);assert.equal(i.undo(),false);
  i.clear();assert.equal(i.list().length,0);i.undo();assert.deepEqual(plain(i.list()),before);
  i.remove(active);i.create({label:'next'});assert.equal(i.canUndo(),false);
 }
});
test('AI config distinguishes model status, authentication and sidecar capability',async()=>{
 const {c}=await frontend(), cap=c.FC_INTAKE.capabilities;
 for(const status of ['available','unavailable','unconfigured']) { const config={deterministicStatus:'ready',extractionStatus:status};assert.equal(cap(config).canAssess,true);assert.equal(cap(config).modelAvailable,status==='available');assert.equal(cap({...config,authenticationRequired:true}).canAssess,false);assert.equal(cap({...config,authenticationRequired:true}).modelAvailable,false); }
 assert.equal(cap({}).canAssess,false);
 const draft=c.FC_INTAKE.create(c.FC_EXAMPLE.draft,'example');c.FC_INTAKE.setResult(c.FC_RISK_RUN(draft.input,draft.draftId).result);c.FC_SERVICE_CONFIG={deterministicStatus:'ready',extractionStatus:'available'};
 const page=host();c.App.views.audit.render(page);assert.match(page.innerHTML,/Only a local result/);assert.match(page.innerHTML,/id="custom-ask" type="button" disabled/);assert.equal(draft.explanationConsent,false);
});
test('JSON switch saves guided edits, preserves extra imported metadata, and blocks malformed JSON',async()=>{
 const {c}=await frontend(),i=c.FC_INTAKE;
 const draft=i.create({...c.FC_EXAMPLE.draft,applicationNote:{ticket:'keep'},CCI:999},'json');
 const button=node({'data-mode':'json'}),name=node({'data-field':'label'},'Edited operator'),form=node();
 c.App.views.ingest.render(host({'#intake-form':form},{'[data-mode]':[button],'#intake-form [data-field]':[name]}));button.events.click();assert.equal(draft.input.label,'Edited operator');assert.deepEqual(plain(i.editableInput(draft).applicationNote),{ticket:'keep'});assert.equal(draft.input.CCI,undefined);
 const json=node({},'{broken'),back=node({'data-mode':'manual'}),status=node();
 c.App.views.ingest.render(host({'#intake-json':json,'#intake-source-status':status},{'[data-mode]':[back]}));back.events.click();assert.equal(draft.jsonText,'{broken');assert.match(status.textContent,/Invalid JSON/);assert.equal(draft.input.label,'Edited operator');
 json.value=JSON.stringify({...i.editableInput(draft),revenueUsd:87654});back.events.click();assert.equal(draft.input.revenueUsd,87654);assert.equal(draft.jsonText,undefined);assert.equal(i.editableInput(draft).applicationNote.ticket,'keep');
});
test('visual rows retain untouched dates and row metadata while changing paired values',async()=>{
 const {c}=await frontend(),i=c.FC_INTAKE;const draft=i.create({...c.FC_EXAMPLE.draft,monthlySeries:[{period:'2026-03',rawTokensM:72,custom:'retain'}]},'json');
 const date=node({'data-cell':'observedAt','data-kind':'text'},'2026-09-01'),record=node({'data-row':'0'});record.querySelectorAll=()=>[date];const evidence=node({'data-rows':'evidence'});evidence.querySelectorAll=()=>[record];
 const r=node({'data-cell':'R','data-kind':'number'},'12'),cc=node({'data-cell':'C','data-kind':'number'},'11'),pair=node({'data-row':'0'});pair.querySelectorAll=()=>[r,cc];const cross=node({'data-rows':'crosscheck'});cross.querySelectorAll=()=>[pair];
 const form=node(),page=host({'#intake-form':form},{'[data-rows]':[evidence,cross]});c.App.views.ingest.render(page);form.events.change();assert.equal(draft.input.evidence[0].observedAt,'2026-09-01T00:00:00Z');assert.deepEqual(plain(draft.input.R),[12]);assert.deepEqual(plain(draft.input.C),[11]);assert.equal(draft.input.monthlySeries[0].custom,'retain');
});
test('completion intent expands evidence and focuses only its active draft after shell rendering',async()=>{
 const {c,flush}=await frontend(),i=c.FC_INTAKE;i.create({},'manual');i.locate({category:'evidence',fields:['modelTier']});const control=node(),group=node();group.querySelector=()=>control;
 c.App.views.ingest.render(host({'#intake-evidence-details':group}));assert.equal(control.focused,undefined);flush();assert.equal(group.open,true);assert.equal(control.focused,true);assert.equal(control.scrolled,true);
 i.locate({fields:['validRatePct']});i.create({label:'Different'});assert.equal(i.takeIntent(),null);
});
test('401, 429, 504 and offline assessment failures fall back locally; canceled routes never mutate drafts',async()=>{
 for(const failure of [401,429,504,0]) {
 const {c}=await frontend(),i=c.FC_INTAKE,draft=i.create(c.FC_EXAMPLE.draft,'manual');c.FC_SERVICE_CONFIG={deterministicStatus:'ready',extractionStatus:'available'};c.FC_AI={assessDraft:()=>Promise.reject({status:failure})};const run=node();c.App.views.ingest.render(host({'#intake-run':run}));run.events.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(draft.status,'complete');assert.equal(draft.result.cci,929);
 }
 const {c}=await frontend(),i=c.FC_INTAKE,draft=i.create(c.FC_EXAMPLE.draft,'manual');let resolve;c.FC_SERVICE_CONFIG={deterministicStatus:'ready',extractionStatus:'available'};c.FC_AI={assessDraft:()=>new Promise(r=>{resolve=r;})};const run=node();c.App.views.ingest.render(host({'#intake-run':run}));run.events.click();c.App.state.route='#/workspace';const another=i.create({label:'Different'});resolve(c.FC_RISK_RUN(draft.input,draft.draftId).result);await new Promise(r=>setImmediate(r));assert.equal(another.result,null);assert.equal(draft.result,null);
});

test('a tab fallback survives reload even when an older browser copy is still readable',async()=>{
 const first=await frontend();first.c.FC_INTAKE.create({label:'Older browser copy'});
 const second=await frontend({memory:first.memory,tab:first.tab,localBlocked:true});second.c.FC_INTAKE.create({label:'Latest tab copy'});
 const third=await frontend({memory:first.memory,tab:first.tab,localBlocked:true});assert.equal(third.c.FC_INTAKE.active().input.label,'Latest tab copy');assert.equal(third.c.FC_INTAKE.saveStatus(),'Saved for this tab');
});
test('a live question requires its own authorization even after extraction consent',async()=>{
 const {c}=await frontend(),i=c.FC_INTAKE,draft=i.create(c.FC_EXAMPLE.draft,'example');i.setResult(c.FC_RISK_RUN(draft.input,draft.draftId).result);draft.sessionId='online-session';draft.extractionConsent=true;c.FC_SERVICE_CONFIG={deterministicStatus:'ready',extractionStatus:'available'};
 let calls=0;c.FC_AI={askDraft:()=>{calls++;return Promise.resolve({answer:'Current facts only'});}};const button=node(),consent=node(),input=node({},'What is missing?'),output=node();const page=host({'#custom-ask':button,'#custom-ask-consent':consent,'#custom-ask-input':input,'#custom-ask-output':output});c.App.state.route='#/audit';c.App.views.audit.render(page);button.events.click();assert.equal(calls,0);consent.checked=true;button.events.click();await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.match(output.innerHTML,/Current facts only/);
});
