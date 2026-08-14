import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from './lib/utils';

/* ── Badge ──
   Clinical Precision: pill-shaped status indicators using the new
   aqua/zinc signal palette. Glass-tinted backgrounds so badges sit
   comfortably on glassmorphism cards without bleeding. */

export type BadgeVariant = 'default' | 'secondary' | 'error' | 'warning' | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-aqua-500/15 text-aqua-400',
  secondary: 'bg-zinc-500/15 text-zinc-400',
  error: 'bg-rose-500/15 text-rose-400',
  warning: 'bg-amber-500/15 text-amber-400',
  info: 'bg-sky-500/15 text-sky-400',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** When true, uses compact padding for inline use (e.g., inside a table cell) */
  compact?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', compact = false, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full font-display text-label-caps',
        compact ? 'px-2 py-0.5' : 'px-2.5 py-1',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';

/* ── StatusDot ──
   Small coloured circle used inline, e.g. "● Active" in a table or header. */

export type StatusDotColor = 'green' | 'amber' | 'red' | 'slate';

const dotColors: Record<StatusDotColor, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  slate: 'bg-zinc-500',
};

export interface StatusDotProps {
  color?: StatusDotColor;
  className?: string;
}

export function StatusDot({ color = 'slate', className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2 w-2 rounded-full', dotColors[color], className)}
    />
  );
}