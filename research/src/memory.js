import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { openMemory, defaultDatabase } from '../memory/open.js';
import { runAudit } from './coverage.js';

export function runMemoryCli(args,{clock}={}) {
  const [command,target,...flags]=args,options={};
  const allowed={ingest:['db'],claims:['db','as-of'],history:['db'],diff:['db','from','to'],provenance:['db','as-of','version'],stale:['db','at','max-age-days']};
  if(!allowed[command] || !target || target.startsWith('--'))throw new Error('Usage: memory.js ingest|claims|history|diff|provenance|stale TARGET [--db PATH] [command options]');
  for(let i=0;i<flags.length;i+=2) {
    const key=flags[i]?.replace(/^--/,'');
    if(!flags[i]?.startsWith('--') || !allowed[command].includes(key) || options[key]!==undefined || !flags[i+1] || flags[i+1].startsWith('--'))throw new Error('Invalid/missing/duplicate command option');
    options[key]=flags[i+1];
  }
  if(command==='diff' && (!options.from || !options.to))throw new Error('diff requires --from and --to');
  if(command==='stale' && (!options.at || !/^\d+$/.test(options['max-age-days']??'')))throw new Error('stale requires --at and --max-age-days');
  if(options.version && !/^[1-9]\d*$/.test(options.version))throw new Error('version must be a positive integer');
  const filename=options.db??process.env.FC_RESEARCH_MEMORY_DB??defaultDatabase;
  if(command!=='ingest' && (filename===':memory:' || !existsSync(filename))) throw new Error('Memory database does not exist; ingest first');
  const memory=openMemory({filename,clock});
  try {
    if(command==='ingest')return {subjectId:target,counts:memory.ingest(runAudit(target))};
    if(command==='claims')return {subjectId:target,claims:memory.getClaimsAsOf(target,options['as-of']??memory.now())};
    if(command==='history')return {claimId:target,history:memory.getClaimHistory(target)};
    if(command==='diff')return memory.diffClaims(target,{from:options.from,to:options.to});
    if(command==='stale')return {subjectId:target,revisions:memory.markStale(target,{evaluationDate:options.at,maxAgeDays:Number(options['max-age-days'])})};
    return memory.provenance(target,{asOf:options['as-of']??memory.now(),version:options.version?Number(options.version):undefined});
  } finally { memory.close(); }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(runMemoryCli(process.argv.slice(2)),null,2)); }
  catch(error) {console.error(error.message);process.exitCode=1;}
}
