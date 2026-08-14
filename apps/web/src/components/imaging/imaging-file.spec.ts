import { describe, expect, it } from 'vitest';
import {
  imagingFileKind,
  inferImagingMimeType,
  normalizeImagingFile,
  validateImagingFile,
} from './imaging-file';

describe('imaging file metadata', () => {
  it.each([
    ['scan.jpg', 'image/jpeg'],
    ['scan.jpeg', 'image/jpeg'],
    ['scan.png', 'image/png'],
    ['scan.webp', 'image/webp'],
    ['scan.dcm', 'application/dicom'],
    ['scan.dicom', 'application/dicom'],
    ['scan.mp4', 'video/mp4'],
    ['scan.mov', 'video/quicktime'],
    ['scan.pdf', 'application/pdf'],
    ['scan.zip', 'application/zip'],
  ])('infers MIME for %s', (name, expected) => {
    expect(inferImagingMimeType(name)).toBe(expected);
  });

  it('normalizes current metadata without creating a storage URL', () => {
    expect(normalizeImagingFile({
      key: 'org/patient/imaging/study/scan.png',
      originalName: 'scan.png',
      mimeType: 'image/png',
      size: 10,
    })).toEqual(expect.objectContaining({
      key: 'org/patient/imaging/study/scan.png',
      originalName: 'scan.png',
      mimeType: 'image/png',
      url: undefined,
    }));
  });

  it('normalizes legacy url/name metadata and infers its MIME', () => {
    expect(normalizeImagingFile({
      url: 'https://storage.example.test/scan.pdf',
      name: 'scan.pdf',
      size: 10,
    })).toEqual(expect.objectContaining({
      url: 'https://storage.example.test/scan.pdf',
      originalName: 'scan.pdf',
      mimeType: 'application/pdf',
      key: undefined,
    }));
  });

  it('classifies supported render capabilities and rejects unknown MIME', () => {
    expect(imagingFileKind('image/webp')).toBe('image');
    expect(imagingFileKind('application/pdf')).toBe('pdf');
    expect(imagingFileKind('video/quicktime')).toBe('video');
    expect(imagingFileKind('application/dicom')).toBe('dicom');
    expect(imagingFileKind('application/zip')).toBe('zip');
    expect(validateImagingFile({ name: 'bad.gif', type: 'image/gif', size: 1 })).toContain('Tipo no permitido');
  });
});
