// Query parsing for the FlowCredit Research Workbench (UI-2.0).
// Pure helpers only: normalize search text, validate filter/sort enums, clamp
// pagination, and rebuild safe same-origin return URLs.

export const CLAIM_SORTS = ['recent', 'oldest', 'category', 'status'];
export const EVIDENCE_SORTS = ['recent', 'oldest', 'category', 'page'];
export const LINK_FILTERS = ['linked', 'unlinked'];
export const REVIEW_FILTERS = ['reviewed', 'unreviewed'];

export const PAGE_SIZE = { claims: 25, evidence: 20 };

export function normalizeText(value, maxLength = 120) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function positiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function enumValue(value, allowed) {
  const candidate = normalizeText(value, 40);
  return allowed.includes(candidate) ? candidate : '';
}

export function parseClaimsQuery(searchParams) {
  return {
    q: normalizeText(searchParams.get('q')),
    category: normalizeText(searchParams.get('category'), 80),
    status: normalizeText(searchParams.get('status'), 80),
    subject: normalizeText(searchParams.get('subject'), 80),
    sort: enumValue(searchParams.get('sort'), CLAIM_SORTS) || 'recent',
    page: positiveInt(searchParams.get('page'), 1)
  };
}

export function parseEvidenceQuery(searchParams) {
  return {
    q: normalizeText(searchParams.get('q')),
    source: normalizeText(searchParams.get('source'), 120),
    link: enumValue(searchParams.get('link'), LINK_FILTERS),
    review: enumValue(searchParams.get('review'), REVIEW_FILTERS),
    subject: normalizeText(searchParams.get('subject'), 80),
    sort: enumValue(searchParams.get('sort'), EVIDENCE_SORTS) || 'recent',
    page: positiveInt(searchParams.get('page'), 1)
  };
}

export function pageCount(total, pageSize) {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginate(items, requestedPage, pageSize) {
  const total = items.length;
  const pages = pageCount(total, pageSize);
  const page = Math.min(Math.max(1, positiveInt(requestedPage, 1)), pages);
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    page,
    pages,
    pageSize,
    total,
    start: total === 0 ? 0 : start + 1,
    end: total === 0 ? 0 : start + slice.length,
    items: slice
  };
}

export function toQueryString(values = {}, { keep = [] } = {}) {
  const parts = [];
  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value === null || value === undefined) continue;
    if (key === 'page' && Number(value) <= 1 && !keep.includes('page')) continue;
    if (keep.includes(key) && (value === '' || value === null || value === undefined)) {
      parts.push(`${encodeURIComponent(key)}=`);
      continue;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// Beliefs is the product route. /claims remains accepted as a compatibility
// alias so historical links and benchmark artifacts keep working.
export const RETURN_ROUTES = ['/evidence', '/beliefs', '/claims'];

function isBeliefRoute(pathname) {
  return pathname === '/beliefs' || pathname === '/claims';
}

export function serializeIndexQuery(pathname, query = {}, demo = false) {
  const values = pathname === '/evidence'
    ? {
      q: query.q, source: query.source, link: query.link, review: query.review,
      subject: query.subject, sort: query.sort === 'recent' ? '' : query.sort, page: query.page
    }
    : {
      q: query.q, category: query.category, status: query.status,
      subject: query.subject, sort: query.sort === 'recent' ? '' : query.sort, page: query.page
    };
  if (demo) values.demo = '1';
  return toQueryString(values);
}

export function sanitizeReturnTo(value) {
  if (typeof value !== 'string') return '';
  if (value.length === 0 || value.length > 300) return '';
  const raw = value.trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '';
  let parsed;
  try {
    parsed = new URL(raw, 'http://127.0.0.1');
  } catch {
    return '';
  }
  if (parsed.origin !== 'http://127.0.0.1') return '';
  if (!RETURN_ROUTES.includes(parsed.pathname)) return '';
  const demo = parsed.searchParams.get('demo') === '1';
  const normalized = parsed.pathname === '/evidence'
    ? parseEvidenceQuery(parsed.searchParams)
    : parseClaimsQuery(parsed.searchParams);
  const canonicalPath = isBeliefRoute(parsed.pathname) ? '/beliefs' : parsed.pathname;
  return `${canonicalPath}${serializeIndexQuery(canonicalPath, normalized, demo)}`;
}
