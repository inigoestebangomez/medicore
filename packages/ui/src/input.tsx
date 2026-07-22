import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from './lib/utils';

/* ── Input ──
   Clinical Precision: 1px outline-variant border → 2px secondary (teal) on focus.
   Labels use font-display (Geist) SemiBold for clinical clarity. */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visual variant */
  variant?: 'default' | 'filled';
  /** When true, applies error styling */
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'default', error = false, type = 'text', ...props }, ref) => {
    const base =
      'flex h-10 w-full rounded bg-surface-lowest px-3 py-2 text-sm font-body text-on-surface placeholder:text-on-surface-variant/60 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50';

    const variants: Record<string, string> = {
      default: cn(
        'border border-outline-variant',
        'focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/20 focus-visible:outline-none',
        error && 'border-error ring-2 ring-error/20',
      ),
      filled: cn(
        'border-0 bg-surface-container',
        'focus-visible:ring-2 focus-visible:ring-secondary/20 focus-visible:outline-none',
        error && 'ring-2 ring-error/20',
      ),
    };

    return (
      <input
        ref={ref}
        type={type}
        className={cn(base, variants[variant], className)}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

/* ── Label ──
   Geist SemiBold for clinical clarity. */

export interface LabelProps {
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Label({ htmlFor, required, className, children }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'font-display text-sm font-semibold text-on-surface',
        required && "after:ml-0.5 after:text-error after:content-['*']",
        className,
      )}
    >
      {children}
    </label>
  );
}
