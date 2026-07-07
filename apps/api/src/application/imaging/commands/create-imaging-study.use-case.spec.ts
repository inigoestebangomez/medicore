// apps/api/src/application/imaging/commands/create-imaging-study.use-case.spec.ts
import { CreateImagingStudyUseCase } from './create-imaging-study.use-case';
import { InMemoryImagingStudyRepository } from './in-memory-imaging-study.repository';

describe('CreateImagingStudyUseCase', () => {
  let useCase: CreateImagingStudyUseCase;
  let imagingRepo: InMemoryImagingStudyRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'user-1';

  beforeEach(() => {
    imagingRepo = new InMemoryImagingStudyRepository();
    useCase = new CreateImagingStudyUseCase(imagingRepo);
  });

  const validCommand = {
    organizationId: orgId,
    patientId,
    type: 'CT_SCAN' as const,
    date: new Date(),
    createdBy: userId,
  };

  it('should create imaging study successfully with minimal data', async () => {
    const result = await useCase.execute(validCommand);

    expect(result).toBeDefined();
    expect(result.type).toBe('CT_SCAN');
    expect(result.patientId).toBe(patientId);
    expect(result.organizationId).toBe(orgId);
    expect(result.createdBy).toBe(userId);
    expect(result.files).toEqual([]);
  });

  it('should create imaging study with optional fields', async () => {
    const result = await useCase.execute({
      ...validCommand,
      description: 'CT scan of sinuses',
      surgeryId: 'surgery-1',
      consultationId: 'consultation-1',
      findings: 'No abnormalities detected',
    });

    expect(result.description).toBe('CT scan of sinuses');
    expect(result.surgeryId).toBe('surgery-1');
    expect(result.consultationId).toBe('consultation-1');
    expect(result.findings).toBe('No abnormalities detected');
  });

  it('should default optional fields to null/empty', async () => {
    const result = await useCase.execute(validCommand);

    expect(result.description).toBeNull();
    expect(result.surgeryId).toBeNull();
    expect(result.consultationId).toBeNull();
    expect(result.findings).toBeNull();
    expect(result.labels).toBeNull();
    expect(result.files).toEqual([]);
  });
});