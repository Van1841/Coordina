import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import Card from './Card.jsx';

export default function ResourceTimeline({ resources }) {
  const data = resources
    .filter((r) => r.capacity)
    .map((r) => ({
      name: `${r.label.replace(/_/g, ' ')}`,
      ratio: Math.round((r.quantity / r.capacity) * 100),
      org: r.organization_id,
    }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 8);

  const colorFor = (ratio) => {
    if (ratio <= 25) return '#ff5c5c';
    if (ratio <= 50) return '#ff9f43';
    if (ratio <= 75) return '#f4d35e';
    return '#5fd88f';
  };

  return (
    <Card hover={false}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-400">Resource levels</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#25292f" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#8a919c', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#d7dbe0', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => [`${v}% of capacity`, 'Stock level']}
              contentStyle={{ background: '#15171b', border: '1px solid #25292f', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#d7dbe0' }}
              cursor={{ fill: 'rgba(108,140,255,0.06)' }}
            />
            <Bar dataKey="ratio" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={colorFor(d.ratio)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
