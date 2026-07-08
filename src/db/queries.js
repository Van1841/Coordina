// ============================================================
// src/db/queries.js
// All raw SQL lives here. Services call these functions instead
// of writing SQL inline — keeps the SQL surface auditable in
// one place and makes the Postgres migration mechanical.
// ============================================================
import { query } from './pool.js';

function parseJsonField(row, field) {
  if (!row || row[field] == null) return row;
  if (typeof row[field] !== 'string') return row;
  try {
    return { ...row, [field]: JSON.parse(row[field]) };
  } catch {
    return { ...row, [field]: null };
  }
}

// ---------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------
export async function upsertOrganization(org) {
  await query(
    `INSERT INTO organizations (id, name, type, slack_team_id, latitude, longitude, metadata)
     VALUES (:id, :name, :type, :slackTeamId, :latitude, :longitude, :metadata)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), type = VALUES(type),
       slack_team_id = VALUES(slack_team_id),
       latitude = VALUES(latitude), longitude = VALUES(longitude),
       metadata = VALUES(metadata)`,
    {
      id: org.id,
      name: org.name,
      type: org.type,
      slackTeamId: org.slackTeamId || null,
      latitude: org.latitude ?? null,
      longitude: org.longitude ?? null,
      metadata: JSON.stringify(org.metadata || {}),
    }
  );
}

export async function listOrganizations() {
  const rows = await query('SELECT * FROM organizations ORDER BY name');
  return rows.map((r) => parseJsonField(r, 'metadata'));
}

export async function getOrganization(id) {
  const rows = await query('SELECT * FROM organizations WHERE id = :id', { id });
  return rows[0] ? parseJsonField(rows[0], 'metadata') : null;
}

// ---------------------------------------------------------------
// Resources
// ---------------------------------------------------------------
export async function upsertResource(resource) {
  const existing = await query(
    `SELECT id FROM resources WHERE organization_id = :organizationId
       AND category = :category AND label = :label LIMIT 1`,
    resource
  );
  if (existing[0]) {
    await query(
      `UPDATE resources SET quantity = :quantity, capacity = :capacity, unit = :unit
       WHERE id = :id`,
      { ...resource, id: existing[0].id }
    );
    return existing[0].id;
  }
  const result = await query(
    `INSERT INTO resources (organization_id, category, label, quantity, capacity, unit)
     VALUES (:organizationId, :category, :label, :quantity, :capacity, :unit)`,
    resource
  );
  return result.insertId;
}

export async function listResources({ organizationId = null, category = null } = {}) {
  let sql = 'SELECT * FROM resources WHERE 1=1';
  const params = {};
  if (organizationId) { sql += ' AND organization_id = :organizationId'; params.organizationId = organizationId; }
  if (category) { sql += ' AND category = :category'; params.category = category; }
  sql += ' ORDER BY updated_at DESC';
  return query(sql, params);
}

export async function adjustResourceQuantity(resourceId, delta) {
  await query(
    'UPDATE resources SET quantity = GREATEST(0, quantity + :delta) WHERE id = :resourceId',
    { resourceId, delta }
  );
}

// ---------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------
export async function createIncident(incident) {
  const result = await query(
    `INSERT INTO incidents
      (organization_id, kind, category, summary, people_affected, status,
       source_channel, source_message_ts, raw_text, created_at)
     VALUES
      (:organizationId, :kind, :category, :summary, :peopleAffected, :status,
       :sourceChannel, :sourceMessageTs, :rawText, NOW())`,
    {
      organizationId: incident.organizationId,
      kind: incident.kind,
      category: incident.category,
      summary: incident.summary,
      peopleAffected: incident.peopleAffected || 0,
      status: incident.status || 'open',
      sourceChannel: incident.sourceChannel || null,
      sourceMessageTs: incident.sourceMessageTs || null,
      rawText: incident.rawText || null,
    }
  );
  return result.insertId;
}

export async function updateIncident(id, fields) {
  const allowed = ['summary', 'people_affected', 'status', 'priority_score', 'score_breakdown', 'merged_into_id'];
  const sets = [];
  const params = { id };
  for (const [key, value] of Object.entries(fields)) {
    const col = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    if (!allowed.includes(col)) continue;
    sets.push(`${col} = :${key}`);
    params[key] = col === 'score_breakdown' ? JSON.stringify(value) : value;
  }
  if (!sets.length) return;
  await query(`UPDATE incidents SET ${sets.join(', ')} WHERE id = :id`, params);
}

export async function getIncident(id) {
  const rows = await query('SELECT * FROM incidents WHERE id = :id', { id });
  return rows[0] ? parseJsonField(rows[0], 'score_breakdown') : null;
}

export async function listIncidents({ status = null, organizationId = null, limit = 100 } = {}) {
  let sql = 'SELECT * FROM incidents WHERE 1=1';
  const params = { limit };
  if (status) { sql += ' AND status = :status'; params.status = status; }
  if (organizationId) { sql += ' AND organization_id = :organizationId'; params.organizationId = organizationId; }
  sql += ' ORDER BY priority_score DESC, created_at DESC LIMIT :limit';
  // return query(sql, params);
  const rows = await query(sql, params);
  return rows.map((r) => parseJsonField(r, 'score_breakdown'));
}

export async function findOpenIncidentsByCategory(category, excludeId = null) {
  let sql = `SELECT * FROM incidents WHERE category = :category AND status IN ('open', 'in_progress', 'matched')`;
  const params = { category };
  if (excludeId) { sql += ' AND id != :excludeId'; params.excludeId = excludeId; }
  sql += ' ORDER BY created_at DESC LIMIT 25';
  // return query(sql, params);
  const rows = await query(sql, params);
  return rows.map((r) => parseJsonField(r, 'score_breakdown'));
}

// ---------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------
export async function createRecommendation(rec) {
  const result = await query(
    `INSERT INTO recommendations
      (incident_id, action, target_org_id, explanation, llm_provider, confidence_note, status)
     VALUES
      (:incidentId, :action, :targetOrgId, :explanation, :llmProvider, :confidenceNote, :status)`,
    {
      incidentId: rec.incidentId,
      action: rec.action,
      targetOrgId: rec.targetOrgId || null,
      explanation: rec.explanation || null,
      llmProvider: rec.llmProvider || null,
      confidenceNote: rec.confidenceNote || null,
      status: rec.status || 'pending',
    }
  );
  return result.insertId;
}

export async function listRecommendations({ incidentId = null, status = null, limit = 50 } = {}) {
  let sql = 'SELECT * FROM recommendations WHERE 1=1';
  const params = { limit };
  if (incidentId) { sql += ' AND incident_id = :incidentId'; params.incidentId = incidentId; }
  if (status) { sql += ' AND status = :status'; params.status = status; }
  sql += ' ORDER BY created_at DESC LIMIT :limit';
  return query(sql, params);
}

export async function updateRecommendationStatus(id, status) {
  await query('UPDATE recommendations SET status = :status WHERE id = :id', { id, status });
}
