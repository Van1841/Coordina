// ============================================================
// src/routes/dashboardApi.js
// REST API consumed by the React dashboard (observer view for
// judges). Read-heavy; the one mutating endpoint (resolve) is
// intentionally simple since life-critical actions never happen
// automatically — a human clicks this.
// ============================================================
import { Router } from 'express';
import { listIncidents, getIncident, listResources } from '../db/queries.js';
import { listRecommendations, getTargetOrgForRecommendation, generateRecommendation } from '../services/recommendationService.js';
import { getAllOrganizations, getOrgById } from '../services/organizationService.js';
import { markResolved } from '../services/incidentService.js';
import { pingDatabase } from '../db/pool.js';
import { notifyRecommendationOutcome } from '../agents/proactiveLoop.js';

export const router = Router();

router.get('/health', async (_req, res) => {
  const dbOk = await pingDatabase();
  res.json({ ok: dbOk, service: 'coordina-api', time: new Date().toISOString() });
});

router.get('/organizations', async (_req, res) => {
  res.json(await getAllOrganizations());
});

router.get('/incidents', async (req, res) => {
  const { status, organizationId } = req.query;
  const incidents = await listIncidents({ status: status || null, organizationId: organizationId || null, limit: 200 });
  res.json(incidents);
});

router.get('/incidents/:id', async (req, res) => {
  const incident = await getIncident(Number(req.params.id));
  if (!incident) return res.status(404).json({ error: 'not found' });
  const org = await getOrgById(incident.organization_id);
  res.json({ ...incident, organization: org });
});

router.post('/incidents/:id/resolve', async (req, res) => {
  await markResolved(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/incidents/:id/recommend', async (req, res) => {
  const rec = await generateRecommendation(Number(req.params.id));
  const incident = await getIncident(Number(req.params.id));
  if (incident) {
    notifyRecommendationOutcome(incident, rec).catch((err) => console.error('Slack notify failed:', err.message));
  }
  res.json(rec);
});

router.get('/resources', async (req, res) => {
  const { organizationId, category } = req.query;
  res.json(await listResources({ organizationId: organizationId || null, category: category || null }));
});

router.get('/recommendations', async (req, res) => {
  const { status } = req.query;
  const recs = await listRecommendations({ status: status || null, limit: 100 });
  const enriched = await Promise.all(
    recs.map(async (r) => ({ ...r, targetOrganization: await getTargetOrgForRecommendation(r) }))
  );
  res.json(enriched);
});

router.get('/stats', async (_req, res) => {
  const incidents = await listIncidents({ limit: 500 });
  const open = incidents.filter((i) => i.status === 'open');
  const critical = open.filter((i) => (i.priority_score ?? 0) >= 70);
  const byCategory = incidents.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});
  res.json({
    totalIncidents: incidents.length,
    openIncidents: open.length,
    criticalIncidents: critical.length,
    byCategory,
  });
});
