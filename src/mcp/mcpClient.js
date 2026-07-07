// ============================================================
// src/mcp/mcpClient.js
// Unified MCP client the agent and decision engine talk to.
//
// Today, each "server" below is an in-process module with the
// same (tools, call) shape that a real MCP server exposes over
// the wire. This file is the ONLY place that knows they're
// in-process — everything else calls `mcpClient.call(...)`.
//
// To connect a real MCP server later: replace the entry's
// `call`/`tools` with a thin wrapper around an MCP SDK client
// (stdio or SSE transport) that exposes the identical interface.
// No caller elsewhere in the codebase changes.
// ============================================================
import * as inventoryServer from './servers/inventoryServer.js';
import * as shelterServer from './servers/shelterServer.js';
import * as volunteerServer from './servers/volunteerServer.js';
import * as logisticsServer from './servers/logisticsServer.js';
import * as routingServer from './servers/routingServer.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('mcp');

const servers = {
  inventory: inventoryServer,
  shelter: shelterServer,
  volunteer: volunteerServer,
  logistics: logisticsServer,
  routing: routingServer,
};

export function listAllTools() {
  return Object.entries(servers).flatMap(([serverId, server]) =>
    server.tools.map((t) => ({ ...t, serverId }))
  );
}

// tool name is namespaced as '<server>.<action>' e.g. 'inventory.check_stock'
export async function call(toolName, args = {}) {
  const [serverId] = toolName.split('.');
  const server = servers[serverId];
  if (!server) throw new Error(`mcpClient: no MCP server registered for '${serverId}'`);
  log.debug(`-> ${toolName}`, args);
  const result = await server.call(toolName, args);
  log.debug(`<- ${toolName} ok`);
  return result;
}

export const mcpClient = { call, listAllTools, servers };
