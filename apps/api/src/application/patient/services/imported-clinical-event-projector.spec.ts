import { ImportedClinicalEventProjector } from './imported-clinical-event-projector';

describe('ImportedClinicalEventProjector', () => {
  const projector = new ImportedClinicalEventProjector();

  it('projects one merged event and keeps surviving values only', () => {
    const result = projector.project({
      'batch-1': {
        _rowIndices: [21, 22], _importedAt: '2026-01-03',
        diagnosis: 'surviving diagnosis', procedure: 'procedure',
        overwritten: 'latest value',
      },
    }, 'xlsx');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].rowIndices).toEqual([21, 22]);
    expect(result.items[0].rowGranularity).toBe('merged-block');
    expect(result.items[0].customFields).toEqual({ overwritten: 'latest value' });
  });

  it('projects legacy blocks and skips malformed or metadata-only values', () => {
    const result = projector.project({
      legacy: { diagnosis: 'legacy value' },
      empty: { _rowIndex: 2 },
      malformed: ['not a block'],
      scalar: 'not a block',
    }, 'csv');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].rowGranularity).toBe('legacy-block');
    expect(result.items[0].batchId).toBe('legacy');
  });

  it('uses the newest clinical/import date and stable semantic field order', () => {
    const result = projector.project({
      older: {
        _importedAt: '2026-03-01', admissionDate: '2026-03-04', diagnosis: 'older',
        patientName: 'Ana', customB: 'b', customA: 'a',
      },
      newer: {
        _importedAt: '2026-04-01', completionDate: '2026-04-03', diagnosis: 'newer',
      },
    }, 'xlsx');

    expect(result.items.map((item) => item.batchId)).toEqual(['newer', 'older']);
    expect(Object.keys(result.items[1].standardFields)).toEqual(['patientName', 'admissionDate', 'diagnosis']);
    expect(Object.keys(result.items[1].customFields)).toEqual(['customA', 'customB']);
  });

  it('keeps imported demographic fields in standard provenance', () => {
    const result = projector.project({ batch: {
      phone: '666111222', email: 'ana@example.com', bloodType: 'A_POS', notes: 'Importada',
    } }, 'csv');

    expect(result.items[0].standardFields).toEqual({
      phone: '666111222', email: 'ana@example.com', bloodType: 'A_POS', notes: 'Importada',
    });
  });

  it('keeps duration fields as standard imported values in semantic order', () => {
    const result = projector.project({ batch: {
      hospitalStayDays: 'tres días', surgeryDurationMinutes: 138, procedure: 'Septoplastia',
    } }, 'csv');

    expect(Object.keys(result.items[0].standardFields)).toEqual([
      'procedure', 'surgeryDurationMinutes', 'hospitalStayDays',
    ]);
  });

  it('classifies all consultation and surgery fields and hides audit marker data', () => {
    const result = projector.project({ batch: {
      consultationDate: '2026-01-01', consultationType: 'FOLLOW_UP', chiefComplaint: 'Dolor',
      currentIllness: 'Desde ayer', physicalExam: 'TA normal', assessment: 'Estable',
      diagnosisCodes: 'R51 pendiente', plan: 'Reposo', followUpDate: '2026-01-10', followUpNotes: 'Control',
      surgeryDate: '2026-01-02', surgeryStatus: 'COMPLETED', asa: 'ASA_II', anesthesiaType: 'General',
      technique: 'Endoscópica', findings: 'Sin hallazgos', complications: 'Ninguna', postOpNotes: 'Bien', outcome: 'Alta',
      importAuditLog: [{ action: 'IMPORT_MATERIALIZED' }], importedFields: { diagnosisCodes: 'hidden audit copy' },
    } }, 'csv');

    expect(Object.keys(result.items[0].standardFields)).toEqual([
      'consultationDate', 'consultationType', 'chiefComplaint', 'currentIllness', 'physicalExam', 'assessment',
      'diagnosisCodes', 'plan', 'followUpDate', 'followUpNotes', 'surgeryDate', 'surgeryStatus', 'asa',
      'anesthesiaType', 'technique', 'findings', 'complications', 'postOpNotes', 'outcome',
    ]);
    expect(result.items[0].customFields).toEqual({});
  });

  it('keeps birth-date estimation metadata out of custom fields', () => {
    const result = projector.project({ batch: {
      birthDate: '1976-01-01T00:00:00.000Z', birthDateEstimated: true, birthDateReferenceYear: 2026,
      customNote: 'visible custom value',
    } }, 'csv');

    expect(result.items[0].standardFields).toEqual({
      birthDate: '1976-01-01T00:00:00.000Z', birthDateEstimated: true, birthDateReferenceYear: 2026,
    });
    expect(result.items[0].customFields).toEqual({ customNote: 'visible custom value' });
  });

  it('reports truncation without exposing raw values when budgets are exceeded', () => {
    const result = projector.project({
      batch: { diagnosis: 'a'.repeat(2_001), safe: 'kept' },
    }, 'xlsx');
    expect(result.truncated).toBe(true);
    expect(result.items[0].customFields).not.toHaveProperty('diagnosis');
    expect(result.items[0].customFields).toHaveProperty('safe');
  });
});
