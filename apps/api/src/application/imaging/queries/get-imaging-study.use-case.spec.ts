import { GetImagingStudyUseCase } from './get-imaging-study.use-case';

describe('GetImagingStudyUseCase', () => {
  it('rejects an undefined id before repository lookup', async () => {
    const imagingRepo = { findById: jest.fn() };
    const useCase = new GetImagingStudyUseCase(imagingRepo as any);

    await expect(useCase.execute({ id: 'undefined', organizationId: 'org-1' })).rejects.toMatchObject({
      code: 'INVALID_IMAGING_STUDY_ID',
    });
    expect(imagingRepo.findById).not.toHaveBeenCalled();
  });
});
