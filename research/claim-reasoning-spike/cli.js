import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {instructions,outputSchema,parseOutput,promptHash,sha256} from './lib/contract.js';
import {deterministicRelation} from './lib/deterministic.js';
import {scoreRows} from './lib/metrics.js';
import {nliDecision,layeredDecision,aggregateBundle,DEFAULT_PARAMS,CALIBRATED_PARAMS,LAYERED_POLICY} from './lib/hybrid.js';

const here=fileURLToPath(new URL('.',import.meta.url));
const artifacts=resolve(here,'artifacts');
const devSetPath=resolve(here,'dev-set.json');
mkdirSync(artifacts,{recursive:true});

const readJson=p=>JSON.parse(readFileSync(p,'utf8'));
const writeJson=(p,v)=>{writeFileSync(p,JSON.stringify(v,null,1)+'\n');return p;};

function freeze(){
 const target=resolve(artifacts,'preregistration.json');
 if(existsSync(target))throw Error('PREREGISTRATION_EXISTS: '+target);
 const files={
  'dev-set.json':sha256(readFileSync(devSetPath,'utf8')),
  'prompts/claim-relation-spike-v1.txt':promptHash,
  'lib/text.js':sha256(readFileSync(resolve(here,'lib/text.js'),'utf8')),
  'lib/deterministic.js':sha256(readFileSync(resolve(here,'lib/deterministic.js'),'utf8')),
  'lib/hybrid.js':sha256(readFileSync(resolve(here,'lib/hybrid.js'),'utf8')),
  'nli/run_nli.py':sha256(readFileSync(resolve(here,'nli/run_nli.py'),'utf8')),
  'cli.js':sha256(readFileSync(resolve(here,'cli.js'),'utf8')),
 };
 const dev=readJson(devSetPath);
 const plan={
  version:'claim-relation-spike-preregistration/v1',
  frozenAt:new Date().toISOString(),
  pairs:dev.pairs.length,
  bundles:dev.bundles.length,
  relationTaxonomy:dev.relationTaxonomy,
  architectures:['deterministic-only','nli-only','qwen-only','hybrid-no-qwen','hybrid-with-qwen'],
  nliParams:{default:DEFAULT_PARAMS,calibrated:CALIBRATED_PARAMS},
  runPlan:{
   nli:'one run of nli/run_nli.py over all frozen dev pairs (sequential latency pass + batch throughput pass)',
   qwen:'one run of cli.js qwen --opt-in over all frozen dev pairs, qwen3.5:9b Q4_K_M, temperature 0, non-thinking, context 8192',
  },
  hashes:files,
  note:'Threshold parameters may only be calibrated on this dev set, never on the historical locked 18. The locked 18 are not re-run by this spike.',
 };
 return writeJson(target,plan);
}

function sampleOllamaRss(){
 const raw=execFileSync('ps',['-axo','rss=,comm='],{encoding:'utf8'});
 let rss=0,count=0;
 for(const line of raw.split('\n')){
  const m=line.trim().match(/^(\d+)\s+(.*)$/);
  if(!m)continue;
  if(/(?:^|\/)ollama/.test(m[2])){rss+=Number(m[1])*1024;count+=1;}
 }
 return {ollamaRssBytes:count?rss:null,ollamaProcesses:count};
}

async function qwen(argv){
 if(!argv.includes('--opt-in'))throw Error('QWEN_REQUIRES_OPT_IN');
 const limitIndex=argv.indexOf('--limit');
 const limit=limitIndex>=0?Number(argv[limitIndex+1]):null;
 const dev=readJson(devSetPath);
 const {configuredLocalProvider,withRemoteNetworkGuard}=await import('../local-model/provider.js');
 const provider=configuredLocalProvider({env:process.env});
 await withRemoteNetworkGuard(async guard=>{
  const preflight=await provider.preflight();
  const warm=await provider.warmUp();
  const samples=[];
  const timer=setInterval(()=>{const s=sampleOllamaRss();samples.push({at:new Date().toISOString(),...s});},2000);
  const rows={};
  try{
   for(const p of (limit?dev.pairs.slice(0,limit):dev.pairs)){
    const start=performance.now();
    let raw=null,error=null,parsed=null;
    try{
     raw=await provider.analyzeEvidence({instructions,outputSchema,data:{claim:p.claim,evidence:p.evidence}},{signal:AbortSignal.timeout(60000)});
     parsed=parseOutput(raw);
    }catch(e){error=e.message;}
    rows[p.id]={relation:parsed?.relation??null,reason:parsed?.reason??null,raw,error,latencyMs:performance.now()-start};
    console.log(JSON.stringify({event:'qwen',id:p.id,relation:rows[p.id].relation,error,latencyMs:Math.round(rows[p.id].latencyMs)}));
   }
  }finally{clearInterval(timer);}
  const latencies=Object.values(rows).map(r=>r.latencyMs).sort((a,b)=>a-b);
  const rss=samples.map(s=>s.ollamaRssBytes).filter(Number.isFinite);
  writeJson(resolve(artifacts,'qwen-output.json'),{
   provider:provider.metadata,preflight,warm,
   instructionsHash:promptHash,
   calls:Object.keys(rows).length,
   medianLatencyMs:latencies[Math.floor(latencies.length/2)]??null,
   maxLatencyMs:latencies.at(-1)??null,
   rows,
   receipts:provider.receipts,
   remoteNetworkAttempts:guard.blocked(),
  });
  writeJson(resolve(artifacts,'qwen-resource.json'),{
   samples:samples.length,
   rssBytes:{first:rss[0]??null,peak:rss.length?Math.max(...rss):null,last:rss.at(-1)??null},
   raw:samples,
  });
 });
}

function loadArtifact(name){
 const p=resolve(artifacts,name);
 if(!existsSync(p))throw Error('MISSING_ARTIFACT: '+name);
 return readJson(p);
}

function evaluate(){
 const dev=readJson(devSetPath);
 const nliRaw=loadArtifact('nli-output.json');
 const qwenRaw=loadArtifact('qwen-output.json');
 const deterministic={};
 for(const p of dev.pairs){
  const d=deterministicRelation(p.claim,p.evidence);
  if(d)deterministic[p.id]=d;
 }
 const perPair=dev.pairs.map(p=>{
  const det=deterministic[p.id]??null;
  const n=nliRaw.pairs[p.id];
  const nliRow={minicheck:n.minicheck,mnli:n.mnli,latencyMs:n.latencyMs,relation:nliDecision({minicheck:n.minicheck,mnli:n.mnli},CALIBRATED_PARAMS)};
  const qwenRow=qwenRaw.rows[p.id]??null;
  const layered=layeredDecision({det,nliRow,qwenRow});
  const layeredNoQwen=layeredDecision({det,nliRow,qwenRow:null});
  return {id:p.id,expected:p.expected,category:p.category,det,nliRow,qwenRow,layered,layeredNoQwen};
 });
 const architecture=pick=>scoreRows(perPair.map(r=>({id:r.id,expected:r.expected,predicted:pick(r)})));
 const results={
  version:'claim-relation-spike-results/v1',
  ranAt:new Date().toISOString(),
  architectures:{
   'deterministic-only':architecture(r=>r.det?.relation??null),
   'nli-only':architecture(r=>r.nliRow.relation==='ABSTAIN'?null:r.nliRow.relation),
   'qwen-only':architecture(r=>r.qwenRow?.relation??null),
   'hybrid-no-qwen':architecture(r=>r.layeredNoQwen.relation),
   'hybrid-with-qwen':architecture(r=>r.layered.relation),
  },
  calibration:{policy:LAYERED_POLICY,devOnly:true,note:'Routing thresholds calibrated on the frozen spike dev set only, before the single Qwen run. Never applied to the historical locked 18.'},
  routing:perPair.reduce((acc,r)=>{const k=r.layered.decidedBy;acc[k]=(acc[k]||0)+1;return acc;},{}),
  perPair:perPair.map(r=>({id:r.id,expected:r.expected,category:r.category,deterministic:r.det?.relation??null,deterministicRule:r.det?.rule??null,nli:r.nliRow.relation,qwen:r.qwenRow?.relation??null,hybridWithQwen:r.layered.relation,decidedBy:r.layered.decidedBy,layerRule:r.layered.receipt?.rule??null,qwenReason:r.qwenRow?.reason??null,nliProbs:{entailment:Number(r.nliRow.mnli.entailment.toFixed(4)),neutral:Number(r.nliRow.mnli.neutral.toFixed(4)),contradiction:Number(r.nliRow.mnli.contradiction.toFixed(4)),minicheck:Number(r.nliRow.minicheck.toFixed(4))}})),
  bundles:dev.bundles.map(b=>{
   const relations=b.evidenceIds.map(id=>perPair.find(c=>c.id===id)?.layered.relation??null).filter(Boolean);
   return {id:b.id,expected:b.expected.aggregate,aggregate:aggregateBundle(relations),relations};
  }),
 };
 return writeJson(resolve(artifacts,'results.json'),results);
}

export {freeze,qwen,evaluate};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,...args]=process.argv.slice(2);
 try{
  if(mode==='freeze')console.log(freeze());
  else if(mode==='qwen'){await qwen(args);console.log('qwen run complete');}
  else if(mode==='evaluate')console.log(evaluate());
  else throw Error('Usage: cli.js freeze | qwen --opt-in | evaluate');
 }catch(e){console.error(e.stack);process.exitCode=1;}
}
