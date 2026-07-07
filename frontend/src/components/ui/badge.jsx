// ============================================================
// frontend/src/components/ui/badge.jsx
// shadcn/ui Badge primitive, re-themed. Used as the base for
// PriorityPill so status pills follow the same variant API as
// every other shadcn primitive in the dashboard.
// ============================================================
import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'bg-base-800 text-base-400 ring-base-700',
        critical: 'bg-base-800 text-critical ring-critical/30',
        high: 'bg-base-800 text-high ring-high/30',
        moderate: 'bg-base-800 text-moderate ring-moderate/30',
        low: 'bg-base-800 text-low ring-low/30',
        accent: 'bg-accent/15 text-accent ring-accent/30',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
