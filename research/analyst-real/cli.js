import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RetrievalIndex,defaultIndex} from '../retrieval/index.js';
import {ProposalStore} from '../analyst/store.js';
import {normalizeSource} from '../src/normalize-source.js';
import {parseDocument,byteHash} from '../retrieval/parser.js';
import {digest} from '../src/identity.js';
import {configuredProvider} from './provider.js';
import {controls} from './controls.js';
import {locked,evaluateReal,publicSummary} from './eval.js';
const repo=fileURLToPath(new URL('../../',import.meta.url));
export const defaultResults=resolve(repo,'..','fc-agent','research-analyst-real');
export function externalDirectory(path){const p=resolve(path);let a=p;while(!existsSync(a))a=dirname(a);const actual=resolve(realpathSync(a),relative(a,p)),r=relative(realpathSync(repo),actual);if(r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r)))throw Error('Results must be outside repository');mkdirSync(p,{recursive:true,mode:0o700});return p;}
export function claimsReader(path){if(!existsSync(path))throw Error('Existing Memory required for Claims protection proof');const db=new DatabaseSync(path,{readOnly:true});return {close:()=>db.close(),read:()=>{const rows=db.prepare("SELECT kind,id,payload,content_hash FROM records WHERE kind IN ('identity','revision') ORDER BY kind,id").all();return {claims:rows.filter(r=>r.kind==='identity').length,revisions:rows.filter(r=>r.kind==='revision').length,payloadHash:digest(rows)};}};}
export function buildControls(folder,clock=()=>new Date().toISOString()){
 const index=new RetrievalIndex(resolve(folder,'control-index.sqlite')),store=new ProposalStore(resolve(folder,'control-proposals.sqlite'));
 const cases=controls.map(c=>{const html='<p>'+c.text+'</p>',filename=resolve(folder,c.caseId+'.html');writeFileSync(filename,html,{mode:0o600});const at=clock();
 const source=normalizeSource({subjectId:'synthetic',sourceType:'official_announcement',title:'Strict constructed '+c.caseId,publisher:'Synthetic Publisher',url:'https://example.invalid/'+c.caseId,documentDate:'2026-01-01',retrievedAt:at,fiscalPeriod:'FY2025',fiscalYear:2025,isPrimarySource:true,contentHash:byteHash(Buffer.from(html)),metadata:{documentKey:c.caseId,hashStatus:'verified_bytes',hashScope:'document_bytes',retrievalNote:'Strict constructed v0.6 control',discoveryUrl:'https://example.invalid/'}});
 index.indexDocument(parseDocument({source,filename,format:'html',availability:{availableAt:'2026-01-01T00:00:00.000Z',basis:'Controlled synthetic availability',scope:'entire_document',firstPage:1},retrievedAt:at,createdAt:at}));const chunk=index.list('chunk').find(x=>x.sourceId===source.id);
 const facts=c.kind==='confusing'?[{rawValue:32,rawUnit:'USD_millions',unit:'USD',normalizedValue:32000000,category:'revenue',scope:'consolidated_company',periodStart:'2025-01-01',periodEnd:'2025-12-31',observedAt:'2025-12-31'}]:[];
 if(c.caseId==='CONF-01')facts.push({...facts[0],rawValue:40,normalizedValue:40000000,periodStart:'2026-01-01',periodEnd:'2026-12-31',observedAt:'2026-12-31'});
 // Only controlled revenue facts are independently adjudicated; additional literal facts are UNKNOWN.
 return {...c,index,store,subjectId:'synthetic',chunkId:chunk.id,references:facts.map((expected,n)=>({goldEvidenceId:c.caseId+'-'+n,expected,binding:'narrative'}))};});return {cases,close:()=>{store.close();index.close();}};
}
export async function runRealCli(args){const [command,target,...rest]=args;if(!['analyst-real-eval','analyst-case','analyst-failures'].includes(command)||!target)throw Error('Usage: cli.js analyst-real-eval coreweave --real true | analyst-case CASE_ID | analyst-failures RUN_ID');const options={};for(let n=0;n<rest.length;n+=2){const k=rest[n]?.slice(2);if(!rest[n]?.startsWith('--')||!['provider','real','index','memory','results'].includes(k)||options[k]!==undefined||!rest[n+1]||rest[n+1].startsWith('--'))throw Error('Invalid explicit option');options[k]=rest[n+1];}
 if(command==='analyst-case'){const c=locked.cases.find(c=>c.caseId===target)??controls.find(c=>c.caseId===target);if(!c)throw Error('Unknown case');return c;}
 if(command==='analyst-failures'){if(!/^REAL-\d+$/.test(target))throw Error('Invalid run ID');const r=JSON.parse(readFileSync(resolve(options.results??defaultResults,target+'.json')));return {runId:r.runId,metrics:r.metrics,failures:r.rows.filter(x=>x.errorClassification||x.GoldComparison.some(c=>c.classification!=='CORRECT'))};}
 if(target!=='coreweave')throw Error('Only locked CoreWeave benchmark supported');if(options.real!=='true')throw Error('Real calls require explicit --real true opt-in');
 const provider=configuredProvider({provider:options.provider??'deepseek'});if(!provider)return {status:'REAL_MODEL_BENCHMARK_BLOCKED',reason:'No configured real provider'};
 const root=externalDirectory(options.results??defaultResults),folder=externalDirectory(resolve(root,'session-'+Date.now())),index=new RetrievalIndex(options.index??defaultIndex);let store,control,memory;
 try{store=new ProposalStore(resolve(folder,'proposals.sqlite'));control=buildControls(folder);memory=claimsReader(options.memory??process.env.FC_RESEARCH_MEMORY_DB??resolve(repo,'..','fc-agent','research-memory','v0.2-coreweave.sqlite'));const full=await evaluateReal({index,store,provider,controlCases:control.cases,readClaimsSnapshot:memory.read});writeFileSync(resolve(root,full.runId+'.raw.json'),JSON.stringify(full,null,2),{mode:0o600});const summary=publicSummary(full);writeFileSync(resolve(root,full.runId+'.json'),JSON.stringify(summary,null,2),{mode:0o600});return summary;}finally{memory?.close();control?.close();store?.close();index.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await runRealCli(process.argv.slice(2)),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
