import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from './lib/utils';

/* ── Card ──
   Clinical Precision: glassmorphism card. Depth is conveyed through a
   1px translucent border, layered backdrop-blur, and a soft shadow.
   Default radius is 2xl (24px) per Section 8 scale. */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** When true, removes the border (for use inside other surfaces) */
  borderless?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, borderless = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white/[0.06] backdrop-blur-xl rounded-2xl shadow-card',
        !borderless && 'border border-white/[0.08]',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

/* ── CardHeader ──
   Subtle glass strip at the top of a card — groups diagnostic sections. */

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** When true, removes bottom border separator between header and body */
  seamless?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, seamless = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-t-2xl bg-white/[0.04] px-4 py-3 font-display text-sm font-semibold text-zinc-100',
        !seamless && 'border-b border-white/[0.08]',
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