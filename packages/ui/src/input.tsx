import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from './lib/utils';

/* ── Input ──
   Clinical Precision: input-clinical per spec Section 10.
   Translucent border, aqua focus ring. Labels use font-display
   (Geist) SemiBold for clinical clarity. */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visual variant */
  variant?: 'default' | 'filled';
  /** When true, applies error styling */
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'default', error = false, type = 'text', ...props }, ref) => {
    const base =
      'flex h-10 w-full rounded-lg px-3 py-2 text-sm font-body text-zinc-100 placeholder:text-zinc-500 transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none';

    const variants: Record<string, string> = {
      default: cn(
        'bg-white/[0.04] border border-white/[0.08]',
        'hover:border-white/[0.12]',
        'focus-visible:border-aqua-500/60 focus-visible:bg-white/[0.06]',
        error && 'border-rose-500/60',
      ),
      filled: cn(
        'border-0 bg-white/[0.06]',
        'hover:bg-white/[0.08]',
        'focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-aqua-500/40',
        error && 'ring-2 ring-rose-500/40',
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
        'font-display text-sm font-semibold text-zinc-100',
        required && "after:ml-0.5 after:text-rose-400 after:content-['*']",
        className,
      )}
    >
      {children}
    </label>
  );
}