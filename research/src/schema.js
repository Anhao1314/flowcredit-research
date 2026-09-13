import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Reuse only the repository's locked validation toolchain, never its server/engine.
const require = createRequire(new URL("../../agent/package.json", import.meta.url));
const Ajv2020 = require("ajv/dist/2020.js");
const addFormats = require("ajv-formats");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
export function readJson(url) { return JSON.parse(readFileSync(url, "utf8")); }
export const schemas = Object.fromEntries(["source", "evidence", "claim", "mapping"].map(name => [name, readJson(new URL(`../schemas/${name}.schema.json`, import.meta.url))]));
const validators = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]));
export function assertSchema(name, value) {
  const validate = validators[name];
  if (!validate) throw new Error(`Unknown schema: ${name}`);
  if (!validate(value)) throw new Error(`${name} schema: ${ajv.errorsText(validate.errors, { separator: "; " })}`);
  return value;
}
export const contract = readJson(new URL("../../agent/contracts/finch-assess-input.schema.json", import.meta.url));
const fieldValidators = new Map();
export function acceptsField(field, value) {
  if (!Object.hasOwn(contract.$defs.draft.properties, field)) throw new Error(`Unknown FlowCredit field: ${field}`);
  if (!fieldValidators.has(field)) {
    fieldValidators.set(field, ajv.compile({ $schema: contract.$schema, $defs: contract.$defs, ...contract.$defs.draft.properties[field] }));
  }
  return fieldValidators.get(field)(value);
}
