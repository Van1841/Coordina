// ============================================================
// src/mcp/servers/volunteerServer.js
// Mock MCP server exposing the volunteer directory.
// Backed by resources (category='volunteer'): quantity = idle
// volunteers available right now, capacity = total roster size.
// ============================================================
import { listResources, upsertResource } from '../../db/queries.js';

export const tools = [
  {
    name: 'volunteer.get_availability',
    description: 'Get count of currently available (idle) volunteers per organization/skill.',
    inputSchema: { organizationId: 'string?' },
  },
  {
    name: 'volunteer.dispatch',
    description: 'Mark a number of volunteers as dispatched (reduces available count).',
    inputSchema: { organizationId: 'string', label: 'string', count: 'number' },
  },
];

async function getAvailability({ organizationId } = {}) {
  return listResources({ organizationId, category: 'volunteer' });
}

async function dispatch({ organizationId, label, count }) {
  const rows = await listResources({ organizationId, category: 'volunteer' });
  const match = rows.find((r) => r.label === label);
  if (!match) throw new Error(`volunteer.dispatch: no such pool '${label}' at ${organizationId}`);
  if (match.quantity < count) {
    throw new Error(`volunteer.dispatch: requested ${count} but only ${match.quantity} available`);
  }
  await upsertResource({
    organizationId,
    category: 'volunteer',
    label,
    quantity: match.quantity - count,
    capacity: match.capacity,
    unit: match.unit,
  });
  return { ok: true, label, dispatched: count, remaining: match.quantity - count };
}

export async function call(toolName, args) {
  switch (toolName) {
    case 'volunteer.get_availability': return getAvailability(args);
    case 'volunteer.dispatch': return dispatch(args);
    default: throw new Error(`volunteerServer: unknown tool '${toolName}'`);
  }
}
