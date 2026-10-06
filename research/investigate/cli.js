#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {investigatePair} from './loop.js';

const file=process.argv[2]??new URL('./fixtures/northstar-acceleration.json',import.meta.url);
const fixture=JSON.parse(readFileSync(file,'utf8'));
process.stdout.write(JSON.stringify(investigatePair(fixture),null,2)+'\n');
