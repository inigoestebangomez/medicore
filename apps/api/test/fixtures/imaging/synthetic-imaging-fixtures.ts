/**
 * Synthetic, PHI-free payloads for imaging tests only.
 * This module creates buffers and never connects to Postgres or storage.
 */

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

export const SYNTHETIC_IMAGING_FIXTURES = [
  { name: 'synthetic.png', mimeType: 'image/png', buffer: tinyPng },
  { name: 'synthetic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
  { name: 'synthetic.webp', mimeType: 'image/webp', buffer: Buffer.from('RIFF0000WEBP', 'ascii') },
  { name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% synthetic test fixture\n', 'ascii') },
  { name: 'synthetic.mp4', mimeType: 'video/mp4', buffer: Buffer.from('000000186674797069736f6d', 'hex') },
  { name: 'synthetic.mov', mimeType: 'video/quicktime', buffer: Buffer.from('000000146674797071742020', 'hex') },
  { name: 'synthetic.zip', mimeType: 'application/zip', buffer: Buffer.from('504b05060000000000000000000000000000', 'hex') },
  {
    name: 'synthetic.dcm',
    mimeType: 'application/dicom',
    buffer: Buffer.concat([Buffer.alloc(128), Buffer.from('DICM', 'ascii')]),
  },
] as const;
