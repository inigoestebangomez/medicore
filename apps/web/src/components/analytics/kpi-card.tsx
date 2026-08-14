'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface KPICardProps {
  label: string;
  value: number;
  change?: number;        // percentage change (+ or -)
  changeLabel?: string;    // e.g. "Desde el trimestre anterior"
  icon?: ReactNode;       // decorative icon in top-right corner
  prefix?: string;        // e.g. "$", "€"
  suffix?: string;        // e.g. "%", "pacientes"
  className?: string;
}

export function KPICard({
  label,
  value,
  change,
  changeLabel,
  icon,
  prefix = '',
  suffix = '',
  className = '',
}: KPICardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.round(eased * value));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [value]);

  const formatted = new Intl.NumberFormat('es-ES').format(displayValue);
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className={`card-primary p-5 relative overflow-hidden ${className}`}>
      {/* Label */}
      <p className="label-clinical mb-3">{label}</p>

      {/* Value + change */}
      <div className="flex items-end gap-3 mb-1">
        <span className="text-4xl font-bold text-on-surface tracking-tight tabular-nums">
          {prefix}{formatted}{suffix}
        </span>
        {change !== undefined && (
          <span className={`text-sm font-medium mb-1.5 ${
            isPositive ? 'text-clinical-success' :
            isNegative ? 'text-clinical-critical' :
            'text-on-surface-variant'
          }`}>
            {isPositive ? '↑' : isNegative ? '↓' : ''} {Math.abs(change)}%
          </span>
        )}
      </div>

      {changeLabel && (
        <p className="text-xs text-on-surface-variant/60">{changeLabel}</p>
      )}

      {/* Decorative icon */}
      {icon && (
        <div className="absolute -right-3 -top-3 w-20 h-20 text-aqua-500/[0.08] pointer-events-none">
          {icon}
        </div>
      )}

      {/* Featured gradient border via pseudo-element */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: 'linear-gradient(160deg, rgba(14,165,192,0.4) 0%, rgba(255,255,255,0.08) 40%, transparent 80%)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
        }}
      />
    </div>
  );
}
