// ============================================================
// src/mcp/servers/shelterServer.js
// Mock MCP server exposing shelter-capacity tools.
// Backed by resources (category='shelter'): quantity = occupied
// beds, capacity = total beds.
// ============================================================
import { listResources, upsertResource } from '../../db/queries.js';

export const tools = [
  {
    name: 'shelter.get_occupancy',
    description: 'Get occupied/total bed counts for shelters, optionally filtered by organization.',
    inputSchema: { organizationId: 'string?' },
  },
  {
    name: 'shelter.find_available',
    description: 'Find shelters with free capacity, sorted by most free beds first.',
    inputSchema: { minFreeBeds: 'number?' },
  },
  {
    name: 'shelter.admit',
    description: 'Admit a number of people into a shelter, increasing occupied count.',
    inputSchema: { organizationId: 'string', label: 'string', count: 'number' },
  },
];

async function getOccupancy({ organizationId } = {}) {
  return listResources({ organizationId, category: 'shelter' });
}

async function findAvailable({ minFreeBeds = 1 } = {}) {
  const rows = await listResources({ category: 'shelter' });
  return rows
    .map((r) => ({ ...r, freeBeds: (r.capacity ?? 0) - r.quantity }))
    .filter((r) => r.freeBeds >= minFreeBeds)
    .sort((a, b) => b.freeBeds - a.freeBeds);
}

async function admit({ organizationId, label, count }) {
  const rows = await listResources({ organizationId, category: 'shelter' });
  const match = rows.find((r) => r.label === label);
  if (!match) throw new Error(`shelter.admit: no such shelter '${label}' at ${organizationId}`);
  const nextQty = Math.min((match.capacity ?? Infinity), match.quantity + count);
  await upsertResource({
    organizationId,
    category: 'shelter',
    label,
    quantity: nextQty,
    capacity: match.capacity,
    unit: match.unit,
  });
  return { ok: true, label, occupied: nextQty, capacity: match.capacity };
}

export async function call(toolName, args) {
  switch (toolName) {
    case 'shelter.get_occupancy': return getOccupancy(args);
    case 'shelter.find_available': return findAvailable(args);
    case 'shelter.admit': return admit(args);
    default: throw new Error(`shelterServer: unknown tool '${toolName}'`);
  }
}
