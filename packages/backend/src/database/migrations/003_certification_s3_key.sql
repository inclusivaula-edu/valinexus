-- =============================================================================
-- Migration: 003_certification_s3_key.sql
--
-- Adiciona coluna s3_key à tabela certifications.
--
-- Por que guardar a chave S3 e não a URL?
-- URLs pré-assinadas expiram (15 min). Se guardarmos a URL no banco,
-- ela fica inválida e o usuário não consegue acessar o documento.
-- A chave é permanente — geramos uma URL nova sempre que necessário.
--
-- A coluna file_url existente passa a guardar a URL temporária
-- gerada no momento do upload (para exibição imediata).
-- Em produção, o frontend deve requisitar uma URL fresca via API
-- quando precisar exibir o documento.
-- =============================================================================

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);

-- Índice para lookup rápido pela chave (útil para delete)
CREATE INDEX IF NOT EXISTS idx_certifications_s3_key
  ON certifications(s3_key)
  WHERE s3_key IS NOT NULL;

COMMENT ON COLUMN certifications.s3_key IS
  'Chave do objeto no bucket S3. Permanente. Usar para gerar URLs pré-assinadas.';

COMMENT ON COLUMN certifications.file_url IS
  'URL pré-assinada temporária (15min). Atualizar via GET /certifications/:id/download-url.';
