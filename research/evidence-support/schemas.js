import {readFileSync} from 'node:fs';
export const interpretationSchema=JSON.parse(readFileSync(new URL('../analyst-staged/interpretation-output.schema.json',import.meta.url),'utf8'));
