import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from './lib/utils';

/* ── Card ──
   Clinical Precision: border-based card with 8px radius, optional header.
   NO shadow — depth is conveyed through a 1px outline. */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** When true, removes the border (for use inside other surfaces) */
  borderless?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, borderless = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg bg-surface-lowest',
        !borderless && 'border border-outline-variant',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

/* ── CardHeader ──
   Light background strip at the top of a card — groups diagnostic sections. */

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** When true, removes bottom border separator between header and body */
  seamless?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, seamless = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-t-lg bg-surface-low px-4 py-3 font-display text-sm font-semibold text-on-surface',
        !seamless && 'border-b border-outline-variant',
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

/* ── CardContent ──
   Content area inside a card with compact clinical padding. */

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 py-3', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';
