interface SNOT22Item {
  label: string;
  pre: number;   // 0-5 scale
  post: number;  // 0-5 scale
}

interface SNOT22ChartProps {
  data: SNOT22Item[];
  className?: string;
}

export function SNOT22Chart({ data, className = '' }: SNOT22ChartProps) {
  const maxScore = 5;
  const barMaxHeight = 120; // px

  return (
    <div className={`card-primary p-5 ${className}`}>
      <p className="label-clinical mb-4">SNOT-22 — Comparación Pre/Post</p>

      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            {/* Label */}
            <span className="w-36 text-xs text-on-surface-variant truncate text-right">
              {item.label}
            </span>

            {/* Bars */}
            <div className="flex-1 flex items-end gap-1" style={{ height: barMaxHeight }}>
              {/* PRE bar */}
              <div className="flex-1 flex flex-col items-center justify-end">
                <span className="text-[10px] text-on-surface-variant/60 mb-0.5 tabular-nums">
                  {item.pre}
                </span>
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${(item.pre / maxScore) * barMaxHeight}px`,
                    backgroundColor: '#0A8499', // aqua-600
                    minWidth: '24px',
                  }}
                />
                <span className="text-[10px] text-on-surface-variant/60 mt-0.5">PRE</span>
              </div>

              {/* POST bar */}
              <div className="flex-1 flex flex-col items-center justify-end">
                <span className="text-[10px] text-on-surface-variant/60 mb-0.5 tabular-nums">
                  {item.post}
                </span>
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${(item.post / maxScore) * barMaxHeight}px`,
                    backgroundColor: '#22C4DC', // aqua-400
                    minWidth: '24px',
                  }}
                />
                <span className="text-[10px] text-on-surface-variant/60 mt-0.5">POST</span>
              </div>
            </div>

            {/* Delta */}
            <span className={`w-10 text-xs text-right tabular-nums ${
              item.post < item.pre ? 'text-clinical-success' :
              item.post > item.pre ? 'text-clinical-critical' :
              'text-on-surface-variant/60'
            }`}>
              {item.post < item.pre ? '↓' : item.post > item.pre ? '↑' : '='}
              {Math.abs(item.pre - item.post)}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-outline-variant">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0A8499' }} />
          <span className="text-xs text-on-surface-variant">Pre-operatorio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#22C4DC' }} />
          <span className="text-xs text-on-surface-variant">Post-operatorio</span>
        </div>
      </div>
    </div>
  );
}
