// ============================================================
// frontend/src/components/ui/card.jsx
// Canonical shadcn/ui Card composition (Card/CardHeader/
// CardTitle/CardContent/CardFooter), re-themed with Coordina's
// glass effect. Coordina's own <Card> in components/Card.jsx
// is a thin convenience wrapper around this for the simple
// single-slot usage used throughout the dashboard.
// ============================================================
import React from 'react';
import { cn } from '../../lib/utils.js';

export const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('glass rounded-xl2 text-base-200', className)} {...props} />
));
Card.displayName = 'Card';

export const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1 p-5 pb-0', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-sm font-semibold uppercase tracking-wide text-base-400', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';
