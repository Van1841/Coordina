// ============================================================
// frontend/src/components/ui/button.jsx
// shadcn/ui Button primitive — standard cva-based variant API,
// re-themed to Coordina's base/accent color tokens instead of
// the shadcn default palette.
// ============================================================
import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30 hover:bg-accent/25',
        secondary: 'bg-base-800 text-base-200 ring-1 ring-inset ring-base-700 hover:bg-base-700',
        ghost: 'text-base-400 hover:bg-base-800 hover:text-base-200',
        destructive: 'bg-critical/15 text-critical ring-1 ring-inset ring-critical/30 hover:bg-critical/25',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-3 py-1.5',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';

export { buttonVariants };
