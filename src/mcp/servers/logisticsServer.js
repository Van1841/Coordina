// ============================================================
// src/mcp/servers/logisticsServer.js
// Mock MCP server for transport/logistics capacity (vehicles,
// drivers-in-transit, load capacity). Same resources table,
// category='logistics'.
// ============================================================
import { listResources } from '../../db/queries.js';

export const tools = [
  {
    name: 'logistics.get_capacity',
    description: 'Get available transport capacity (vehicles/load) per organization.',
    inputSchema: { organizationId: 'string?' },
  },
  {
    name: 'logistics.estimate_load_fit',
    description: 'Check whether a requested quantity fits within available transport capacity.',
    inputSchema: { organizationId: 'string', requiredUnits: 'number' },
  },
];

async function getCapacity({ organizationId } = {}) {
  return listResources({ organizationId, category: 'logistics' });
}

async function estimateLoadFit({ organizationId, requiredUnits }) {
  const rows = await listResources({ organizationId, category: 'logistics' });
  const totalFree = rows.reduce((sum, r) => sum + ((r.capacity ?? r.quantity) - 0), 0);
  return { fits: totalFree >= requiredUnits, availableCapacity: totalFree, requiredUnits };
}

export async function call(toolName, args) {
  switch (toolName) {
    case 'logistics.get_capacity': return getCapacity(args);
    case 'logistics.estimate_load_fit': return estimateLoadFit(args);
    default: throw new Error(`logisticsServer: unknown tool '${toolName}'`);
  }
}
