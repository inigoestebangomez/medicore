// apps/web/src/components/research/ChartFooter.tsx
// Footer injected on every chart export (BR-RES-007): N, hypothesis test
// name, and α significance level. Renders as a small tabular-nums line so it
// composes below any chart (line / scatter / box / histogram / pie / BA / forest).

export interface ChartFooterProps {
  n: number;
  test?: string | null;
  alpha?: number;
  /** extra footnote, e.g. "Normalidad: Shapiro-Wilk p=0.42" */
  note?: string;
}

export function ChartFooter({ n, test, alpha = 0.05, note }: ChartFooterProps) {
  return (
    <div
      data-testid="chart-footer"
      className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-on-surface-variant"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      <span>N = {n}</span>
      {test && <span>Test: {test}</span>}
      <span>α = {alpha.toFixed(2)}</span>
      {note && <span className="text-on-surface-variant/80">· {note}</span>}
    </div>
  );
}

export default ChartFooter;