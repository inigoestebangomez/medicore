import { UnprocessableEntityException } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';

function file(name: string, mimetype: string, size = 1024) {
  return { originalname: name, mimetype, size, buffer: Buffer.alloc(0) } as Express.Multer.File;
}

describe('FileValidationPipe', () => {
  it.each([
    ['image/jpeg', 'scan.jpg'],
    ['image/png', 'scan.png'],
    ['image/webp', 'scan.webp'],
    ['application/dicom', 'scan.dcm'],
    ['video/mp4', 'scan.mp4'],
    ['video/quicktime', 'scan.mov'],
    ['application/pdf', 'report.pdf'],
    ['application/zip', 'export.zip'],
  ])('accepts the supported %s format', (mimeType, name) => {
    expect(new FileValidationPipe().transform(file(name, mimeType))).toHaveLength(1);
  });

  it('returns actionable MIME error details', () => {
    try {
      new FileValidationPipe().transform(file('scan.gif', 'image/gif'));
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual(expect.objectContaining({
        error: 'INVALID_MIME_TYPE',
        message: expect.stringContaining('image/gif'),
        details: [expect.objectContaining({ fileName: 'scan.gif' })],
      }));
    }
  });

  it('returns actionable size error details', () => {
    try {
      new FileValidationPipe().transform(file('large.pdf', 'application/pdf', 26 * 1024 * 1024));
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual(expect.objectContaining({
        error: 'FILE_TOO_LARGE',
        details: [expect.objectContaining({ fileName: 'large.pdf', maxSize: 25 * 1024 * 1024 })],
      }));
    }
  });
});
