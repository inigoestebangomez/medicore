import type { CodeEntry, CodeSystem } from './types';
import { buildIndex } from './build-index';
import { icd10Catalog } from './catalogs/icd10';

export const ORL_CODES: CodeEntry[] = [...icd10Catalog];

const codeIndex: Map<string, CodeEntry[]> = buildIndex([icd10Catalog]);

const codeMap = new Map<string, CodeEntry>();
for (const entry of icd10Catalog) {
  codeMap.set(`${entry.system}:${entry.code}`, entry);
}

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchCodes(query: string): CodeEntry[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const q = normalize(query.trim());
  const lowerCode = q.toLowerCase();

  const seen = new Set<string>();
  const results: CodeEntry[] = [];

  function add(entry: CodeEntry) {
    const key = `${entry.system}:${entry.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(entry);
    }
  }

  const exactMatches = codeIndex.get(lowerCode);
  if (exactMatches) {
    for (const entry of exactMatches) {
      if (entry.code.toLowerCase().startsWith(lowerCode)) {
        add(entry);
      }
    }
  }

  const words = q.split(/[\s,.-]+/).filter(Boolean);
  for (const word of words) {
    const matches = codeIndex.get(word);
    if (matches) {
      for (const entry of matches) {
        const normDesc = normalize(entry.description);
        if (normDesc.includes(word)) {
          add(entry);
        }
      }
    }
  }

  return results;
}

export function validateCode(system: CodeSystem, code: string): boolean {
  return codeMap.has(`${system}:${code}`);
}

export function getByCode(system: CodeSystem, code: string): CodeEntry | undefined {
  return codeMap.get(`${system}:${code}`);
}

export function listByChapter(chapter: string): CodeEntry[] {
  return icd10Catalog.filter((entry) => entry.chapter === chapter);
}
