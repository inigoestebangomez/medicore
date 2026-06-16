import type { CodeEntry } from './types';

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stemmedWords(description: string): Set<string> {
  const normalized = normalize(description);
  const words = normalized.split(/[\s,.-]+/).filter(Boolean);
  // Simple stemming: remove common suffixes and keep stems >= 3 chars
  const stems = new Set<string>();
  for (const word of words) {
    const w = word.replace(/(os|as|es|is|us|al|ar|er|ir|ica|ico|ica|ico|itis|osis|oma)$/, '');
    if (w.length >= 3) {
      stems.add(w);
    }
    stems.add(word);
  }
  return stems;
}

export function buildIndex(catalogs: CodeEntry[][]): Map<string, CodeEntry[]> {
  const index = new Map<string, CodeEntry[]>();

  for (const catalog of catalogs) {
    for (const entry of catalog) {
      const keys = new Set<string>();

      // Index by code prefixes
      const codeParts = entry.code.split('.');
      keys.add(entry.code.toLowerCase());
      for (let i = 1; i <= codeParts[0].length; i++) {
        keys.add(codeParts[0].slice(0, i).toLowerCase());
      }

      // Index by stemmed description words
      for (const word of stemmedWords(entry.description)) {
        keys.add(word);
      }

      for (const key of keys) {
        const list = index.get(key) ?? [];
        list.push(entry);
        index.set(key, list);
      }
    }
  }

  return index;
}
