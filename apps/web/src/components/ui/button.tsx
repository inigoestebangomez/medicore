import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  // Migration to new design tokens (visual parity preserved):
  //  - default (was dark subtle grey)  → btn-secondary (dark glass card)
  //  - secondary (was aqua-tinted via --color-secondary-container) → btn-primary (aqua gradient)
  //  - outline keeps a border emphasis without prominent fill
  //  - ghost stays as a transparent text-only affordance
  default: 'btn-secondary',
  outline:
    'border border-outline-variant bg-surface-low text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
  ghost: 'btn-ghost',
  secondary: 'btn-primary',
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
