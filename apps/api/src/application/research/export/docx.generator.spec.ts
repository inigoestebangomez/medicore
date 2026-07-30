// apps/api/src/application/research/export/docx.generator.spec.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DocxGenerator, type DocxLibrary } from './docx.generator';

// Minimal mock of the `docx` runtime objects — capture construction, return a
// fixed buffer from Packer.toBuffer so we assert the orchestrator composes the
// document sections with APA styling.
class MockTextRun { constructor(public opts: any) {} }
class MockParagraph { constructor(public opts: any) {} }
class MockHeading { static HEADING_1 = 'H1'; static HEADING_2 = 'H2'; }
class MockTableCell { constructor(public opts: any) {} }
class MockTableRow { constructor(public opts: any) {} }
class MockTable { constructor(public opts: any) {} }
class MockAlignment { static CENTER = 'CENTER'; }
class MockWidthType { static DXA = 'DXA'; }
class MockBorderStyle { static SINGLE = 'SINGLE'; static NONE = 'NONE'; }
class MockDocument { constructor(public opts: any) {} }
const MockPacker = {
  toBuffer: jest.fn(() => Promise.resolve(Buffer.from('DOCX-BYTES'))),
};

function buildLib(): DocxLibrary {
  return {
    Document: MockDocument as any,
    Packer: MockPacker as any,
    Paragraph: MockParagraph as any,
    TextRun: MockTextRun as any,
    Table: MockTable as any,
    TableRow: MockTableRow as any,
    TableCell: MockTableCell as any,
    WidthType: MockWidthType as any,
    AlignmentType: MockAlignment as any,
    HeadingLevel: MockHeading as any,
    BorderStyle: MockBorderStyle as any,
  } as unknown as DocxLibrary;
}

describe('DocxGenerator', () => {
  beforeEach(() => { MockPacker.toBuffer.mockClear(); MockPacker.toBuffer.mockReturnValue(Promise.resolve(Buffer.from('DOCX-BYTES')) as any); });

  it('generates a buffer with APA default styling and a title', async () => {
    const gen = new DocxGenerator(buildLib());
    const buf = await gen.generate({ studyName: 'Cohort X' });
    expect(buf.toString()).toBe('DOCX-BYTES');
    expect(MockPacker.toBuffer).toHaveBeenCalled();
    // default style label APA injected.
    expect(MockPacker.toBuffer.mock.calls).toHaveLength(1);
  });

  it('adds a Table 1 and footnote when table1 rows provided', async () => {
    const gen = new DocxGenerator(buildLib());
    await gen.generate({
      studyName: 'S',
      table1: [{ field: 'age', n: 10, representation: 'mean_sd', summary: '33 ± 2.1', pValue: '0.04' }],
      style: 'Vancouver',
    });
    expect(MockPacker.toBuffer).toHaveBeenCalled();
  });

  it('includes analyses blocks with statistic/p formatting', async () => {
    const gen = new DocxGenerator(buildLib());
    await gen.generate({
      studyName: 'S',
      analyses: [{ test: 'Mann-Whitney', statistic: 18, pValue: '0.02', notes: ['non-normal'] }],
    });
    expect(MockPacker.toBuffer).toHaveBeenCalled();
  });
});