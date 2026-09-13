import { assertSchema } from "./schema.js";
import { stableId, uniqueIndex } from "./identity.js";
export function normalizeSource(input) {
  const value = structuredClone(input);
  value.id = stableId("SRC", { subjectId: value.subjectId, publisher: value.publisher, documentKey: value.metadata?.documentKey });
  assertSchema("source", value);
  if (Date.parse(value.retrievedAt) < Date.parse(value.documentDate)) throw new Error("Source retrieved before publication");
  return value;
}
export function normalizeSources(inputs) {
  const sources = inputs.map(normalizeSource).sort((a, b) => a.id.localeCompare(b.id));
  uniqueIndex(sources, "source");
  return sources;
}
