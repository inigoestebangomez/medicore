import { ImagingStudiesController } from './imaging-studies.controller';

describe('ImagingStudiesController', () => {
  it('returns 400 for an undefined study id without querying the repository', async () => {
    const imagingRepo = { findById: jest.fn() };
    const controller = new ImagingStudiesController(
      imagingRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      controller.get('patient-1', 'undefined', { organizationId: 'org-1' } as any),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 400,
        error: 'INVALID_IMAGING_STUDY_ID',
      }),
    });
    expect(imagingRepo.findById).not.toHaveBeenCalled();
  });
});
