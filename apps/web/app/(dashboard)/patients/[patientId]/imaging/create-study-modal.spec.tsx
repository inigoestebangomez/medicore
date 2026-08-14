import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/hooks/useImagingStudies', () => ({
  useCreateImagingStudy: () => ({ mutateAsync: mocks.create }),
  uploadImagingFiles: mocks.upload,
}));

import { CreateStudyModal } from './create-study-modal';

describe('CreateStudyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'study-123' });
    mocks.upload.mockResolvedValue({ studyId: 'study-123', filesAdded: 1, files: [] });
  });

  it('uses the unwrapped created study id for the follow-up upload', async () => {
    const onClose = vi.fn();
    render(<CreateStudyModal patientId="patient-123" onClose={onClose} />);
    const input = screen.getByLabelText('Archivos (opcional)');
    const file = new File(['png'], 'scan.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear y subir' }));

    await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
    expect(mocks.upload.mock.calls[0][0]).toBe('patient-123');
    expect(mocks.upload.mock.calls[0][1]).toBe('study-123');
    expect(mocks.upload.mock.calls[0][1]).not.toBe('undefined');
    expect(onClose).toHaveBeenCalled();
  });
});
