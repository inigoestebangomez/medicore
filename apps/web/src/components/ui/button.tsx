import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'border border-outline bg-surface-lowest text-on-surface-variant shadow-card hover:bg-surface-low focus-visible:ring-secondary',
  outline:
    'border border-outline bg-surface-lowest text-on-surface-variant shadow-card hover:bg-surface-low focus-visible:ring-secondary',
  ghost:
    'text-on-surface-variant hover:bg-surface-container focus-visible:ring-secondary',
  secondary:
    'bg-secondary-container text-on-secondary-container hover:bg-secondary/15 focus-visible:ring-secondary',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-10 px-5 py-2 text-sm',
  sm: 'h-9 px-3 py-1.5 text-sm',
  lg: 'h-12 px-8 text-base',
  icon: 'h-9 w-9',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
