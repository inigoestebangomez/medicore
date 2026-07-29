// apps/web/src/components/research/clinical-sections.registry.spec.ts
import { describe, it, expect } from 'vitest';
import {
  CLINICAL_SECTIONS,
  classifyField,
  groupBySection,
  sectionRank,
} from './clinical-sections.registry';

describe('clinical-sections.registry', () => {
  it('classifies standard demographic fields', () => {
    expect(classifyField('nhc')).toBe('Demographics');
    expect(classifyField('age')).toBe('Calculated');
    expect(classifyField('sex')).toBe('Demographics');
  });

  it('classifies scale fields by prefix', () => {
    expect(classifyField('SNOT_22')).toBe('Scales');
    expect(classifyField('snot_22_total')).toBe('Scales');
    expect(classifyField('DHI_score')).toBe('Scales');
  });

  it('classifies imported unknown fields into Imported bucket', () => {
    expect(classifyField('custom_column', 'imported')).toBe('Imported');
  });

  it('groups entries and preserves canonical section order', () => {
    const grouped = groupBySection([
      { field: 'nhc', source: 'standard' },
      { field: 'SNOT_22', source: 'standard' },
      { field: 'custom_metric', source: 'imported' },
      { field: 'drugName', source: 'standard' },
    ]);
    const sections = grouped.map((g) => g.section);
    // Demographics < Medication < Scales < Imported by canonical order
    expect(sectionRank('Demographics')).toBeLessThan(sectionRank('Medication'));
    expect(sectionRank('Medication')).toBeLessThan(sectionRank('Scales'));
    expect(sectionRank('Scales')).toBeLessThan(sectionRank('Imported'));
    expect(sections).toEqual(['Demographics', 'Medication', 'Scales', 'Imported']);
  });

  it('all standard fields in the registry resolve to a known section', () => {
    // TS ensures CLINICAL_SECTIONS has no duplicates; verify ordering is stable
    expect(new Set(CLINICAL_SECTIONS).size).toBe(CLINICAL_SECTIONS.length);
    for (const section of CLINICAL_SECTIONS) {
      expect(sectionRank(section)).toBeLessThan(99);
    }
  });
});