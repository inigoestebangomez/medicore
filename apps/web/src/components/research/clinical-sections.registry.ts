// apps/web/src/components/research/clinical-sections.registry.ts
// Static map: field → clinical section (M1). Groups discovered fields into
// clinically meaningful categories so the field discovery popover and table-1
// builder can render collapsible sections.
//
// Sections: Demographics, Diagnoses, Surgery, Consultations, Medication,
// Scales, Imaging, Imported, Calculated.

export type ClinicalSection =
  | 'Demographics'
  | 'Diagnoses'
  | 'Surgery'
  | 'Consultations'
  | 'Medication'
  | 'Scales'
  | 'Imaging'
  | 'Imported'
  | 'Calculated';

export const CLINICAL_SECTIONS: ClinicalSection[] = [
  'Demographics',
  'Diagnoses',
  'Surgery',
  'Consultations',
  'Medication',
  'Scales',
  'Imaging',
  'Imported',
  'Calculated',
];

const SECTION_ORDER = new Map(CLINICAL_SECTIONS.map((s, i) => [s, i]));

/** Direct standard-field → section mapping. */
const FIELD_TO_SECTION: Record<string, ClinicalSection> = {
  nhc: 'Demographics',
  firstName: 'Demographics',
  lastName: 'Demographics',
  birthDate: 'Demographics',
  sex: 'Demographics',
  age: 'Calculated',
  bloodType: 'Demographics',
  importSource: 'Demographics',
  createdAt: 'Demographics',
  // Diagnoses
  assessment: 'Diagnoses',
  diagnosisCodes: 'Diagnoses',
  // Surgery
  procedureType: 'Surgery',
  surgeryDate: 'Surgery',
  asa: 'Surgery',
  anesthesiaType: 'Surgery',
  outcome: 'Surgery',
  complications: 'Surgery',
  // Consultations
  chiefComplaint: 'Consultations',
  currentIllness: 'Consultations',
  physicalExam: 'Consultations',
  plan: 'Consultations',
  followUpDate: 'Consultations',
  // Medication
  drugName: 'Medication',
  dosage: 'Medication',
  frequency: 'Medication',
  // Scales
  SNOT_22: 'Scales',
  VAS_TINNITUS: 'Scales',
  DHI: 'Scales',
  VHI: 'Scales',
  RSI: 'Scales',
  OSA_EPWORTH: 'Scales',
  STOPBANG: 'Scales',
  NOSE: 'Scales',
  total: 'Scales',
  // Imaging
  ImagingStudyType: 'Imaging',
  findings: 'Imaging',
};

/** Heuristic: classify a field name into a clinical section. */
export function classifyField(field: string, source?: 'standard' | 'imported'): ClinicalSection {
  // Direct hit
  if (FIELD_TO_SECTION[field]) return FIELD_TO_SECTION[field];

  // Scale-type detection (scale field keys typically start with the scale name)
  const upper = field.toUpperCase();
  for (const scale of ['SNOT_22', 'VAS_TINNITUS', 'DHI', 'VHI', 'RSI', 'OSA_EPWORTH', 'STOPBANG', 'NOSE']) {
    if (upper.startsWith(scale)) return 'Scales';
  }
  if (/surgery|procedurf?e|asa|anesthesia/i.test(field)) return 'Surgery';
  if (/diagnos|assessment|icd|snomed/i.test(field)) return 'Diagnoses';
  if (/consult|chief|illness|exam|plan|follow/i.test(field)) return 'Consultations';
  if (/med|drug|dosis|dosage|prescription/i.test(field)) return 'Medication';
  if (/imaging|tac|mr|rx|endoscopy|audiogram|ct_scan|mri|xray/i.test(field)) return 'Imaging';
  if (/^age$/i.test(field) || field === 'age') return 'Calculated';

  // Imported fields that don't match any clinical keyword → Imported bucket
  if (source === 'imported') return 'Imported';
  return 'Imported';
}

/** Group entries by clinical section, preserving section order. */
export function groupBySection<T extends { field: string; source?: string }>(
  entries: T[],
): Array<{ section: ClinicalSection; entries: T[] }> {
  const buckets = new Map<ClinicalSection, T[]>();
  for (const entry of entries) {
    const section = classifyField(entry.field, entry.source as 'standard' | 'imported' | undefined);
    const arr = buckets.get(section) ?? [];
    arr.push(entry);
    buckets.set(section, arr);
  }
  return CLINICAL_SECTIONS.filter((s) => buckets.has(s)).map((section) => ({
    section,
    entries: buckets.get(section)!,
  }));
}

/** Sort sections in canonical clinical order. */
export function sectionRank(section: ClinicalSection): number {
  return SECTION_ORDER.get(section) ?? 99;
}