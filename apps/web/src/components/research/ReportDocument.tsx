'use client';

// apps/web/src/components/research/ReportDocument.tsx
// Shared React report template for the journal-quality PDF/PNG export
// (spec §6, design AD-4). APA / Vancouver styles, anonymized by construction
// (BR-RES-002 — only aggregated stats/tables/figures are passed in, never PHI)
// and N<5-suppressed (BR-RES-004): any cell with count < 5 renders as "<5".
//
// The backend PdfProcessor renders the same document shape to a 300 DPI PDF via
// Puppeteer; on the client this component drives the print/export preview and
// the PNG snapshot path (export-png.ts). Keeping a single template guarantees
// the on-screen preview and the exported artifact match.

import type { ExportV2Style } from '@medicore/contracts';

export interface ReportStat {
  field: string;
  n: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  ci95Lower: number | null;
  ci95Upper: number | null;
}
export interface ReportCategoryDist {
  field: string;
  categories: Array<{ label: string; count: number }>;
}
export interface ReportFigure {
  title: string;
  /** A data URI (PNG) captured from the on-screen chart, or null for a placeholder. */
  pngDataUri?: string | null;
  caption?: string;
}
export interface ReportCrossTab {
  rowField: string;
  colField: string;
  rows: string[];
  cols: string[];
  cells: Array<Array<{ count: number; suppressed: boolean }>>;
  chiSquareP: number | null;
  fisherExactP: number | null;
}
export interface ReportInferential {
  test: string;
  statistic: number | null;
  pValue: number | null;
  ci95Lower: number | null;
  ci95Upper: number | null;
  effectSize: { name: string; value: number | null } | null;
  warnings: string[];
}

export interface ReportDocumentProps {
  title: string;
  style: ExportV2Style;
  queryName?: string;
  generatedAt?: string;
  /** Cohort size (anonymized count). */
  n: number;
  stats: ReportStat[];
  distributions?: ReportCategoryDist[];
  figures?: ReportFigure[];
  crossTabs?: ReportCrossTab[];
  inferential?: ReportInferential[];
  /** Optional citation list (Vancouver) — pre-formatted strings. */
  references?: string[];
}

const SUPPRESSION_THRESHOLD = 5; // BR-RES-004

function fmt(v: number | null, digits = 2): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(digits);
}
function pValue(p: number | null): string {
  if (p === null || Number.isNaN(p)) return '—';
  if (p < 0.001) return '<0.001';
  return p.toFixed(3);
}

export function ReportDocument(props: ReportDocumentProps) {
  const {
    title, style, queryName, generatedAt, n, stats,
    distributions = [], figures = [], crossTabs = [], inferential = [], references = [],
  } = props;
  const when = generatedAt ?? new Date().toISOString();
  const styleLabel = style === 'vancouver' ? 'Vancouver' : 'APA';

  return (
    <article
      className="mx-auto max-w-[820px] bg-white px-10 py-12 text-[11pt] leading-relaxed text-neutral-900"
      style={{ fontFamily: "'Times New Roman', serif" }}
      data-testid="report-document"
    >
      <header className="border-b border-neutral-300 pb-4">
        <h1 className="text-[16pt] font-semibold">{title}</h1>
        {queryName && <p className="mt-1 text-[10pt] text-neutral-600">Cohort: {queryName} · N = {n.toLocaleString()}</p>}
        <p className="mt-1 text-[9pt] text-neutral-500">
          Generated {new Date(when).toLocaleString()} · {styleLabel} · Anonymized (BR-RES-002)
        </p>
      </header>

      {/* Abstract */}
      <section className="mt-4">
        <h2 className="text-[12pt] font-semibold">Abstract</h2>
        <p className="text-[10pt]">
          Retrospective cohort analysis of {n.toLocaleString()} anonymized records. Descriptive statistics and,
          where applicable, inferential tests are reported with 95% confidence intervals. Cells with N&lt;{SUPPRESSION_THRESHOLD}
          {' '}are suppressed per the institutional small-cell policy (BR-RES-004).
        </p>
      </section>

      {/* Results — descriptive stats */}
      {stats.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[12pt] font-semibold">Results — Descriptive statistics</h2>
          <table className="mt-2 w-full border-collapse text-[10pt]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="border-b border-neutral-400">
                <th className="p-1 text-left">Variable</th>
                <th className="p-1 text-right">n</th>
                <th className="p-1 text-right">Mean (95% CI)</th>
                <th className="p-1 text-right">Median</th>
                <th className="p-1 text-right">SD</th>
                <th className="p-1 text-right">Min</th>
                <th className="p-1 text-right">Max</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) =>
                s.n < SUPPRESSION_THRESHOLD ? (
                  <tr key={s.field} className="border-b border-neutral-200">
                    <td className="p-1">{s.field}</td>
                    <td className="p-1 text-right text-neutral-400" colSpan={6}>
                      &lt;{SUPPRESSION_THRESHOLD} (suppressed)
                    </td>
                  </tr>
                ) : (
                  <tr key={s.field} className="border-b border-neutral-200">
                    <td className="p-1">{s.field}</td>
                    <td className="p-1 text-right">{s.n}</td>
                    <td className="p-1 text-right">
                      {fmt(s.mean)} [{fmt(s.ci95Lower)}, {fmt(s.ci95Upper)}]
                    </td>
                    <td className="p-1 text-right">{fmt(s.median)}</td>
                    <td className="p-1 text-right">{fmt(s.stdDev)}</td>
                    <td className="p-1 text-right">{fmt(s.min, 0)}</td>
                    <td className="p-1 text-right">{fmt(s.max, 0)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Categorical distributions */}
      {distributions.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[12pt] font-semibold">Results — Categorical distributions</h2>
          <ul className="mt-1 space-y-3 text-[10pt]">
            {distributions.map((d) => {
              const small = d.categories.some((c) => c.count < SUPPRESSION_THRESHOLD);
              return (
                <li key={d.field}>
                  <strong>{d.field}</strong>
                  <ul className="mt-1 flex flex-wrap gap-3">
                    {d.categories.map((c) => (
                      <li key={c.label}>
                        {c.count < SUPPRESSION_THRESHOLD ? (
                          <span className="text-neutral-400">&lt;{SUPPRESSION_THRESHOLD}</span>
                        ) : (
                          <span>{c.label}: {c.count}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {small && <em className="text-neutral-500 text-[9pt]"> (algunas categorías &lt;{SUPPRESSION_THRESHOLD}: suprimidas)</em>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Inferential */}
      {inferential.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[12pt] font-semibold">Results — Inferential tests</h2>
          <ul className="mt-2 space-y-1 text-[10pt]">
            {inferential.map((it, i) => (
              <li key={i}>
                <strong>{it.test}</strong>: statistic = {fmt(it.statistic, 3)}, p = {pValue(it.pValue)},
                95% CI [{fmt(it.ci95Lower)}, {fmt(it.ci95Upper)}]
                {it.effectSize && it.effectSize.value !== null
                  ? `, ${it.effectSize.name} = ${fmt(it.effectSize.value, 3)}`
                  : ''}
                {it.warnings.length > 0 && <em className="text-neutral-600"> ({it.warnings.join('; ')})</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cross-tabs */}
      {crossTabs.map((ct, i) => (
        <section key={i} className="mt-6">
          <h2 className="text-[12pt] font-semibold">
            Table {i + 1}. {ct.rowField} × {ct.colField}
          </h2>
          <table className="mt-2 w-full border-collapse text-[10pt]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="border-b border-neutral-400">
                <th className="p-1 text-left">{ct.rowField}</th>
                {ct.cols.map((c) => (
                  <th key={c} className="p-1 text-right">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ct.rows.map((r, ri) => (
                <tr key={r} className="border-b border-neutral-200">
                  <td className="p-1">{r}</td>
                  {ct.cells[ri]?.map((cell, ci) => (
                    <td key={ci} className="p-1 text-right">
                      {cell.suppressed || cell.count < SUPPRESSION_THRESHOLD ? `<${SUPPRESSION_THRESHOLD}` : cell.count}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-neutral-600">
                <td className="p-1" colSpan={ct.cols.length + 1}>
                  χ² p = {pValue(ct.chiSquareP)}
                  {ct.fisherExactP !== null ? ` · Fisher p = ${pValue(ct.fisherExactP)}` : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      ))}

      {/* Figures */}
      {figures.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[12pt] font-semibold">Figures</h2>
          {figures.map((f, i) => (
            <figure key={i} className="mt-2 border border-neutral-200 p-2">
              {f.pngDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.pngDataUri} alt={f.title} className="mx-auto max-w-full" />
              ) : (
                <div className="flex h-32 items-center justify-center bg-neutral-50 text-[9pt] text-neutral-400">
                  [figure placeholder]
                </div>
              )}
              <figcaption className="mt-1 text-[9pt] text-neutral-600">
                Figure {i + 1}. {f.title}{f.caption ? ` ${f.caption}` : ''}
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      {references.length > 0 && style === 'vancouver' && (
        <section className="mt-6">
          <h2 className="text-[12pt] font-semibold">References</h2>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[9pt]">
            {references.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        </section>
      )}

      <footer className="mt-10 border-t border-neutral-300 pt-2 text-[8pt] text-neutral-400">
        MediCore Research Engine V2 — {styleLabel}. {n.toLocaleString()} anonymized records.
      </footer>
    </article>
  );
}

export default ReportDocument;