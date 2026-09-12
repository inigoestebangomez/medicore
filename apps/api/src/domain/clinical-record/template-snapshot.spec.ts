// apps/api/src/domain/clinical-record/template-snapshot.spec.ts
// Tests for exam template versioning (spec §4):
// records pin template version; historical exams render with pinned snapshot.
import { describe, it, expect } from '@jest/globals';
import { PhysicalExamTemplate } from './physical-exam/physical-exam-template.entity';
import { PhysicalExamRecord } from './physical-exam/physical-exam-record.entity';

describe('Exam template versioning (spec §4)', () => {
  const v1Fields = [
    { key: 'nasal_obstruction', label: 'Nasal Obstruction', type: 'SELECT' as const, required: true, options: ['none', 'mild', 'moderate', 'severe'] },
    { key: 'polyps', label: 'Polyps', type: 'BOOLEAN' as const, required: false },
  ];

  const v2Fields = [
    { key: 'nasal_obstruction', label: 'Nasal Obstruction', type: 'SELECT' as const, required: true, options: ['none', 'mild', 'moderate', 'severe'] },
    { key: 'polyps', label: 'Polyps', type: 'BOOLEAN' as const, required: false },
    { key: 'septal_deviation', label: 'Septal Deviation', type: 'SELECT' as const, required: false, options: ['left', 'right', 'none'] },
  ];

  it('should create a template with version', () => {
    const template = new PhysicalExamTemplate({
      id: 'tpl-1',
      organizationId: 'org-1',
      specialty: 'ORL',
      version: 1,
      fields: v1Fields,
      publishedAt: new Date('2026-01-01'),
    });
    expect(template.version).toBe(1);
    expect(template.fields).toHaveLength(2);
  });

  it('should pin the template version in the record', () => {
    const record = new PhysicalExamRecord({
      id: 'rec-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      templateId: 'tpl-1',
      templateVersion: 1,
      templateSchemaSnapshot: v1Fields,
      values: { nasal_obstruction: 'moderate', polyps: false },
      customFindings: [],
      sourceType: 'manual',
      authorId: 'user-1',
      recordedAt: new Date('2026-06-01'),
      reviewState: 'UNREVIEWED',
    });
    expect(record.templateVersion).toBe(1);
  });

  it('should render historical exam with pinned snapshot even after template changes', () => {
    // Record created with v1 template
    const v1Record = new PhysicalExamRecord({
      id: 'rec-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      templateId: 'tpl-1',
      templateVersion: 1,
      templateSchemaSnapshot: v1Fields,
      values: { nasal_obstruction: 'moderate', polyps: false },
      customFindings: [],
      sourceType: 'manual',
      authorId: 'user-1',
      recordedAt: new Date('2026-06-01'),
      reviewState: 'UNREVIEWED',
    });

    // Template is now v2 with an additional field
    // The v1 record still uses the v1 snapshot
    expect(v1Record.templateSchemaSnapshot).toHaveLength(2);
    expect(v1Record.getSnapshotField('septal_deviation')).toBeUndefined();
    expect(v1Record.getSnapshotField('nasal_obstruction')).toBeDefined();
    expect(v1Record.getValue('nasal_obstruction')).toBe('moderate');
  });

  it('should support custom findings for non-predefined fields (spec §4)', () => {
    const record = new PhysicalExamRecord({
      id: 'rec-2',
      organizationId: 'org-1',
      patientId: 'patient-1',
      templateId: 'tpl-1',
      templateVersion: 1,
      templateSchemaSnapshot: v1Fields,
      values: { nasal_obstruction: 'mild' },
      customFindings: [
        { label: 'Unusual finding', value: 'Left turbinate hypertrophy' },
      ],
      sourceType: 'manual',
      authorId: 'user-1',
      recordedAt: new Date('2026-06-01'),
      reviewState: 'UNREVIEWED',
    });

    expect(record.hasCustomFindings).toBe(true);
    expect(record.customFindings).toHaveLength(1);
    expect(record.customFindings[0].label).toBe('Unusual finding');
  });

  it('should return required fields from template', () => {
    const template = new PhysicalExamTemplate({
      id: 'tpl-1',
      organizationId: 'org-1',
      specialty: 'ORL',
      version: 1,
      fields: v1Fields,
      publishedAt: new Date('2026-01-01'),
    });
    expect(template.requiredFields).toHaveLength(1);
    expect(template.requiredFields[0].key).toBe('nasal_obstruction');
  });
});
