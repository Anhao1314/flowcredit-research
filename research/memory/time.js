function day(value) {
  const d = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== value) throw new Error('Invalid calendar date');
}
export function instant(value, { query=false } = {}) {
  if (typeof value !== 'string') throw new Error('Explicit ISO time required');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (!query) throw new Error('Write times require ISO date-time');
    day(value); return value + 'T23:59:59.999Z';
  }
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) throw new Error('Invalid ISO date-time');
  day(value.slice(0,10));
  const ms=Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error('Invalid ISO date-time');
  return new Date(ms).toISOString();
}
export function visible(row, at) { return row.createdAt <= at && (!row.payload.effectiveAt || row.payload.effectiveAt <= at); }
export function requireAvailable(row, at, label) {
  if (!row || !visible(row,at)) throw new Error(`${label} unavailable at effectiveAt`);
}
