-- =============================================================================
-- VALINEXUS — Schema Principal
-- Migration: 001_initial_schema.sql
--
-- Filosofia de design:
-- 1. UUID como PK em vez de SERIAL: evita colisão ao mesclar dados de ambientes
--    distintos (dev/staging/prod) e não expõe contagem de registros na URL.
-- 2. created_at / updated_at em toda tabela — auditoria básica sem esforço.
-- 3. ENUM types como CHECK constraints — mais flexível que TYPE do Postgres
--    quando precisar adicionar valores sem migration complexa.
-- 4. Índices criados estrategicamente apenas onde há consultas frequentes
--    (índice sem uso é custo puro de escrita — não crie por "precaução").
-- =============================================================================

-- Extensão para geração de UUID v4 (nativa no Postgres 13+, só ativa a extensão)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABELA: companies
-- Cada registro é uma empresa terceirizada da cadeia Petrobras.
-- =============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj             VARCHAR(18) NOT NULL UNIQUE, -- formatado: XX.XXX.XXX/XXXX-XX
  razao_social     VARCHAR(255) NOT NULL,
  nome_fantasia    VARCHAR(255),
  email            VARCHAR(255) NOT NULL,
  phone            VARCHAR(20)  NOT NULL,
  whatsapp         VARCHAR(20)  NOT NULL,

  -- Endereço (desnormalizado intencionalmente: endereço raramente muda,
  -- e join para address é custo sem benefício real nesse contexto)
  address_street       VARCHAR(255) NOT NULL,
  address_number       VARCHAR(20)  NOT NULL,
  address_complement   VARCHAR(100),
  address_neighborhood VARCHAR(100) NOT NULL,
  address_city         VARCHAR(100) NOT NULL DEFAULT 'Macapá',
  address_state        VARCHAR(2)   NOT NULL DEFAULT 'AP',
  address_zip_code     VARCHAR(9)   NOT NULL,

  -- CRC Petrobras
  crc_petrobras_code   VARCHAR(100),
  crc_registered_at    TIMESTAMPTZ,

  -- Status e plano
  status               VARCHAR(30) NOT NULL DEFAULT 'PENDING_DOCS'
    CHECK (status IN ('ACTIVE','SUSPENDED','PENDING_DOCS','INACTIVE')),
  plan_tier            VARCHAR(30) NOT NULL DEFAULT 'STARTER'
    CHECK (plan_tier IN ('STARTER','PROFESSIONAL','ENTERPRISE')),
  plan_expires_at      DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),

  -- Array de categorias de serviço (ex: ['transporte', 'manutencao'])
  service_categories   TEXT[] NOT NULL DEFAULT '{}',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice no CNPJ para busca por login e lookup rápido
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj);
-- Índice no status para filtrar empresas ativas no dashboard
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- =============================================================================
-- TABELA: users
-- Usuários que acessam o sistema. Uma empresa pode ter múltiplos usuários.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone        VARCHAR(20),
  role         VARCHAR(30) NOT NULL DEFAULT 'COMPANY_USER'
    CHECK (role IN ('SUPER_ADMIN','COMPANY_ADMIN','COMPANY_USER','VIEWER')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- TABELA: certifications
-- O coração do sistema. Cada certidão exigida de cada empresa.
-- =============================================================================
CREATE TABLE IF NOT EXISTS certifications (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Identificação do documento
  name            VARCHAR(255) NOT NULL, -- ex: 'Certidão Negativa FGTS'
  category        VARCHAR(30)  NOT NULL
    CHECK (category IN (
      'FISCAL','TRABALHISTA','SEGURANCA','TECNICO',
      'AMBIENTAL','OPERACIONAL','PETROBRAS','SEGURO'
    )),
  issuing_body    VARCHAR(255) NOT NULL, -- ex: 'Caixa Econômica Federal'
  document_number VARCHAR(100),

  -- Datas cruciais
  issued_at       DATE,                  -- data de emissão (nem sempre disponível)
  expires_at      DATE NOT NULL,         -- vencimento — campo mais importante do sistema

  -- Status computado (atualizado pelo scheduler e ao fazer upload)
  status          VARCHAR(30) NOT NULL DEFAULT 'PENDING_UPLOAD'
    CHECK (status IN (
      'VALID','EXPIRING_SOON','EXPIRED','PENDING_UPLOAD','UNDER_REVIEW'
    )),

  -- Arquivo do documento (URL no S3)
  file_url        TEXT,                  -- NULL até o upload ser feito
  file_uploaded_at TIMESTAMPTZ,

  notes           TEXT,                  -- observações do responsável

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Esses dois índices são os mais usados em produção:
-- 1. Buscar todas as certidões de uma empresa (tela principal)
CREATE INDEX IF NOT EXISTS idx_certifications_company_id ON certifications(company_id);
-- 2. Buscar certidões vencendo (usado pelo scheduler de alertas toda manhã)
CREATE INDEX IF NOT EXISTS idx_certifications_expires_at ON certifications(expires_at);
-- 3. Buscar por status (filtros no dashboard)
CREATE INDEX IF NOT EXISTS idx_certifications_status ON certifications(status);

-- =============================================================================
-- TABELA: certification_alerts
-- Log de todos os alertas enviados. Nunca apagar — serve para auditoria,
-- para saber se o cliente foi notificado e para evitar spam de reenvio.
-- =============================================================================
CREATE TABLE IF NOT EXISTS certification_alerts (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  certification_id  UUID        NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  severity          VARCHAR(20) NOT NULL
    CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  channel           VARCHAR(20) NOT NULL
    CHECK (channel IN ('WHATSAPP','EMAIL','IN_APP')),
  message           TEXT        NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at      TIMESTAMPTZ,         -- preenchido pelo webhook do provedor
  error_message     TEXT                 -- se a entrega falhou
);

CREATE INDEX IF NOT EXISTS idx_alerts_certification_id ON certification_alerts(certification_id);
CREATE INDEX IF NOT EXISTS idx_alerts_sent_at ON certification_alerts(sent_at DESC);

-- =============================================================================
-- TABELA: refresh_tokens
-- Implementação de autenticação stateful por refresh token.
-- Por que guardar no banco e não apenas no JWT?
-- - Permite revogar sessões individuais (usuário reportou dispositivo roubado)
-- - Permite ver todas as sessões ativas de um usuário
-- - JWT sozinho é stateless: uma vez emitido, não tem como invalidar antes do
--   prazo sem um mecanismo server-side como esse.
-- =============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE, -- armazenamos o hash, nunca o token puro
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,                  -- preenchido ao fazer logout
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- =============================================================================
-- FUNÇÃO: trigger para atualizar updated_at automaticamente
-- Evita ter que chamar "updated_at = NOW()" em todo UPDATE manual.
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica o trigger em todas as tabelas que têm updated_at
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_certifications_updated_at
  BEFORE UPDATE ON certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- CERTIDÕES PADRÃO (seed data)
-- Esses são os documentos que toda empresa terceirizada da Petrobras precisa.
-- Ao cadastrar uma nova empresa, o sistema pode sugerir criar todas essas
-- certidões automaticamente — economia de tempo para o cliente.
-- =============================================================================
CREATE TABLE IF NOT EXISTS certification_templates (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  category     VARCHAR(30)  NOT NULL,
  issuing_body VARCHAR(255) NOT NULL,
  typical_validity_days INTEGER NOT NULL, -- 30, 90, 180, 365, 730
  description  TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  applies_to   TEXT[] NOT NULL DEFAULT '{}' -- categorias de empresa ([] = todas)
);

-- Inserir os templates das certidões mais comuns da cadeia Petrobras
INSERT INTO certification_templates (name, category, issuing_body, typical_validity_days, description, applies_to)
VALUES
  ('CRF — Certidão de Regularidade do FGTS',    'TRABALHISTA', 'Caixa Econômica Federal',    30,  'Obrigatória para emissão de NF e recebimento de pagamentos Petrobras.', '{}'),
  ('CND — Receita Federal / PGFN',               'FISCAL',      'Receita Federal do Brasil',  180, 'Certidão Negativa de Débitos federais. Validade de 180 dias.', '{}'),
  ('CND Estadual (Amapá / SEFAZ-AP)',            'FISCAL',      'SEFAZ-AP',                   90,  'Certidão de regularidade fiscal estadual emitida pela SEFAZ Amapá.', '{}'),
  ('CND Municipal (Macapá)',                     'FISCAL',      'Prefeitura de Macapá',        180, 'Certidão negativa de débitos junto ao município de Macapá.', '{}'),
  ('CNDT — Certidão Negativa de Débitos Trabalhistas', 'TRABALHISTA', 'TST',                  180, 'Prova inexistência de débitos trabalhistas. Exigida no Portal CRC.', '{}'),
  ('Registro no CRC Petrobras',                  'PETROBRAS',   'Petrobras',                   365, 'Certificado de Registro Cadastral no portal canalfornecedor.petrobras.com.br.', '{}'),
  ('Alvará de Funcionamento',                    'OPERACIONAL', 'Prefeitura de Macapá',        365, 'Autorização municipal para exercício de atividade econômica.', '{}'),
  ('Apólice de Seguro de Responsabilidade Civil','SEGURO',      'Seguradora',                  365, 'Seguro RC obrigatório para prestação de serviços na Petrobras.', '{}'),
  ('PGR — Programa de Gerenciamento de Riscos',  'SEGURANCA',   'SESMT / Eng. de Segurança',   365, 'Substitui o PPRA desde 2022 (NR-01 revisada). Documento de SSO.', '{}'),
  ('PCMSO — Programa de Controle Médico',        'SEGURANCA',   'Médico do Trabalho',          365, 'Obrigatório para empresas com funcionários. Define perícia ocupacional.', '{}'),
  ('ASO — Atestado de Saúde Ocupacional (equipe)','SEGURANCA',  'Médico do Trabalho',          365, 'ASO atualizado de todos os colaboradores alocados na Petrobras.', '{}'),
  ('Treinamento NR-10 (Elétrica)',               'SEGURANCA',   'Empresa acreditada MTE',      730, 'Obrigatório para empresas de serviços elétricos.', '{"eletrica","manutencao"}'),
  ('Treinamento NR-33 (Espaços Confinados)',      'SEGURANCA',   'Empresa acreditada MTE',      730, 'Obrigatório para trabalhos em espaços confinados em unidades industriais.', '{"manutencao","limpeza"}'),
  ('Treinamento NR-35 (Trabalho em Altura)',      'SEGURANCA',   'Empresa acreditada MTE',      730, 'Obrigatório para trabalhos acima de 2m.', '{"manutencao","construcao"}'),
  ('Registro CREA/CAU (Responsável Técnico)',    'TECNICO',     'CREA-AP / CAU-BR',             365, 'ART ou RRT do responsável técnico da empresa.', '{"engenharia","construcao"}'),
  ('Licença Ambiental (SEMA-AP)',                'AMBIENTAL',   'SEMA-AP',                     730, 'Quando aplicável — transporte de resíduos, construção, etc.', '{"transporte","construcao"}'),
  ('Certificação ISO 9001',                      'TECNICO',     'Organismo de certificação',   1095,'ISO de gestão da qualidade — exigida para contratos de maior valor.', '{}'),
  ('Due Diligence ASG (Petrobras)',              'PETROBRAS',   'Petrobras',                   365, 'Avaliação de integridade ASG do Programa Fortalecer / Canal Fornecedor.', '{}')
ON CONFLICT DO NOTHING;
