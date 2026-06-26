-- =============================================================================
-- VALINEXUS — Certidões NR faltantes
-- Migration: 006_nr_certifications.sql
--
-- Adiciona NR-10, NR-33 e NR-35 que existiam apenas no seed.ts
-- mas não chegavam ao banco em produção via migrate.ts.
-- WHERE NOT EXISTS garante idempotência mesmo sem UNIQUE constraint em name.
--
-- Também adiciona índice único em name para evitar duplicatas futuras.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_certification_templates_name
  ON certification_templates(name);

INSERT INTO certification_templates (name, category, issuing_body, typical_validity_days, description, applies_to)
SELECT name, category, issuing_body, typical_validity_days, description, applies_to
FROM (VALUES
  (
    'NR-10 — Segurança em Instalações Elétricas',
    'SEGURANCA',
    'Ministério do Trabalho e Emprego',
    730,
    'Treinamento obrigatório para trabalhadores que atuam em instalações elétricas ou nas proximidades. Validade 2 anos.',
    ARRAY[]::TEXT[]
  ),
  (
    'NR-33 — Trabalho em Espaços Confinados',
    'SEGURANCA',
    'Ministério do Trabalho e Emprego',
    365,
    'Habilitação obrigatória para entrada e trabalho em espaços confinados. Exigida pela Petrobras para equipes de manutenção industrial.',
    ARRAY[]::TEXT[]
  ),
  (
    'NR-35 — Trabalho em Altura',
    'SEGURANCA',
    'Ministério do Trabalho e Emprego',
    365,
    'Treinamento obrigatório para trabalho em altura (acima de 2m). Inclui uso de EPI e ancoragem. Renovação anual.',
    ARRAY[]::TEXT[]
  )
) AS t(name, category, issuing_body, typical_validity_days, description, applies_to)
WHERE NOT EXISTS (
  SELECT 1 FROM certification_templates ct WHERE ct.name = t.name
);
