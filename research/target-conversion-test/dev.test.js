import test from 'node:test';
import assert from 'node:assert/strict';
import {runDev} from '../target-conversion/dev.js';
test('independent offline target-conversion fixture matrix',async()=>{const report=await runDev();assert.equal(report.passed,true);assert.equal(report.cases,21);assert.equal(report.modelCalls,0);});
