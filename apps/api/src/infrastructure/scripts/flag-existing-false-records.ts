// apps/api/src/infrastructure/scripts/flag-existing-false-records.ts
// Read-only operator script (SDD import-data-quality T-08). Queries existing
// patients, runs the shared FalseRecordDetectorService against each patient's
// stored name, and writes a CSV report of flagged rows to var/reports/.
//
// This script NEVER deletes or mutates patient records — it only reports.
// Run via: pnpm --filter @medicore/api exec ts-node src/infrastructure/scripts/flag-existing-false-records.ts

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { FalseRecordDetectorService } from '@/application/import/services/false-record-detector.service';

const detector = new FalseRecordDetectorService();

export interface PatientNameRecord {
  id: string;
  nhc: string;
  firstName: string;
  lastName: string;
}

export interface FlaggingResult {
  patientId: string;
  nhc: string;
  isFalse: boolean;
  reasons: string[];
}

/**
 * Classify a single existing patient record against the false-record name
 * rules. Pure (no I/O) so it is trivially unit-testable; the script wires it
 * to Prisma and the CSV writer.
 */
export function classifyExistingPatient(record: PatientNameRecord): FlaggingResult {
  const fullName = `${record.firstName} ${record.lastName}`.trim();
  const cleaned: Record<string, unknown> = { name: fullName };
  const columnMap = new Map<string, string>([['name', 'name']]);
  const detection = detector.detect(cleaned, columnMap);
  return {
    patientId: record.id,
    nhc: record.nhc,
    isFalse: detection.isFalse,
    reasons: detection.reasons,
  };
}

function toCsv(results: FlaggingResult[]): string {
  const flagged = results.filter((r) => r.isFalse);
  const header = 'id,nhc,reasons';
  const rows = flagged.map((r) =>
    [r.patientId, r.nhc, `"${r.reasons.join('; ').replace(/"/g, '""')}"`].join(','),
  );
  return [header, ...rows].join('\n');
}

/**
 * Query existing patients via the provided Prisma client, classify each, and
 * write a CSV of flagged rows to outDir. Returns the full classification list.
 */
export async function flagExistingFalseRecords(
  prisma: { patient: { findMany: (args: any) => Promise<PatientNameRecord[]> } },
  outDir: string = join(process.cwd(), 'var', 'reports'),
): Promise<FlaggingResult[]> {
  const patients = await prisma.patient.findMany({
    select: { id: true, nhc: true, firstName: true, lastName: true },
  });
  const results = patients.map(classifyExistingPatient);

  mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(outDir, `flagged-false-records-${ts}.csv`), toCsv(results));
  return results;
}

// CLI entry — only runs when invoked directly.
async function main() {
  // Lazy import so the unit tests don't require a real Prisma connection.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const results = await flagExistingFalseRecords(prisma);
    const flagged = results.filter((r) => r.isFalse);
    // eslint-disable-next-line no-console
    console.log(`Flagged ${flagged.length} of ${results.length} patients as false records (CSV in var/reports/).`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}