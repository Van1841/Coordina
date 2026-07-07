// ============================================================
// frontend/src/lib/utils.js
// Canonical shadcn/ui `cn()` helper — merges Tailwind classes
// safely, resolving conflicts (e.g. "px-2 px-4" -> "px-4").
// ============================================================
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
