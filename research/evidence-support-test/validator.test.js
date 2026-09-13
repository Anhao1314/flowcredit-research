import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFactV2,assertionWindow,periodWithSourceContext} from '../evidence-support/validator.js';
import {tableSupportFromSpan,freezeSupport} from '../evidence-support/support.js';
import {fixture,tableSpanFor} from './fixtures.js';

const explicit={actualOrGuidance:'actual',explicitOrDerived:'explicit',rawValueText:null,rawUnitText:null,periodText:null};
test('a verified table cell fact validates with deterministic value, unit and period',()=>fixture(({workspace})=>{
 const found=tableSpanFor(workspace,span=>span.cellText.replace(/[^0-9,]/g,'')==='2,575');
 const support=freezeSupport(tableSupportFromSpan(found.span,found.table));
 const result=validateFactV2(support,{...explicit,metricOrCategory:'revenue',metric:'consolidated_revenue'});
 assert.equal(result.status,'validated',JSON.stringify(result.findings));
 assert.equal(result.parse.numeric.normalizedValue,2575000000);
 assert.equal(result.parse.numeric.rawUnit,'USD_millions');
 assert.equal(result.parse.period.end,'2025-12-31');
 assert.equal(result.parse.period.start,'2025-01-01');
}));
test('derived and judgment metric table facts are rejected',()=>fixture(({workspace})=>{
 const found=tableSpanFor(workspace,span=>span.cellText.replace(/[^0-9,]/g,'')==='2,575');
 const support=freezeSupport(tableSupportFromSpan(found.span,found.table));
 assert.deepEqual(validateFactV2(support,{...explicit,metricOrCategory:'revenue',metric:'x',explicitOrDerived:'derived'}).findings,['DERIVED_NOT_ADMISSIBLE']);
 assert.deepEqual(validateFactV2(support,{...explicit,metricOrCategory:'revenue',metric:'risk_grade'}).findings,['FORBIDDEN_JUDGMENT']);
}));
test('guidance cues inside a table row label require a guidance fact',()=>{
 const support={type:'table',cellText:'2,575',rowLabel:'Expected revenue',headerPath:['Year Ended December 31,','2025'],unitContext:{match:'(in millions)',scale:'millions',currency:'USD'}};
 const result=validateFactV2(support,{...explicit,metricOrCategory:'revenue',metric:'revenue'});
 assert.ok(result.findings.includes('ACTUAL_GUIDANCE_ERROR'));
 const asGuidance=validateFactV2(support,{...explicit,metricOrCategory:'guidance',metric:'guidance',actualOrGuidance:'guidance'});
 assert.ok(!asGuidance.findings.includes('ACTUAL_GUIDANCE_ERROR'));
});
test('a sentence fact is validated by exact text, unit and period binding',()=>{
 const support={type:'text',text:'Revenue for the year ended December 31, 2025 was $3.2 billion, an increase of 168%.'};
 const result=validateFactV2(support,{actualOrGuidance:'actual',explicitOrDerived:'explicit',rawValueText:'$3.2',rawUnitText:'billion',periodText:'year ended December 31, 2025',metricOrCategory:'revenue',metric:'revenue'});
 assert.equal(result.status,'validated',JSON.stringify(result.findings));
 assert.equal(result.parse.numeric.normalizedValue,3200000000);
 assert.equal(result.parse.period.start,'2025-01-01');
 assert.equal(result.parse.period.end,'2025-12-31');
});
test('missing value, unit or period text fails exactly',()=>{
 const support={type:'text',text:'Revenue for the year ended December 31, 2025 was $3.2 billion.'};
 const missingValue=validateFactV2(support,{actualOrGuidance:'actual',explicitOrDerived:'explicit',rawValueText:'$9.9',rawUnitText:'billion',periodText:'year ended December 31, 2025',metricOrCategory:'revenue',metric:'revenue'});
 assert.ok(missingValue.findings.includes('VALUE_ERROR'));
 const missingUnit=validateFactV2(support,{actualOrGuidance:'actual',explicitOrDerived:'explicit',rawValueText:'$3.2',rawUnitText:'trillion',periodText:'year ended December 31, 2025',metricOrCategory:'revenue',metric:'revenue'});
 assert.ok(missingUnit.findings.includes('UNIT_ERROR'));
 const missingPeriod=validateFactV2(support,{actualOrGuidance:'actual',explicitOrDerived:'explicit',rawValueText:'$3.2',rawUnitText:'billion',periodText:'year ended December 31, 2024',metricOrCategory:'revenue',metric:'revenue'});
 assert.ok(missingPeriod.findings.includes('PERIOD_ERROR'));
});
test('guidance before or immediately after the value is rejected as actual',()=>{
 const before={type:'text',text:'We expect revenue of $50 million in the next quarter.'};
 assert.ok(validateFactV2(before,{actualOrGuidance:'actual',explicitOrDerived:'explicit',rawValueText:'$50',rawUnitText:'million',periodText:'next quarter',metricOrCategory:'revenue',metric:'revenue'}).findings.includes('ACTUAL_GUIDANCE_ERROR'));
 const after={type:'text',text:'Revenue of $50 million is expected next quarter.'};
 assert.ok(validateFactV2(after,{actualOrGuidance:'actual',explicitOrDerived:'explicit',rawValueText:'$50',rawUnitText:'million',periodText:null,metricOrCategory:'revenue',metric:'revenue'}).findings.includes('ACTUAL_GUIDANCE_ERROR'));
});
test('a recognition clause after the value does not make an as-of balance guidance',()=>{
 const support={type:'text',text:'As of June 30, 2026, the Company had $103.7 billion of unsatisfied RPO, of which 41% was expected to be recognized over the initial 24 months.'};
 const result=validateFactV2(support,{actualOrGuidance:'actual',explicitOrDerived:'explicit',rawValueText:'$103.7',rawUnitText:'billion',periodText:'June 30, 2026',metricOrCategory:'backlog_rpo',metric:'unsatisfied_rpo'});
 assert.equal(result.status,'validated',JSON.stringify(result.findings));
 assert.equal(result.parse.period.end,'2026-06-30');
});
test('risk disclosure with a numeric value is rejected',()=>{
 const support={type:'text',text:'The interest rate sensitivity could change results by $30 million for the period.'};
 const result=validateFactV2(support,{actualOrGuidance:'risk_disclosure',explicitOrDerived:'explicit',rawValueText:'$30',rawUnitText:'million',periodText:null,metricOrCategory:'risk_factors',metric:'sensitivity'});
 assert.ok(result.findings.includes('ACTUAL_GUIDANCE_ERROR'));
});
test('bare dates use source as-of context only when the sentence states it',()=>{
 assert.equal(periodWithSourceContext('As of June 30, 2026, the Company had $103.7 billion.','June 30, 2026').status,'known');
 assert.equal(periodWithSourceContext('The Company had $103.7 billion on June 30, 2026.','June 30, 2026').status,'unknown');
 assert.equal(periodWithSourceContext('As of June 30, 2026, the Company had $103.7 billion.','as of June 30, 2026').status,'known');
});
test('the assertion window is bounded and cut at clause boundaries',()=>{
 const window=assertionWindow('We had $5 million. We expect revenue of $9 million in the quarter.','$9');
 assert.ok(!/expect/.test(window.before.slice(0,window.before.lastIndexOf('.'))));
 const clause=assertionWindow('Revenue grew; we expect $9 million next quarter.','$9');
 assert.ok(/expect/.test(clause.before));
 const trailing=assertionWindow('Revenue was $9 million; guidance remains withdrawn.','$9');
 assert.ok(!/guidance/.test(trailing.after));
});
