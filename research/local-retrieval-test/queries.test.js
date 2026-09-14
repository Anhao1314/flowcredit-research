import test from 'node:test';
import assert from 'node:assert/strict';
import {questionOf,periodLabel,answerTermsOf,assertQuestionHasNoAnswer,phraseOf} from '../local-retrieval/queries.js';

const annual={metric:'consolidated_revenue',category:'revenue',rawValue:5131,normalizedValue:5131000000,rawUnit:'USD_millions',periodStart:'2025-01-01',periodEnd:'2025-12-31',observedAt:'2025-12-31'};
const quarterly={metric:'cost_of_revenue',category:'compute_spend',rawValue:879,normalizedValue:879000000,rawUnit:'USD_millions',periodStart:'2026-04-01',periodEnd:'2026-06-30',observedAt:'2026-06-30'};
test('period labels are fiscal years and quarters when the range allows it',()=>{
 assert.equal(periodLabel(annual),'FY2025');
 assert.equal(periodLabel(quarterly),'Q2 2026');
 assert.equal(periodLabel({periodStart:'2026-01-01',periodEnd:'2026-03-31'}),'Q1 2026');
 assert.equal(periodLabel({periodEnd:'2026-06-30'}),'2026-06-30');
 assert.equal(periodLabel({}),'undated');
});
test('a question names subject, period and metric family without repeating words',()=>{
 const question=questionOf({expected:annual});
 assert.equal(question,'CoreWeave FY2025 consolidated revenue');
 assert.equal(questionOf({expected:quarterly}),'CoreWeave Q2 2026 cost of revenue compute spend');
 assert.equal(phraseOf('us_geographic_revenue'),'us geographic revenue');
});
test('a fiscal year is not mistaken for a percentage answer',()=>{
 const percent={metric:'significant_customer_share',category:'customer_concentration',rawValue:26,normalizedValue:26,rawUnit:'percent',periodStart:'2026-04-01',periodEnd:'2026-06-30',observedAt:'2026-06-30'};
 const question=questionOf({expected:percent});
 assert.equal(question,'CoreWeave Q2 2026 significant customer share concentration');
 assert.equal(assertQuestionHasNoAnswer(question,{expected:percent}),true);
 assert.throws(()=>assertQuestionHasNoAnswer(question+' 26 percent',{expected:percent}),/RETRIEVAL_QUERY_LEAKS_ANSWER/);
});
test('questions never carry the expected value, normalization or unit',()=>{
 const question=questionOf({expected:annual});
 for(const term of answerTermsOf({expected:annual}))if(!/usd|millions/.test(term))assert.ok(!question.toLowerCase().includes(term.toLowerCase()),term);
 assert.ok(!question.includes('5131'));
 assert.equal(assertQuestionHasNoAnswer(question,{expected:annual}),true);
 assert.throws(()=>assertQuestionHasNoAnswer('CoreWeave FY2025 revenue 5,131',{expected:annual}),/RETRIEVAL_QUERY_LEAKS_ANSWER/);
});
