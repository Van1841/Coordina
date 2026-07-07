import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Activity, Building2, ListTree } from 'lucide-react';
import Card from './Card.jsx';

const ICONS = { open: Activity, critical: AlertTriangle, orgs: Building2, total: ListTree };

function StatTile({ label, value, icon, tone = 'text-base-200', delay = 0 }) {
  const Icon = ICONS[icon];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-base-400">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
        </div>
        <div className="rounded-full bg-base-800 p-2.5 ring-1 ring-inset ring-base-700">
          <Icon size={18} className={tone} />
        </div>
      </Card>
    </motion.div>
  );
}

export default function StatsBar({ stats, orgCount }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatTile label="Open incidents" value={stats.openIncidents} icon="open" delay={0} />
      <StatTile label="Critical" value={stats.criticalIncidents} icon="critical" tone="text-critical" delay={0.05} />
      <StatTile label="Organizations" value={orgCount} icon="orgs" delay={0.1} />
      <StatTile label="Total tracked" value={stats.totalIncidents} icon="total" delay={0.15} />
    </div>
  );
}
