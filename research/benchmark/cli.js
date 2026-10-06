#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {loadBenchmark} from './schema.js';
import {scoreBenchmark,evaluateGate} from './evaluate.js';

export function run(argv=process.argv.slice(2)){
 const benchmarkPath=argv[0]??new URL('./data/real-sec-pilot-v0.1.json',import.meta.url);
 const gatePath=argv[1]??new URL('./phase-gate-v0.2a.json',import.meta.url);
 const benchmark=loadBenchmark(benchmarkPath);
 const gate=JSON.parse(readFileSync(gatePath,'utf8'));
 const result=scoreBenchmark(benchmark);
 return {...result,phaseGate:evaluateGate(result,gate)};
}
const isMain=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isMain)process.stdout.write(JSON.stringify(run(),null,2)+'\n');
