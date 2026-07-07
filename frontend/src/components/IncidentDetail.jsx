import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CheckCircle2, Sparkles } from 'lucide-react';
import Card from './Card.jsx';
import PriorityPill from './PriorityPill.jsx';
import { Button } from './ui/button.jsx';

const FACTOR_LABELS = {
  category: 'Category severity',
  peopleAffected: 'People affected',
  timeWaiting: 'Time waiting',
  inventoryGap: 'Inventory gap',
  travelTime: 'Travel time',
  shelterOccupancy: 'Shelter occupancy',
  volunteerAvailability: 'Volunteer availability',
};

export default function IncidentDetail({ incident, org, onResolve, onRecommend, recommending }) {
  if (!incident) {
    return (
      <Card className="flex h-full items-center justify-center text-sm text-base-400" hover={false}>
        Select an incident to see its deterministic score breakdown.
      </Card>
    );
  }

  const contributions = incident.score_breakdown?.contributions || {};
  const chartData = Object.entries(contributions)
    .map(([key, value]) => ({ name: FACTOR_LABELS[key] || key, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <motion.div key={incident.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <Card hover={false} className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-base-400">Incident #{incident.id}</p>
            <h3 className="mt-1 text-lg font-semibold text-base-200">{incident.summary}</h3>
            <p className="mt-1 text-sm text-base-400">{org?.name || incident.organization_id} · {incident.category}</p>
          </div>
          <PriorityPill score={incident.priority_score} />
        </div>

        {chartData.length > 0 && (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#25292f" />
                <XAxis type="number" tick={{ fill: '#8a919c', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fill: '#d7dbe0', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#15171b', border: '1px solid #25292f', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#d7dbe0' }}
                  cursor={{ fill: 'rgba(108,140,255,0.06)' }}
                />
                <Bar dataKey="value" fill="#6c8cff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" onClick={() => onResolve(incident.id)}>
            <CheckCircle2 size={14} /> Mark resolved
          </Button>
          <Button variant="default" onClick={() => onRecommend(incident.id)} disabled={recommending}>
            <Sparkles size={14} /> {recommending ? 'Generating…' : 'Generate recommendation'}
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-base-400">
          Score is computed deterministically from live MCP data (inventory, shelter, volunteer, routing). The AI layer
          only explains and ranks — it never assigns or overrides this number.
        </p>
      </Card>
    </motion.div>
  );
}
