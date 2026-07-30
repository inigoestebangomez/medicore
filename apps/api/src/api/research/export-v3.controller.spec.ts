// apps/api/src/api/research/export-v3.controller.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { ExportV3Controller } from './export-v3.controller';

function byVal<T>(value: T) { return jest.fn(() => Promise.resolve(value)); }

function build(stubs?: { exportHandler?: any; statusHandler?: any; downloadHandler?: any }) {
  return new ExportV3Controller(
    stubs?.exportHandler ?? { execute: jest.fn() },
    stubs?.statusHandler ?? { execute: jest.fn() },
    stubs?.downloadHandler ?? { execute: jest.fn() },
  );
}

describe('ExportV3Controller', () => {
  it('POST v3 rejects when studyName missing', async () => {
    const ctrl = build();
    await expect(ctrl.create({ formats: ['docx'] } as any)).rejects.toThrow();
  });

  it('POST v3 rejects when formats missing', async () => {
    const ctrl = build();
    await expect(ctrl.create({ studyName: 'S' } as any)).rejects.toThrow();
  });

  it('POST v3 delegates to the handler and returns {data: {jobId, ...}}', async () => {
    const exportHandler = { execute: byVal({ jobId: 'j-1', format: 'docx', filename: 's.docx' }) };
    const ctrl = build({ exportHandler });
    const res = await ctrl.create({ studyName: 'S', formats: ['docx'] });
    expect(exportHandler.execute).toHaveBeenCalledWith(expect.objectContaining({ studyName: 'S', formats: ['docx'] }));
    expect(res.data.jobId).toBe('j-1');
    expect(res.data.filename).toBe('s.docx');
  });

  it('GET v3/:jobId returns the status via the status handler', () => {
    const statusHandler = { execute: jest.fn(() => ({ jobId: 'j-1', status: 'done', filename: 'x.docx' })) };
    const ctrl = build({ statusHandler });
    const res = ctrl.status('j-1');
    expect(statusHandler.execute).toHaveBeenCalledWith('j-1');
    expect(res.data.status).toBe('done');
  });

  it('GET v3/:jobId/download returns the buffer with headers when job found', () => {
    const downloadHandler = {
      execute: jest.fn(() => ({ ok: true, buffer: Buffer.from('DATA'), filename: 'r.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })),
    };
    const setHeader = jest.fn();
    const send = jest.fn();
    const res = { setHeader, send } as any;
    const ctrl = build({ downloadHandler });
    ctrl.download('j-1', res, undefined);
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment'));
    expect(send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('GET v3/:jobId/download uses inline disposition when ?inline=1', () => {
    const downloadHandler = { execute: jest.fn(() => ({ ok: true, buffer: Buffer.from('DATA'), filename: 'r.docx', mimeType: 'image/tiff' })) };
    const setHeader = jest.fn();
    const send = jest.fn();
    const res = { setHeader, send } as any;
    const ctrl = build({ downloadHandler });
    ctrl.download('j-1', res, '1');
    expect(setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('inline'));
  });

  it('GET v3/:jobId/download throws NotFound when job missing', () => {
    const downloadHandler = { execute: jest.fn(() => ({ ok: false })) };
    const ctrl = build({ downloadHandler });
    expect(() => ctrl.download('missing', {} as any)).toThrow();
  });
});