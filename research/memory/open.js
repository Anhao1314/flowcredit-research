import { SQLiteBackend } from './sqlite-backend.js';
import { ResearchMemory } from './store.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const defaultDatabase=resolve(fileURLToPath(new URL('../../',import.meta.url)),'..','fc-agent','research-memory','memory.sqlite');
export function openMemory({filename=process.env.FC_RESEARCH_MEMORY_DB??defaultDatabase,clock}={}) { return new ResearchMemory(new SQLiteBackend(filename),{clock}); }
