import React from 'react';
import { Badge } from './ui/badge.jsx';

const TIERS = [
  { min: 70, label: 'Critical', dot: 'bg-critical', variant: 'critical' },
  { min: 45, label: 'High', dot: 'bg-high', variant: 'high' },
  { min: 20, label: 'Moderate', dot: 'bg-moderate', variant: 'moderate' },
  { min: 0, label: 'Low', dot: 'bg-low', variant: 'low' },
];

export default function PriorityPill({ score }) {
  if (score == null) {
    return (
      <Badge variant="default">
        <span className="h-1.5 w-1.5 rounded-full bg-base-400" />
        Unscored
      </Badge>
    );
  }
  const tier = TIERS.find((t) => score >= t.min);
  return (
    <Badge variant={tier.variant}>
      <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
      {tier.label}
    </Badge>
  );
}
