// apps/api/src/application/research/export/export-v3.handler.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { ExportV3Handler } from './export-v3.handler';
import { ExportV3JobRegistry } from './export-v3.job-registry';

function byVal<T>(value: T) { return jest.fn(() => Promise.resolve(value)); }

function build(stubs?: { docx?: any; tiff?: any; zip?: any; registry?: ExportV3JobRegistry }) {
  const registry = stubs?.registry ?? new ExportV3JobRegistry();
  const handler = new ExportV3Handler(
    stubs?.docx ?? { generate: byVal(Buffer.from('DOCX')) },
    stubs?.tiff ?? { convert: byVal(Buffer.from('TIFF')) },
    stubs?.zip ?? { bundle: byVal(Buffer.from('ZIP')) },
    registry,
  );
  return { handler, registry };
}

describe('ExportV3Handler', () => {
  it('generates a single docx job when only docx requested', async () => {
    const { handler, registry } = build({ docx: { generate: byVal(Buffer.from('DOCX')) } });
    const res = await handler.execute({ studyName: 'S', formats: ['docx'], table1: [{ field: 'age', n: 5, representation: 'mean_sd', summary: '33 ± 2' }] });
    expect(res.format).toBe('docx');
    expect(res.filename).toMatch(/\.docx$/);
    const job = registry.get(res.jobId);
    expect(job?.status).toBe('done');
    expect(job?.buffer?.toString()).toBe('DOCX');
    expect(job?.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('generates R + SPSS syntax jobs from the tests list', async () => {
    const { handler, registry } = build();
    const res = await handler.execute({
      studyName: 'S', formats: ['r_syntax'],
      tests: ['ttest_independent', 'pearson'],
      testDetails: [{ test: 'ttest_independent', group1: 'a', group2: 'b' }, { test: 'pearson', xField: 'x', yField: 'y' }],
    });
    const buf = registry.get(res.jobId)?.buffer?.toString() ?? '';
    expect(buf).toContain('t.test(a, b');
    expect(buf).toContain('cor.test(x, y');
  });

  it('bundles multiple formats into a ZIP when format=zip', async () => {
    const zipBundle = jest.fn((pairs: any) => Promise.resolve(Buffer.from('ZIPPED:' + pairs.map((p: any) => p.filename).join(','))));
    const { handler, registry } = build({
      docx: { generate: byVal(Buffer.from('DOCX')) },
      tiff: { convert: byVal(Buffer.from('TIFF')) },
      zip: { bundle: zipBundle },
    });
    const res = await handler.execute({
      studyName: 'S', formats: ['zip'],
      table1: [{ field: 'age', n: 5, representation: 'mean_sd', summary: '33 ± 2' }],
      png: Buffer.from('PNG'),
      csv: 'a,b\n1,2',
      testDetails: [{ test: 'ttest_independent', group1: 'a', group2: 'b' }],
    });
    expect(res.format).toBe('zip');
    expect(res.filename).toMatch(/\.zip$/);
    expect(zipBundle).toHaveBeenCalled();
    const packed = registry.get(res.jobId)?.buffer?.toString() ?? '';
    expect(packed).toContain('table1.docx');
    expect(packed).toContain('figure.tiff');
    expect(packed).toContain('table.csv');
    expect(packed).toContain('analysis.R');
    expect(packed).toContain('analysis.sps');
  });

  it('throws when a requested format produces no artifact (missing input)', async () => {
    const { handler } = build();
    await expect(handler.execute({ studyName: 'S', formats: ['csv'] })).rejects.toThrow(/produced no artifact/);
  });
});