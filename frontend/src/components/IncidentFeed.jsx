import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartPulse, Home, UtensilsCrossed, Truck, CircleDot, Users, Clock } from 'lucide-react';
import Card from './Card.jsx';
import PriorityPill from './PriorityPill.jsx';

const CATEGORY_ICON = {
  medical: HeartPulse,
  shelter: Home,
  food: UtensilsCrossed,
  logistics: Truck,
  other: CircleDot,
};

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function IncidentFeed({ incidents, orgById, onSelect, selectedId }) {
  return (
    <Card className="flex h-full flex-col" hover={false}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-400">Incident feed</h2>
        <span className="text-xs text-base-400">{incidents.length} active</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {incidents.map((incident) => {
            const Icon = CATEGORY_ICON[incident.category] || CircleDot;
            const org = orgById[incident.organization_id];
            const active = selectedId === incident.id;
            return (
              <motion.button
                key={incident.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onClick={() => onSelect(incident.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  active ? 'border-accent/40 bg-accent/10' : 'border-transparent bg-base-800/60 hover:bg-base-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Icon size={16} className="mt-0.5 shrink-0 text-base-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-base-200">{incident.summary}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-400">
                        <span>{org?.name || incident.organization_id}</span>
                        <span className="flex items-center gap-1"><Users size={12} />{incident.people_affected}</span>
                        <span className="flex items-center gap-1"><Clock size={12} />{timeAgo(incident.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <PriorityPill score={incident.priority_score} />
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
        {!incidents.length && (
          <div className="flex h-40 items-center justify-center text-sm text-base-400">
            No incidents match the current filter.
          </div>
        )}
      </div>
    </Card>
  );
}
