export type CodeSystem = 'ICD10' | 'SNOMED';

export interface CodeEntry {
  system: CodeSystem;
  code: string;
  description: string;
  chapter: string;
  parentCode?: string;
}

export interface SearchResult {
  exact: CodeEntry[];
  prefix: CodeEntry[];
  contains: CodeEntry[];
}
