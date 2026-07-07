// ============================================================
// src/mcp/servers/routingServer.js
// Mock MCP server for travel-time / distance estimation between
// organizations. Uses haversine distance over lat/lon stored on
// `organizations`, with a fixed average-speed model.
//
// Swapping this for a real MCP server backed by a maps/routing
// API (e.g. a traffic-aware ETA service) later is a same-shape
// change: `call('routing.eta', { fromOrgId, toOrgId })` keeps
// its signature, only the implementation gets smarter.
// ============================================================
import { getOrganization } from '../../db/queries.js';

export const tools = [
  {
    name: 'routing.eta',
    description: 'Estimate travel time in minutes between two organizations.',
    inputSchema: { fromOrgId: 'string', toOrgId: 'string' },
  },
  {
    name: 'routing.nearest',
    description: 'Given a list of candidate org IDs, rank them by distance to a target org.',
    inputSchema: { targetOrgId: 'string', candidateOrgIds: 'string[]' },
  },
];

const AVG_SPEED_KMH = 32; // conservative urban/relief-convoy average

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function eta({ fromOrgId, toOrgId }) {
  const [from, to] = await Promise.all([getOrganization(fromOrgId), getOrganization(toOrgId)]);
  if (!from || !to || from.latitude == null || to.latitude == null) {
    return { minutes: null, km: null, reason: 'missing coordinates' };
  }
  const km = haversineKm(from, to);
  const minutes = Math.round((km / AVG_SPEED_KMH) * 60);
  return { minutes, km: Number(km.toFixed(1)) };
}

async function nearest({ targetOrgId, candidateOrgIds }) {
  const results = await Promise.all(
    candidateOrgIds.map(async (orgId) => ({ orgId, ...(await eta({ fromOrgId: orgId, toOrgId: targetOrgId })) }))
  );
  return results
    .filter((r) => r.minutes != null)
    .sort((a, b) => a.minutes - b.minutes);
}

export async function call(toolName, args) {
  switch (toolName) {
    case 'routing.eta': return eta(args);
    case 'routing.nearest': return nearest(args);
    default: throw new Error(`routingServer: unknown tool '${toolName}'`);
  }
}
