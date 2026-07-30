// apps/api/src/application/research/export/spss-syntax.generator.ts
// Parallel to r-syntax.generator.ts — produces a `.sps` SPSS syntax file
// reproducing the analyses (M7). Maps performed-test → SPSS command:
//   ttest_independent → T-TEST GROUPS
//   mannwhitney       → NPAR TESTS /MANN-WHITNEY
//   chi_square        → CROSSTABS /STATISTICS=CHISQ
//   fisher_exact      → CROSSTABS /STATISTICS=CHISQ with Fisher requested
//   pearson/spearman  → CORRELATIONS / NONPAR CORR
//   linear_regression → REGRESSION
//   logistic_regression→ LOGISTIC REGRESSION
//   kaplan_meier      → KM (Survival analysis)
// Pure — no I/O.

import type { RSynRequestTest } from './r-syntax.generator';
export type { RSynRequestTest as SpssRequestTest } from './r-syntax.generator';

export interface SpssRequest {
  studyName?: string;
  tests: RSynRequestTest[];
}

const HEADER = (name: string | undefined) =>
  `* SPSS syntax -- Medicore research export.
* Study: ${name ?? '(unnamed)'}.
SET PRINTBACK=NONE.

`;

function cmd(t: RSynRequestTest): string {
  switch (t.test) {
    case 'ttest_independent':
      return `T-TEST GROUPS=${id(t.group1)}(0 1) /VARIABLES=${id(t.group2)} /MISSING=ANALYSIS.`;
    case 'mannwhitney':
      return `NPAR TESTS /MANN-WHITNEY=${id(t.xField)} BY ${id(t.group1)}(0 1).`;
    case 'chi_square':
      return `CROSSTABS TABLES=${id(t.group1)} BY ${id(t.group2)} /STATISTICS=CHISQ.`;
    case 'fisher_exact':
      return `CROSSTABS TABLES=${id(t.group1)} BY ${id(t.group2)} /STATISTICS=CHISQ /CELLS=COUNT EXPECTED.`;
    case 'kruskalwallis':
      return `NPAR TESTS /K-W=${id(t.xField)} BY ${id(t.group1)} (0 1 2).`;
    case 'pearson':
      return `CORRELATIONS /VARIABLES=${id(t.xField)}, ${id(t.yField)} /PRINT=TWOTAIL NOSIG.`;
    case 'spearman':
      return `NONPAR CORR /VARIABLES=${id(t.xField)}, ${id(t.yField)} /SPEARMAN.`;
    case 'linear_regression':
      return `REGRESSION /DEPENDENT=${id(t.yField)} /METHOD=ENTER ${id(t.xField)}.`;
    case 'logistic_regression':
      return `LOGISTIC REGRESSION VARIABLES=${id(t.yField)} /METHOD=ENTER ${id(t.xField)}.`;
    case 'kaplan_meier':
      return `KM ${id(t.timeField)} BY ${id(t.eventField)} /STATUS=${id(t.eventField)}(1) /PRINT TABLE.`;
    default:
      return `* unsupported: ${t.test}`;
  }
}

function id(s: string | undefined): string {
  if (!s) return 'x';
  const cleaned = String(s).replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  return cleaned || 'x';
}

export function generateSpssSyntax(req: SpssRequest): string {
  const body = req.tests.map((t, i) => `* Test ${i + 1}: ${t.test}.\n${cmd(t)}`).join('\n\n');
  return `${HEADER(req.studyName)}${body}\n`;
}