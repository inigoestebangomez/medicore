// apps/api/src/application/research/export/guided-text.generator.ts
// Generates a plain-text representation of a guided analysis result.
// Used for text export and as the text layer inside PDF generation.

import type { GuidedAnalysisResult } from '@medicore/contracts';

export interface GuidedTextRequest {
  result: GuidedAnalysisResult;
  title?: string;
}

export function generateGuidedText(req: GuidedTextRequest): string {
  const { result, title } = req;
  const lines: string[] = [];

  // Header
  lines.push(title ?? 'Guided Statistical Analysis Report');
  lines.push('='.repeat(50));
  lines.push('');

  // Cohort context
  lines.push(`Cohort: query ${result.cohort.queryId}`);
  lines.push(`Sample size: n=${result.cohort.n}`);
  lines.push(`Path: ${result.path}`);
  lines.push('');

  // Rationale
  if (result.rationale.length > 0) {
    lines.push('Analysis rationale:');
    for (const r of result.rationale) {
      lines.push(`  • ${r}`);
    }
    lines.push('');
  }

  // Descriptive summaries
  if (result.summaries.length > 0) {
    lines.push('Descriptive summaries:');
    lines.push('-'.repeat(40));
    for (const s of result.summaries) {
      lines.push(`  ${s.variable} (${s.kind})`);
      lines.push(`    n=${s.n}, missing=${s.missing}`);
      if (s.suppressed) {
        lines.push(`    [SUPPRESSED: ${s.suppressReason}]`);
      } else if (s.kind === 'quantitative') {
        lines.push(`    Mean=${s.mean} ± ${s.sd}`);
        lines.push(`    Median=${s.median} [${s.q1}–${s.q3}]`);
        lines.push(`    Range: ${s.min}–${s.max}`);
      } else {
        for (const cat of s.categories) {
          lines.push(`    ${cat.label}: ${cat.count} (${cat.percent}%)`);
        }
      }
      lines.push('');
    }
  }

  // Inferential results
  if (result.results.length > 0) {
    lines.push('Inferential results:');
    lines.push('-'.repeat(40));
    for (const r of result.results) {
      lines.push(`  Test: ${r.test}`);
      if (r.variable) lines.push(`  Variable: ${r.variable}`);
      lines.push(`  Statistic: ${r.statistic ?? '—'}`);
      lines.push(`  p-value: ${r.pValue !== null ? r.pValue.toFixed(4) : '—'}`);

      if (r.effectMeasures.length > 0) {
        lines.push('  Effect measures:');
        for (const em of r.effectMeasures) {
          if (em.suppressed) {
            lines.push(`    ${em.name}: [SUPPRESSED — ${em.suppressReason ?? 'unsafe cells'}]`);
          } else {
            const ci = em.ci95Lower !== null && em.ci95Upper !== null
              ? ` [95% CI: ${em.ci95Lower.toFixed(3)}–${em.ci95Upper.toFixed(3)}]`
              : '';
            lines.push(`    ${em.name}: ${em.value?.toFixed(3)}${ci}`);
          }
        }
      }

      if (r.groups.length > 0) {
        lines.push(`  Groups: ${r.groups.map((g) => `${g.key} (n=${g.n})`).join(', ')}`);
      }
      lines.push('');
    }
  }

  // Corrections
  if (result.corrections.length > 0) {
    lines.push('Multiple comparison corrections:');
    for (const c of result.corrections) {
      lines.push(`  ${c.method.toUpperCase()}: original p=${c.originalP?.toFixed(4) ?? '—'} → adjusted p=${c.adjustedP?.toFixed(4) ?? '—'}`);
      if (c.label) lines.push(`    ${c.label}`);
    }
    lines.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const w of result.warnings) {
      lines.push(`  ⚠ [${w.code}] ${w.message}`);
      if (w.suggestion) lines.push(`    Suggestion: ${w.suggestion}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('─'.repeat(50));
  lines.push('Note: p-values are presented as a convention, not as a standalone');
  lines.push('clinical decision rule. Clinical interpretation requires context.');
  lines.push('');

  return lines.join('\n');
}
