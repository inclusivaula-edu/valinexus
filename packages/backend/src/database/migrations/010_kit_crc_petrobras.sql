-- 010: Kit CRC Petrobras
--
-- Agrupa em um "kit" os documentos exigidos no cadastramento/renovação
-- do CRC no Petronect (critérios jurídico, econômico, técnico, SMS e
-- integridade), permitindo aplicá-los em bloco a uma empresa.

ALTER TABLE certification_templates ADD COLUMN IF NOT EXISTS kit VARCHAR(50) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_cert_templates_kit ON certification_templates (kit) WHERE kit IS NOT NULL;

-- Templates novos, específicos do processo CRC
INSERT INTO certification_templates (name, category, issuing_body, typical_validity_days, description, is_mandatory, applies_to, kit)
SELECT * FROM (VALUES
  ('Contrato Social / Atos Constitutivos consolidados', 'OPERACIONAL', 'Junta Comercial',              365, 'Critério jurídico do CRC: última consolidação registrada na Junta Comercial.', true, '{}'::TEXT[], 'CRC_PETROBRAS'),
  ('Balanço Patrimonial do último exercício',           'FISCAL',      'Contador (CRC ativo)',          365, 'Critério econômico do CRC: balanço assinado por contador, com índices de liquidez.', true, '{}'::TEXT[], 'CRC_PETROBRAS'),
  ('Certidão Negativa de Falência e Recuperação Judicial', 'FISCAL',   'Tribunal de Justiça (TJAP)',     90, 'Critério econômico do CRC: emitida pelo distribuidor da comarca da sede.', true, '{}'::TEXT[], 'CRC_PETROBRAS'),
  ('Atestado(s) de Capacidade Técnica',                 'TECNICO',     'Clientes anteriores',          1095, 'Critério técnico do CRC: contratos similares executados, compatíveis com as famílias de fornecimento.', true, '{}'::TEXT[], 'CRC_PETROBRAS')
) AS novo(name, category, issuing_body, typical_validity_days, description, is_mandatory, applies_to, kit)
WHERE NOT EXISTS (
  SELECT 1 FROM certification_templates t WHERE t.name = novo.name
);

-- Marca os templates já existentes que integram o kit CRC
UPDATE certification_templates SET kit = 'CRC_PETROBRAS'
WHERE name IN (
  'CRF — Certidão de Regularidade do FGTS',
  'CND — Receita Federal / PGFN',
  'CNDT — Certidão Negativa de Débitos Trabalhistas',
  'Registro no CRC Petrobras',
  'PGR — Programa de Gerenciamento de Riscos',
  'PCMSO — Programa de Controle Médico',
  'Due Diligence ASG (Petrobras)'
);
