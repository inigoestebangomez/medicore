// apps/api/src/application/research/export/docx.generator.ts
// Generates a `.docx` Word document (M7) with APA/Vancouver formatting using
// the `docx` npm package: Times New Roman 12pt, double spacing, table footnotes.
// Receives Table 1 rows, optional comparison-table data and analysis results.
// The library is imported lazily inside the method so unit tests can mock the
// `docx` module without loading the native bundle.

import type { Logger } from '@nestjs/common';

export interface DocxTable1Row {
  field: string;
  n: number;
  representation: string;
  summary: string; // formatted "33 ± 2.1" or "33 [30-36]" or categorical "yes: 4 (66.7%)"
  pValue?: string;
}

export interface DocxAnalysisBlock {
  test: string;
  statistic: number | null;
  pValue: string | null;
  notes?: string[];
}

export type CitationStyle = 'APA' | 'Vancouver';

export interface DocxRequest {
  studyName: string;
  table1?: DocxTable1Row[];
  comparison?: { groupBy: string; rows: DocxTable1Row[] };
  analyses?: DocxAnalysisBlock[];
  style?: CitationStyle;
}

export type DocxLibrary = typeof import('docx');

export class DocxGenerator {
  constructor(
    /** injected for testability; in production the real `docx` module */
    private readonly lib: DocxLibrary,
    private readonly log?: Pick<Logger, 'log' | 'warn'>,
  ) {}

  async generate(req: DocxRequest): Promise<Buffer> {
    const {
      Document, Packer, Paragraph, TextRun,
      AlignmentType, HeadingLevel,
    } = this.lib;
    const style = req.style ?? 'APA';

    const children: any[] = [];
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: req.studyName, font: 'Times New Roman', size: 24 })],
    }));
    children.push(new Paragraph({
      spacing: { line: 480, after: 200 }, // double spacing (240 = single)
      children: [new TextRun({ text: `Citation style: ${style}`, font: 'Times New Roman', size: 24 })],
    }));

    if (req.table1 && req.table1.length > 0) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'Table 1', font: 'Times New Roman', size: 24 })],
      }));
      children.push(buildTable(this.lib, ['Variable', 'N', 'Summary', 'p'], req.table1));
      children.push(new Paragraph({
        spacing: { line: 360 },
        children: [new TextRun({ text: "Footnote: continuous variables reported as mean ± SD or median [IQR]; categorical as n (%).", italics: true, font: 'Times New Roman', size: 20 })],
      }));
    }

    if (req.comparison) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `Comparison by ${req.comparison.groupBy}`, font: 'Times New Roman', size: 24 })],
      }));
      children.push(buildTable(this.lib, ['Variable', 'N', 'Summary', 'p'], req.comparison.rows));
    }

    if (req.analyses && req.analyses.length > 0) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'Analyses', font: 'Times New Roman', size: 24 })],
      }));
      for (const a of req.analyses) {
        children.push(new Paragraph({
          spacing: { line: 480 },
          children: [new TextRun({
            text: `${a.test}: statistic=${a.statistic ?? '—'}, p=${a.pValue ?? '—'}`,
            font: 'Times New Roman', size: 24,
          })],
        }));
        if (a.notes?.length) {
          for (const note of a.notes) {
            children.push(new Paragraph({
              spacing: { line: 360 },
              children: [new TextRun({ text: note, italics: true, font: 'Times New Roman', size: 20 })],
            }));
          }
        }
      }
    }

    const doc = new Document({
      styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
      sections: [{ properties: {}, children }],
    });
    const buf = await Packer.toBuffer(doc);
    this.log?.log?.(`docx generated (${buf.length} bytes)`);
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
  }
}

function buildTable(lib: DocxLibrary, header: string[], rows: DocxTable1Row[]): any {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType } = lib;
  const cell = (text: string, bold = false) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, font: 'Times New Roman', size: 22 })] })],
    width: { size: bold ? 2000 : 3000, type: WidthType.DXA },
  });
  const headerRow = new TableRow({ children: header.map((h) => cell(h, true)) });
  const bodyRows = rows.map((r) => new TableRow({ children: [
    cell(r.field), cell(String(r.n)), cell(r.summary), cell(r.pValue ?? '—'),
  ] }));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
    borders: noBordersIf(lib, false),
  });
}

/** Solid 1pt borders on every cell — APA table styling. */
function noBordersIf(lib: DocxLibrary, _none: boolean) {
  return {
    top: { style: lib.BorderStyle.SINGLE, size: 4 },
    bottom: { style: lib.BorderStyle.SINGLE, size: 4 },
    left: { style: lib.BorderStyle.SINGLE, size: 4 },
    right: { style: lib.BorderStyle.SINGLE, size: 4 },
  };
}