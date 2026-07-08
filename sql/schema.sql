-- ============================================================
-- COORDINA — MySQL schema
-- Design goal: the smallest schema that genuinely supports the
-- decision engine. Every table earns its place.
-- Types are kept portable (VARCHAR/JSON/TIMESTAMP) so a future
-- move to PostgreSQL is a near copy-paste job — see README.
-- ============================================================

-- CREATE DATABASE IF NOT EXISTS coordina
--   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- USE coordina;

-- ------------------------------------------------------------
-- organizations: one row per connected Slack workspace
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id            VARCHAR(64)  PRIMARY KEY,          -- e.g. 'ngo_relief_trust'
  name          VARCHAR(128) NOT NULL,
  type          VARCHAR(32)  NOT NULL,              -- ngo | hospital | volunteer | foodbank | government
  slack_team_id VARCHAR(32)  NULL,
  latitude      DECIMAL(9,6) NULL,
  longitude     DECIMAL(9,6) NULL,
  metadata      TEXT         NULL,                  -- capacity, contact info, tags (JSON-encoded string — see db/queries.js)
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- resources: current known state of a resource an org holds.
-- Covers inventory, shelter capacity and volunteer counts under
-- one roof (differentiated by `category`) since they share the
-- same shape: an org has X of something, with Y capacity.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL,
  category       VARCHAR(32)  NOT NULL,             -- inventory | shelter | volunteer | logistics
  label          VARCHAR(128) NOT NULL,             -- 'insulin', 'shelter_beds', 'drivers'
  quantity       INT          NOT NULL DEFAULT 0,
  capacity       INT          NULL,                 -- null when not capacity-bound
  unit           VARCHAR(32)  NULL,
  updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- incidents: needs, offers, and urgent reports detected from
-- Slack messages (or created directly). This is the core
-- coordination unit the decision engine scores.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  organization_id   VARCHAR(64)  NOT NULL,
  kind              VARCHAR(16)  NOT NULL,          -- need | offer | urgent
  category          VARCHAR(32)  NOT NULL,          -- medical | shelter | food | logistics | other
  summary           VARCHAR(512) NOT NULL,
  people_affected   INT          NOT NULL DEFAULT 0,
  status            VARCHAR(24)  NOT NULL DEFAULT 'open',   -- open | matched | in_progress | resolved | merged
  merged_into_id    INT          NULL,              -- set when duplicate-merged into another incident
  priority_score    DECIMAL(6,2) NULL,               -- deterministic score, see scoring/priorityEngine.js
  score_breakdown   TEXT         NULL,               -- JSON-encoded string — see db/queries.js
  source_channel    VARCHAR(64)  NULL,
  source_message_ts VARCHAR(32)  NULL,
  raw_text          TEXT         NULL,
  created_at        TIMESTAMP    NULL DEFAULT NULL,
  updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (merged_into_id) REFERENCES incidents(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- recommendations: what Coordina told the humans to do, and why.
-- Kept as an append-only audit trail — recommendations are never
-- edited, only superseded, so judges/auditors can see the agent's
-- full reasoning history for any incident.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  incident_id     INT          NOT NULL,
  action          VARCHAR(64)  NOT NULL,            -- dispatch | reallocate | escalate | merge | monitor
  target_org_id   VARCHAR(64)  NULL,
  explanation     TEXT         NULL,                -- Gemini/Groq generated, human-readable
  llm_provider    VARCHAR(16)  NULL,                -- 'gemini' | 'groq' | null (scoring-only, no LLM)
  confidence_note VARCHAR(255) NULL,                -- qualitative only — never a fabricated number
  status          VARCHAR(24)  NOT NULL DEFAULT 'pending', -- pending | acknowledged | actioned | dismissed
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

CREATE INDEX idx_incidents_status ON incidents (status);
CREATE INDEX idx_incidents_org ON incidents (organization_id);
CREATE INDEX idx_resources_org_category ON resources (organization_id, category);
CREATE INDEX idx_recommendations_incident ON recommendations (incident_id);
