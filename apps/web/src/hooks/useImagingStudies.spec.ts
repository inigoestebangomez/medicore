import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadImagingFiles } from './useImagingStudies';
import { unwrapApiData } from '@/lib/api-fetch';

describe('imaging API response handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps the global data envelope', () => {
    expect(unwrapApiData({ data: { id: 'study-123' } })).toEqual({ id: 'study-123' });
    expect(unwrapApiData({ id: 'study-123' })).toEqual({ id: 'study-123' });
  });

  it('uploads against the provided study id and unwraps the upload response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { studyId: 'study-123', filesAdded: 1, files: [] } }), { status: 200 }),
    );

    const result = await uploadImagingFiles('patient-123', 'study-123', new FormData());

    expect(result.studyId).toBe('study-123');
    expect(fetchMock.mock.calls[0][0]).toBe('/v1/patients/patient-123/imaging/study-123/files');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/undefined/');
  });

  it('fails before fetch when a study id is undefined', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(uploadImagingFiles('patient-123', 'undefined', new FormData())).rejects.toThrow('estudio válido');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
