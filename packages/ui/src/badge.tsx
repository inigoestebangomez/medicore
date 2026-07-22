import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from './lib/utils';

/* ── Badge ──
   Clinical Precision: pill-shaped status indicators for:
   - Allergies (Red / error)
   - Appointment Status (Teal / secondary)
   - Insurance Verification (Blue / primary-container)
   Fully rounded to visually distinguish from interactive buttons. */

export type BadgeVariant = 'default' | 'secondary' | 'error' | 'warning' | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  error: 'bg-error-container text-on-error-container',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
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
  red: 'bg-error',
  slate: 'bg-on-surface-variant',
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
