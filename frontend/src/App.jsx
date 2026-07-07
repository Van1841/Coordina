import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Waves, RefreshCcw } from 'lucide-react';
import { api, connectLiveStream } from './lib/api.js';
import { Button } from './components/ui/button.jsx';
import StatsBar from './components/StatsBar.jsx';
import IncidentFeed from './components/IncidentFeed.jsx';
import IncidentDetail from './components/IncidentDetail.jsx';
import OrgCards from './components/OrgCards.jsx';
import ResourceTimeline from './components/ResourceTimeline.jsx';
import RecommendationPanel from './components/RecommendationPanel.jsx';
import ActivityStream from './components/ActivityStream.jsx';

const FILTERS = ['open', 'in_progress', 'resolved', 'all'];

export default function App() {
  const [incidents, setIncidents] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [resources, setResources] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('open');
  const [events, setEvents] = useState([]);
  const [recommending, setRecommending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiOk, setApiOk] = useState(true);

  const orgById = useMemo(() => Object.fromEntries(organizations.map((o) => [o.id, o])), [organizations]);

  const loadAll = useCallback(async () => {
    try {
      const [inc, orgs, res, recs, st] = await Promise.all([
        api.incidents(filter === 'all' ? {} : { status: filter }),
        api.organizations(),
        api.resources(),
        api.recommendations(),
        api.stats(),
      ]);
      setIncidents(inc);
      setOrganizations(orgs);
      setResources(res);
      setRecommendations(recs);
      setStats(st);
      setApiOk(true);
    } catch (err) {
      console.error('failed to load dashboard data:', err);
      setApiOk(false);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, [loadAll]);

  useEffect(() => {
    const disconnect = connectLiveStream((signal) => {
      setEvents((prev) => [signal, ...prev].slice(0, 30));
      loadAll();
    });
    return disconnect;
  }, [loadAll]);

  const selectedIncident = incidents.find((i) => i.id === selectedId) || null;

  const incidentsByOrg = useMemo(
    () => incidents.reduce((acc, i) => ({ ...acc, [i.organization_id]: (acc[i.organization_id] || 0) + 1 }), {}),
    [incidents]
  );

  const handleResolve = async (id) => {
    await api.resolveIncident(id);
    await loadAll();
  };

  const handleRecommend = async (id) => {
    setRecommending(true);
    try {
      await api.requestRecommendation(id);
      await loadAll();
    } finally {
      setRecommending(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-6 py-8 lg:px-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl2 bg-accent/15 p-2.5 ring-1 ring-inset ring-accent/30">
            <Waves size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-base-200">Coordina</h1>
            <p className="text-xs text-base-400">Cross-organization decision intelligence, observed live</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!apiOk && (
            <span className="rounded-full bg-critical/15 px-3 py-1 text-xs font-medium text-critical ring-1 ring-inset ring-critical/30">
              API unreachable — is the backend running?
            </span>
          )}
          <div className="flex gap-1 rounded-lg bg-base-800/60 p-1 ring-1 ring-inset ring-base-700/60">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-accent/20 text-accent' : 'text-base-400 hover:text-base-200'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="icon" onClick={loadAll} title="Refresh">
            <RefreshCcw size={15} />
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-base-400">Loading Coordina dashboard…</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-6">
          <StatsBar stats={stats} orgCount={organizations.length} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <IncidentFeed incidents={incidents} orgById={orgById} onSelect={setSelectedId} selectedId={selectedId} />
            </div>
            <div className="lg:col-span-1">
              <IncidentDetail
                incident={selectedIncident}
                org={selectedIncident ? orgById[selectedIncident.organization_id] : null}
                onResolve={handleResolve}
                onRecommend={handleRecommend}
                recommending={recommending}
              />
            </div>
            <div className="lg:col-span-1">
              <ActivityStream events={events} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <OrgCards organizations={organizations} incidentsByOrg={incidentsByOrg} />
            <ResourceTimeline resources={resources} />
            <RecommendationPanel recommendations={recommendations} orgById={orgById} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
