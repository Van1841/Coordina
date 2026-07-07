import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import Card from './Card.jsx';

const ACTION_LABEL = {
  dispatch: 'Dispatch',
  reallocate: 'Reallocate',
  escalate: 'Escalate',
  merge: 'Merge duplicate',
  monitor: 'Monitor',
};

export default function RecommendationPanel({ recommendations, orgById }) {
  return (
    <Card hover={false} className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-400">Recommendations</h2>
        <Sparkles size={14} className="text-accent" />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {recommendations.map((rec, i) => {
          const sourceOrg = orgById[rec.organization_id];
          const targetOrg = rec.targetOrganization;
          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-lg bg-base-800/60 p-3.5 ring-1 ring-inset ring-base-700/60"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                  {ACTION_LABEL[rec.action] || rec.action}
                </span>
                <span className="text-xs text-base-400">{rec.status}</span>
              </div>
              {targetOrg && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-base-400">
                  <span>Incident #{rec.incident_id}</span>
                  <ArrowRight size={12} />
                  <span className="text-base-200">{targetOrg.name}</span>
                </div>
              )}
              {rec.explanation && <p className="mt-2 text-xs leading-relaxed text-base-400">{rec.explanation}</p>}
              <p className="mt-2 text-[10px] uppercase tracking-wide text-base-600">
                {rec.llm_provider ? `explained by ${rec.llm_provider}` : 'deterministic only'}
              </p>
            </motion.div>
          );
        })}
        {!recommendations.length && (
          <div className="flex h-32 items-center justify-center text-sm text-base-400">No recommendations yet.</div>
        )}
      </div>
    </Card>
  );
}
