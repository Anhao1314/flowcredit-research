// Unit tests for the pure query helpers (UI-1).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAIM_SORTS, EVIDENCE_SORTS, LINK_FILTERS, REVIEW_FILTERS, PAGE_SIZE,
  normalizeText, positiveInt, parseClaimsQuery, parseEvidenceQuery,
  pageCount, paginate, toQueryString, serializeIndexQuery, sanitizeReturnTo
} from '../surface/query.js';

const params = (value = '') => new URLSearchParams(value);

test('normalizeText collapses whitespace, trims and bounds length', () => {
  assert.equal(normalizeText('  Hello   World \t\n '), 'Hello World');
  assert.equal(normalizeText(null), '');
  assert.equal(normalizeText(undefined), '');
  assert.equal(normalizeText(123), '123');
  assert.equal(normalizeText('a'.repeat(500)).length, 120);
  assert.equal(normalizeText('a'.repeat(500), 8).length, 8);
});

test('positiveInt keeps positive integers and rejects everything else', () => {
  assert.equal(positiveInt('7'), 7);
  assert.equal(positiveInt('0'), 1);
  assert.equal(positiveInt('-3'), 1);
  assert.equal(positiveInt('abc'), 1);
  assert.equal(positiveInt(''), 1, 'default fallback applies for empty input');
  assert.equal(positiveInt('', 9), 9, 'custom fallback applies when provided');
  assert.equal(positiveInt(null, 4), 4);
});

test('parseClaimsQuery validates enums and clamps pagination', () => {
  const defaults = parseClaimsQuery(params(''));
  assert.deepEqual(defaults, { q: '', category: '', status: '', subject: '', sort: 'recent', page: 1 });
  const parsed = parseClaimsQuery(params('q=%20growth%20&category=top_customer_concentration&status=supported&subject=coreweave&sort=category&page=3'));
  assert.equal(parsed.q, 'growth');
  assert.equal(parsed.category, 'top_customer_concentration');
  assert.equal(parsed.status, 'supported');
  assert.equal(parsed.subject, 'coreweave');
  assert.equal(parsed.sort, 'category');
  assert.equal(parsed.page, 3);
  const invalid = parseClaimsQuery(params('sort=relevance&page=-4'));
  assert.equal(invalid.sort, 'recent', 'invalid sort falls back to default');
  assert.equal(invalid.page, 1, 'invalid page falls back to 1');
  for (const sort of CLAIM_SORTS) {
    assert.equal(parseClaimsQuery(params(`sort=${sort}`)).sort, sort);
  }
});

test('parseEvidenceQuery validates link and review filters', () => {
  const parsed = parseEvidenceQuery(params('q=revenue&source=SRC-1&link=unlinked&review=reviewed&sort=page&page=2'));
  assert.equal(parsed.q, 'revenue');
  assert.equal(parsed.source, 'SRC-1');
  assert.equal(parsed.link, 'unlinked');
  assert.equal(parsed.review, 'reviewed');
  assert.equal(parsed.sort, 'page');
  assert.equal(parsed.page, 2);
  const invalid = parseEvidenceQuery(params('link=maybe&review=probably&sort=fuzzy'));
  assert.equal(invalid.link, '');
  assert.equal(invalid.review, '');
  assert.equal(invalid.sort, 'recent');
  for (const link of LINK_FILTERS) assert.equal(parseEvidenceQuery(params(`link=${link}`)).link, link);
  for (const review of REVIEW_FILTERS) assert.equal(parseEvidenceQuery(params(`review=${review}`)).review, review);
  for (const sort of EVIDENCE_SORTS) assert.equal(parseEvidenceQuery(params(`sort=${sort}`)).sort, sort);
});

test('pageCount and paginate clamp at the boundaries', () => {
  assert.equal(pageCount(0, 20), 1);
  assert.equal(pageCount(20, 20), 1);
  assert.equal(pageCount(21, 20), 2);
  assert.equal(pageCount(-5, 20), 1);
  const items = Array.from({ length: 32 }, (_, index) => index + 1);
  const second = paginate(items, 2, 20);
  assert.equal(second.page, 2);
  assert.equal(second.pages, 2);
  assert.equal(second.start, 21);
  assert.equal(second.end, 32);
  assert.equal(second.items.length, 12);
  assert.equal(second.items[0], 21);
  const beyond = paginate(items, 99, 20);
  assert.equal(beyond.page, 2, 'page beyond the end falls back to the last page');
  const before = paginate(items, 0, 20);
  assert.equal(before.page, 1);
  const empty = paginate([], 5, PAGE_SIZE.evidence);
  assert.equal(empty.page, 1);
  assert.equal(empty.pages, 1);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
  assert.deepEqual(empty.items, []);
});

test('toQueryString omits defaults and empty values', () => {
  assert.equal(toQueryString({}), '');
  assert.equal(toQueryString({ q: '', category: '', page: 1 }), '');
  assert.equal(toQueryString({ q: 'growth' }), '?q=growth');
  assert.equal(toQueryString({ q: 'growth', page: 2 }), '?q=growth&page=2');
  assert.equal(toQueryString({ demo: '1' }), '?demo=1');
  assert.equal(toQueryString({ q: 'a b' }), '?q=a%20b');
});

test('query round trip preserves filters, page and demo mode in URLs', () => {
  const parsed = parseClaimsQuery(params('q=growth&category=cash_flow&sort=oldest&page=2&demo=1'));
  const url = `/claims${toQueryString({ q: parsed.q, category: parsed.category, sort: parsed.sort, page: parsed.page, demo: '1' })}`;
  assert.equal(url, '/claims?q=growth&category=cash_flow&sort=oldest&page=2&demo=1');
  const reparsed = parseClaimsQuery(params(new URL(url, 'http://x').search.slice(1)));
  assert.equal(reparsed.q, 'growth');
  assert.equal(reparsed.category, 'cash_flow');
  assert.equal(reparsed.sort, 'oldest');
  assert.equal(reparsed.page, 2);
  const evidence = parseEvidenceQuery(params('link=unlinked&review=reviewed&source=SRC-9&page=3'));
  const evidenceUrl = `/evidence${toQueryString({ link: evidence.link, review: evidence.review, source: evidence.source, page: evidence.page })}`;
  assert.equal(evidenceUrl, '/evidence?link=unlinked&review=reviewed&source=SRC-9&page=3');
});

test('serializeIndexQuery rebuilds canonical index URLs and drops defaults', () => {
  assert.equal(serializeIndexQuery('/evidence', { q: '', source: '', link: '', review: '', subject: '', sort: 'recent', page: 1 }), '');
  assert.equal(serializeIndexQuery('/evidence', { ...emptyEvidenceQuery(), link: 'linked', sort: 'page', page: 2 }), '?link=linked&sort=page&page=2');
  assert.equal(serializeIndexQuery('/evidence', { ...emptyEvidenceQuery(), link: 'linked' }, true), '?link=linked&demo=1');
  assert.equal(serializeIndexQuery('/claims', { q: 'revenue', category: '', status: 'supported', subject: '', sort: 'recent', page: 1 }, true), '?q=revenue&status=supported&demo=1');
});

test('sanitizeReturnTo keeps valid index context and rebuilds it canonically', () => {
  assert.equal(sanitizeReturnTo('/evidence'), '/evidence');
  assert.equal(sanitizeReturnTo('/evidence?link=linked&sort=page&page=2'), '/evidence?link=linked&sort=page&page=2');
  assert.equal(sanitizeReturnTo('/claims?q=customer&status=supported&page=3'), '/claims?q=customer&status=supported&page=3');
  assert.equal(sanitizeReturnTo('/evidence?demo=1&link=linked'), '/evidence?link=linked&demo=1');
  assert.equal(sanitizeReturnTo('/evidence?unknown=1&link=linked'), '/evidence?link=linked');
  assert.equal(sanitizeReturnTo('/evidence?link=evil'), '/evidence', 'unknown filter values are dropped, not echoed');
  assert.equal(sanitizeReturnTo('/evidence?page=0&page=-3'), '/evidence');
  assert.equal(sanitizeReturnTo('/evidence#section'), '/evidence', 'fragments are dropped');
  assert.equal(sanitizeReturnTo('/claims/../evidence?link=linked'), '/evidence?link=linked', 'same-origin normalization stays inside the whitelist');
});

test('sanitizeReturnTo rejects external, script, traversal and malformed values', () => {
  const rejected = [
    '//evil.com/evidence',
    '\\/\\/evil.com/evidence',
    'https://evil.com/evidence',
    'http://127.0.0.1/evidence',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/evidence/../../etc/passwd',
    '/../../etc/passwd',
    '/evidence/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '/claim/CLAIM-0001',
    '/company/coreweave',
    '/evidenceX',
    '/claims/',
    'evidence?link=linked',
    '',
    '   ',
    `/${'a'.repeat(320)}`
  ];
  for (const value of rejected) {
    assert.equal(sanitizeReturnTo(value), '', `expected rejection for ${JSON.stringify(value)}`);
  }
  assert.equal(sanitizeReturnTo(null), '');
  assert.equal(sanitizeReturnTo(undefined), '');
  assert.equal(sanitizeReturnTo(42), '');
  assert.equal(sanitizeReturnTo(['/evidence']), '');
  const longSearch = sanitizeReturnTo(`/evidence?q=${'a'.repeat(200)}`);
  assert.ok(longSearch.startsWith('/evidence'), 'over-long search text is bounded by normalizeText');
  assert.ok(longSearch.length < 140);
});

function emptyEvidenceQuery() {
  return { q: '', source: '', link: '', review: '', subject: '', sort: 'recent', page: 1 };
}
