import React from 'react';
import { motion } from 'framer-motion';
import { Building2, HeartPulse, Home, UtensilsCrossed, Landmark } from 'lucide-react';
import Card from './Card.jsx';

const TYPE_ICON = {
  ngo: Home,
  hospital: HeartPulse,
  volunteer: Building2,
  foodbank: UtensilsCrossed,
  government: Landmark,
};

export default function OrgCards({ organizations, incidentsByOrg }) {
  return (
    <Card hover={false}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-400">Connected organizations</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {organizations.map((org, i) => {
          const Icon = TYPE_ICON[org.type] || Building2;
          const count = incidentsByOrg[org.id] || 0;
          return (
            <motion.div
              key={org.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 rounded-lg bg-base-800/60 px-3.5 py-3 ring-1 ring-inset ring-base-700/60"
            >
              <div className="rounded-full bg-base-700/60 p-2">
                <Icon size={16} className="text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-base-200">{org.name}</p>
                <p className="text-xs capitalize text-base-400">{org.type}</p>
              </div>
              {count > 0 && (
                <span className="rounded-full bg-base-700 px-2 py-0.5 text-xs font-medium text-base-200">{count}</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
