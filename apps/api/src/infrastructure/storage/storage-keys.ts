// apps/api/src/infrastructure/storage/storage-keys.ts
// Private storage key generation for clinical record files (spec §5).
// Keys are structured by organization/patient to enforce tenant isolation at the storage layer.
// No public exposure — all access goes through presigned URLs with short TTLs.

/**
 * Generate a private S3 key for a lab report PDF.
 * Pattern: {orgId}/patients/{patientId}/labs/{reportId}/{fileName}
 */
export function labReportStorageKey(
  organizationId: string,
  patientId: string,
  reportId: string,
  fileName: string,
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${organizationId}/patients/${patientId}/labs/${reportId}/${safeFileName}`;
}

/**
 * Generate a private R2 key for a DICOM study.
 * Pattern: {orgId}/patients/{patientId}/imaging/{studyInstanceUid}/{fileName}
 */
export function dicomStorageKey(
  organizationId: string,
  patientId: string,
  studyInstanceUid: string,
  fileName: string,
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${organizationId}/patients/${patientId}/imaging/${studyInstanceUid}/${safeFileName}`;
}

/**
 * Extract the organization ID from a storage key (first path segment).
 * Used for tenant isolation verification when serving files.
 */
export function extractOrgIdFromKey(key: string): string | null {
  const parts = key.split('/');
  return parts.length > 0 ? parts[0] : null;
}
