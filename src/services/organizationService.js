// ============================================================
// src/services/organizationService.js
// Thin service layer over organization queries, adding a small
// in-memory cache since orgs change rarely but are read on
// nearly every incident/recommendation operation.
// ============================================================
import { listOrganizations, getOrganization, upsertOrganization } from '../db/queries.js';

let cache = null;
let cacheAt = 0;
const TTL_MS = 30_000;

export async function getAllOrganizations({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < TTL_MS) return cache;
  cache = await listOrganizations();
  cacheAt = Date.now();
  return cache;
}

export async function getOrgById(id) {
  const all = await getAllOrganizations();
  return all.find((o) => o.id === id) || getOrganization(id);
}

export async function getOrgMap() {
  const all = await getAllOrganizations();
  return Object.fromEntries(all.map((o) => [o.id, o]));
}

export async function registerOrganization(org) {
  await upsertOrganization(org);
  cache = null; // invalidate
}
