// apps/api/src/infrastructure/storage/r2-storage.service.spec.ts
import { R2StorageService } from './r2-storage.service';

// Mock the AWS SDK client
const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((input: any) => input),
    CreateMultipartUploadCommand: jest.fn().mockImplementation((input: any) => input),
    UploadPartCommand: jest.fn().mockImplementation((input: any) => input),
    CompleteMultipartUploadCommand: jest.fn().mockImplementation((input: any) => input),
    DeleteObjectCommand: jest.fn().mockImplementation((input: any) => input),
    GetObjectCommand: jest.fn().mockImplementation((input: any) => input),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

describe('R2StorageService', () => {
  let service: R2StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new R2StorageService();
  });

  describe('upload', () => {
    it('should upload a small file via PutObject', async () => {
      mockSend.mockResolvedValue({ ETag: '"abc123"' });
      const buffer = Buffer.from('test data');

      const result = await service.upload('org-1/patient-1/imaging/test.png', buffer, { contentType: 'image/png' });

      expect(result.key).toBe('org-1/patient-1/imaging/test.png');
      expect(result.size).toBe(buffer.length);
      expect(result.etag).toBe('"abc123"');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadMultipart', () => {
    it('should upload a large file via multipart', async () => {
      // Create a buffer larger than chunk size for 2 parts
      const chunkSize = 1024; // Small for testing
      const buffer = Buffer.alloc(chunkSize * 2 + 100, 'x');

      mockSend
        .mockResolvedValueOnce({ UploadId: 'upload-123' }) // CreateMultipartUpload
        .mockResolvedValueOnce({ ETag: '"part1"' }) // UploadPart 1
        .mockResolvedValueOnce({ ETag: '"part2"' }) // UploadPart 2
        .mockResolvedValueOnce({ ETag: '"part3"' }) // UploadPart 3
        .mockResolvedValueOnce({ ETag: '"final"' }); // CompleteMultipartUpload

      const result = await service.uploadMultipart('org-1/large.dcm', buffer, {}, chunkSize);

      expect(result.key).toBe('org-1/large.dcm');
      expect(result.size).toBe(buffer.length);
    });
  });

  describe('getPresignedUrl', () => {
    it('should generate a presigned URL with default TTL of 15 minutes', async () => {
      const fakeUrl = 'https://r2.example.com/test?signed=abc';
      mockGetSignedUrl.mockResolvedValue(fakeUrl);

      const result = await service.getPresignedUrl('org-1/test.dcm');

      expect(result.url).toBe(fakeUrl);
      expect(result.expiresAt).toBeInstanceOf(Date);
      // ExpiresAt should be approximately 15 minutes from now
      const now = Date.now();
      const diff = result.expiresAt.getTime() - now;
      expect(diff).toBeGreaterThan(14 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(16 * 60 * 1000);
    });

    it('should use custom TTL when provided', async () => {
      const fakeUrl = 'https://r2.example.com/test?signed=abc';
      mockGetSignedUrl.mockResolvedValue(fakeUrl);

      await service.getPresignedUrl('org-1/test.dcm', 30);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 30 * 60 });
    });
  });

  describe('delete', () => {
    it('should delete an object from R2', async () => {
      mockSend.mockResolvedValue({});

      await service.delete('org-1/patient-1/imaging/test.png');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});