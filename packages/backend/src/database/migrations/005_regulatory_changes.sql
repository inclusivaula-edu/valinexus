-- =============================================================================
-- VALINEXUS — Fase 3: Agente Regulatório
-- Migration: 005_regulatory_changes.sql
--
-- Tabelas para rastrear o estado de portais regulatórios monitorados
-- e registrar mudanças detectadas pelo RegulatoryWatcher.
-- =============================================================================

-- Estado atual de cada URL monitorada (hash do conteúdo + timestamp)
CREATE TABLE IF NOT EXISTS regulatory_page_hashes (
  url          VARCHAR(500) NOT NULL PRIMARY KEY,
  source_name  VARCHAR(255) NOT NULL,
  content_hash VARCHAR(64)  NOT NULL,
  last_checked TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_changed TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Mudanças detectadas pelo agente regulatório
CREATE TABLE IF NOT EXISTS regulatory_changes (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_url    VARCHAR(500) NOT NULL,
  source_name   VARCHAR(255) NOT NULL,
  change_type   VARCHAR(50)  NOT NULL
    CHECK (change_type IN (
      'NEW_REQUIREMENT',
      'UPDATED_REQUIREMENT',
      'REMOVED_REQUIREMENT',
      'CONTENT_CHANGE'
    )),
  summary       TEXT        NOT NULL,  -- Análise do Claude: o que mudou
  raw_diff      TEXT,                  -- Primeiros 2000 chars do novo conteúdo
  previous_hash VARCHAR(64),
  current_hash  VARCHAR(64) NOT NULL,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Workflow de revisão pelo SUPER_ADMIN
  reviewed      BOOLEAN     NOT NULL DEFAULT FALSE,
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  action_taken  TEXT        -- ex: "Template FGTS atualizado manualmente"
);

CREATE INDEX IF NOT EXISTS idx_regulatory_changes_detected_at
  ON regulatory_changes(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_regulatory_changes_reviewed
  ON regulatory_changes(reviewed) WHERE reviewed = FALSE;
