import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio } from 'lucide-react';
import Card from './Card.jsx';

export default function ActivityStream({ events }) {
  return (
    <Card hover={false} className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-400">Live activity</h2>
        <span className="flex items-center gap-1.5 text-xs text-low">
          <Radio size={12} className="animate-pulse" /> streaming
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {events.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-l-2 border-accent/30 pl-3 py-1"
            >
              <p className="text-xs text-base-200">{e.text}</p>
              <p className="text-[10px] text-base-400">{new Date(e.createdAt).toLocaleTimeString()} · {e.category}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {!events.length && (
          <div className="flex h-32 items-center justify-center text-sm text-base-400">
            Waiting for live signals from connected workspaces…
          </div>
        )}
      </div>
    </Card>
  );
}
