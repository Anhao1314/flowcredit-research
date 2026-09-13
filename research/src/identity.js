import { createHash } from "node:crypto";
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function digest(value) { return `sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`; }
export function stableId(prefix, value) { return `${prefix}-${digest(value).slice(7, 31)}`; }
export function uniqueIndex(items, label) {
  const index = new Map();
  for (const item of items) {
    if (index.has(item.id)) throw new Error(`Duplicate ${label}: ${item.id}`);
    index.set(item.id, item);
  }
  return index;
}
