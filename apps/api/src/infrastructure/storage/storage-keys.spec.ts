// apps/api/src/infrastructure/storage/storage-keys.spec.ts
// Unit tests for private storage key generation (spec §5).
// Verifies tenant isolation at the storage layer and no public exposure.

import { labReportStorageKey, dicomStorageKey, extractOrgIdFromKey } from './storage-keys';

describe('Storage Keys (spec §5 — private storage)', () => {
  it('generates a private S3 key for lab reports', () => {
    const key = labReportStorageKey('org-1', 'patient-1', 'report-1', 'hemograma.pdf');
    expect(key).toBe('org-1/patients/patient-1/labs/report-1/hemograma.pdf');
    expect(key.startsWith('org-1/')).toBe(true);
  });

  it('sanitizes file names in lab report keys', () => {
    const key = labReportStorageKey('org-1', 'patient-1', 'report-1', 'my file (1).pdf');
    expect(key).not.toContain(' ');
    expect(key).not.toContain('(');
    expect(key).toContain('my_file__1_.pdf');
  });

  it('generates a private R2 key for DICOM studies', () => {
    const key = dicomStorageKey('org-1', 'patient-1', '1.2.840.113619.2.280', 'study.dcm');
    expect(key).toBe('org-1/patients/patient-1/imaging/1.2.840.113619.2.280/study.dcm');
  });

  it('extracts org ID from storage key for tenant verification', () => {
    const key = 'org-1/patients/patient-1/labs/report-1/file.pdf';
    expect(extractOrgIdFromKey(key)).toBe('org-1');
  });

  it('returns null for empty keys', () => {
    expect(extractOrgIdFromKey('')).toBe('');
  });

  it('enforces tenant isolation — keys from different orgs are distinct', () => {
    const keyA = labReportStorageKey('org-A', 'patient-1', 'r1', 'lab.pdf');
    const keyB = labReportStorageKey('org-B', 'patient-1', 'r1', 'lab.pdf');
    expect(keyA).not.toBe(keyB);
    expect(extractOrgIdFromKey(keyA)).toBe('org-A');
    expect(extractOrgIdFromKey(keyB)).toBe('org-B');
  });
});
