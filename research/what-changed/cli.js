#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runWhatChangedBatch} from './index.js';

export function runCli(argv=process.argv.slice(2)){
 const file=argv[0]??new URL('./fixtures/northstar-demo.json',import.meta.url);
 const raw=readFileSync(file,'utf8');
 const result=runWhatChangedBatch(JSON.parse(raw));
 return JSON.stringify(result,null,2);
}

const isMain=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isMain){
 try{process.stdout.write(runCli()+'\n');}
 catch(error){process.stderr.write((error?.stack??String(error))+'\n');process.exit(1);}
}
