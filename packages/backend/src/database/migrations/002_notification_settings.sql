-- =============================================================================
-- Migration: 002_notification_settings.sql
--
-- Tabela de preferências de notificação por empresa.
-- Cada empresa pode configurar:
-- - Quais canais receber (WhatsApp, email, ambos)
-- - Com quantos dias de antecedência receber os alertas
-- - Quais números/emails recebem as notificações
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_settings (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        UUID        NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Canais ativos
  whatsapp_enabled  BOOLEAN     NOT NULL DEFAULT true,
  email_enabled     BOOLEAN     NOT NULL DEFAULT true,

  -- Contatos (podem ser diferentes do cadastro da empresa)
  whatsapp_number   VARCHAR(20),  -- ex: 5596999113575 (formato internacional, sem +)
  email_address     VARCHAR(255),

  -- Janelas de alerta (dias antes do vencimento)
  -- Array permite configurar: {30, 15, 7} ou apenas {7} para quem não quer spam
  alert_days        INTEGER[]   NOT NULL DEFAULT '{30,15,7}',

  -- Alerta diário nos últimos N dias antes do vencimento
  daily_alert_days  INTEGER     NOT NULL DEFAULT 3,

  -- Horário de envio (hora local — Macapá)
  send_hour         INTEGER     NOT NULL DEFAULT 8
    CHECK (send_hour BETWEEN 0 AND 23),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Inserir configuração padrão para empresas já cadastradas
INSERT INTO notification_settings (company_id, whatsapp_number, email_address)
SELECT
  id,
  whatsapp,
  email
FROM companies
WHERE id NOT IN (SELECT company_id FROM notification_settings)
ON CONFLICT DO NOTHING;
