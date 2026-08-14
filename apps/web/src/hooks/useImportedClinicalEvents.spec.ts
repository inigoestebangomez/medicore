import { buildImportedClinicalEventsUrl } from './useImportedClinicalEvents';

describe('useImportedClinicalEvents', () => {
  it('builds the first request with the bounded page size', () => {
    expect(buildImportedClinicalEventsUrl('patient-synthetic')).toBe('/v1/patients/patient-synthetic/imported-events?pageSize=50');
  });

  it('adds the opaque cursor only for subsequent pages', () => {
    expect(buildImportedClinicalEventsUrl('patient-synthetic', 'opaque.cursor')).toBe('/v1/patients/patient-synthetic/imported-events?pageSize=50&cursor=opaque.cursor');
  });
});
