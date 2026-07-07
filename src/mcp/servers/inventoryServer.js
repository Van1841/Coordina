// ============================================================
// src/mcp/servers/inventoryServer.js
// Mock MCP server exposing inventory tools.
//
// This models what a REAL MCP server for a hospital/food-bank
// inventory system would expose. Today it reads/writes the
// `resources` table (category='inventory'); tomorrow, swapping
// this file for a real MCP server that proxies to a hospital's
// actual EHR/inventory system requires no change to the agent
// or decision engine — they only see `tools` + `call(name, args)`.
// ============================================================
import { listResources, upsertResource, adjustResourceQuantity } from '../../db/queries.js';

export const tools = [
  {
    name: 'inventory.check_stock',
    description: 'Check current stock level for a resource label at an organization (or all orgs if omitted).',
    inputSchema: { organizationId: 'string?', label: 'string?' },
  },
  {
    name: 'inventory.find_shortages',
    description: 'List inventory items below a healthy threshold ratio across all orgs.',
    inputSchema: { thresholdRatio: 'number?' },
  },
  {
    name: 'inventory.consume',
    description: 'Record consumption/dispatch of a quantity of an inventory item.',
    inputSchema: { organizationId: 'string', label: 'string', quantity: 'number' },
  },
];

async function checkStock({ organizationId, label } = {}) {
  const rows = await listResources({ organizationId, category: 'inventory' });
  return label ? rows.filter((r) => r.label === label) : rows;
}

async function findShortages({ thresholdRatio = 0.25 } = {}) {
  const rows = await listResources({ category: 'inventory' });
  return rows.filter((r) => r.capacity && r.quantity / r.capacity <= thresholdRatio);
}

async function consume({ organizationId, label, quantity }) {
  const [row] = await listResources({ organizationId, category: 'inventory' });
  const match = (await listResources({ organizationId, category: 'inventory' })).find((r) => r.label === label);
  if (!match) throw new Error(`inventory.consume: no such item '${label}' at ${organizationId}`);
  await adjustResourceQuantity(match.id, -Math.abs(quantity));
  return { ok: true, resourceId: match.id, consumed: quantity };
}

export async function call(toolName, args) {
  switch (toolName) {
    case 'inventory.check_stock': return checkStock(args);
    case 'inventory.find_shortages': return findShortages(args);
    case 'inventory.consume': return consume(args);
    default: throw new Error(`inventoryServer: unknown tool '${toolName}'`);
  }
}

export async function seedHook(organizationId, label, quantity, capacity, unit) {
  return upsertResource({ organizationId, category: 'inventory', label, quantity, capacity, unit });
}
