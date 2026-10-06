#!/usr/bin/env node
import {runRealityBenchmark} from './benchmark.js';
process.stdout.write(JSON.stringify(runRealityBenchmark(),null,2)+'\n');
