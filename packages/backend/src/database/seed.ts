/**
 * database/seed.ts — Dados iniciais do sistema
 *
 * O seed faz três coisas essenciais na ordem correta:
 *
 * 1. Cria o usuário SUPER_ADMIN da valinexus (você, que opera o sistema)
 * 2. Cria a primeira empresa-cliente com dados reais
 * 3. Aplica os templates de certidões Petrobras nessa empresa
 *    (as 18 certidões padrão já cadastradas prontas para controle)
 *
 * Por que isso importa para o onboarding assistido:
 * Você vai sentar com o cliente, rodar este script com os dados dele,
 * e em 30 segundos ele já tem uma conta funcional com todas as certidões
 * listadas. Ele não precisa cadastrar nada — chega ao painel e vê o
 * trabalho pronto. Esse é o "wow moment" que converte trial em assinante.
 *
 * Como usar:
 *   npx ts-node src/database/seed.ts
 *
 * Com variáveis customizadas:
 *   CLIENT_EMAIL=empresa@exemplo.com CLIENT_CNPJ=12345678000190 npx ts-node src/database/seed.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Conexão direta — sem usar o pool do app para não precisar subir o servidor
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432'),
        database: process.env.DB_NAME ?? 'valinexus',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres_dev_password',
      }
);

// ─── Configuração via variáveis de ambiente ou valores padrão ────────────────
// Em produção: CLIENT_EMAIL=real@empresa.com npx ts-node src/database/seed.ts

const SUPER_ADMIN = {
  name: 'Clauderson Almeida',
  email: process.env.ADMIN_EMAIL ?? 'claudersonalmeida@gmail.com',
  password: process.env.ADMIN_PASSWORD ?? 'valinexus@2026!',
  phone: '(96) 99911-3575',
};

const FIRST_CLIENT = {
  cnpj: process.env.CLIENT_CNPJ ?? '12.345.678/0001-90',
  razaoSocial: process.env.CLIENT_RAZAO ?? 'Construtora Amapá Ltda',
  nomeFantasia: process.env.CLIENT_FANTASIA ?? 'ConstrAmapá',
  email: process.env.CLIENT_EMAIL ?? 'contato@constramapa.com.br',
  phone: process.env.CLIENT_PHONE ?? '(96) 3212-0000',
  whatsapp: process.env.CLIENT_WHATSAPP ?? '(96) 99900-0000',
  userEmail: process.env.CLIENT_USER_EMAIL ?? 'admin@constramapa.com.br',
  userPassword: process.env.CLIENT_USER_PASSWORD ?? 'Acesso@2026!',
  userName: process.env.CLIENT_USER_NAME ?? 'Responsável Técnico',
  serviceCategories: ['construcao', 'manutencao'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`  ${msg}`); }
function section(title: string) { console.log(`\n▸ ${title}`); }
function ok(msg: string) { console.log(`  ✅ ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`); }

// Gera uma data futura a partir de hoje + N dias
function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Gera uma data passada (já vencida) — para simular cenário real
function pastDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// ─── Certidões iniciais para a empresa cliente ────────────────────────────────
// Cada certidão tem um estado inicial realista:
// - algumas válidas (recém renovadas)
// - algumas a vencer em breve (urgência que justifica o produto)
// - algumas já vencidas (problema imediato que o sistema resolve)
// Esse mix cria o "dashboard que impressiona" no onboarding.

interface CertSeed {
  name: string;
  category: string;
  issuingBody: string;
  expiresAt: string;
  status: string;
  notes?: string;
}

function buildCertifications(): CertSeed[] {
  return [
    // ── Vencidas (vermelho) — urgência imediata
    {
      name: 'CRF — Certidão de Regularidade do FGTS',
      category: 'TRABALHISTA',
      issuingBody: 'Caixa Econômica Federal',
      expiresAt: pastDate(5),
      status: 'EXPIRED',
      notes: 'Venceu há 5 dias. Renovar em caixa.gov.br/sitefgts',
    },
    {
      name: 'NR-35 — Treinamento Trabalho em Altura',
      category: 'SEGURANCA',
      issuingBody: 'SENAI-AP',
      expiresAt: pastDate(45),
      status: 'EXPIRED',
      notes: 'Treinamento bienal. Contatar SENAI Macapá: (96) 3198-0400',
    },

    // ── A vencer em breve (amarelo) — pressão moderada
    {
      name: 'PGR — Programa de Gerenciamento de Riscos',
      category: 'SEGURANCA',
      issuingBody: 'Eng. de Segurança',
      expiresAt: futureDate(14),
      status: 'EXPIRING_SOON',
      notes: 'Renovação anual. Contatar engenheiro responsável.',
    },
    {
      name: 'CND Estadual (SEFAZ-AP)',
      category: 'FISCAL',
      issuingBody: 'SEFAZ-AP',
      expiresAt: futureDate(22),
      status: 'EXPIRING_SOON',
      notes: 'Emitir em sefaz.ap.gov.br — emissão gratuita e imediata',
    },
    {
      name: 'Alvará de Funcionamento',
      category: 'OPERACIONAL',
      issuingBody: 'Prefeitura de Macapá',
      expiresAt: futureDate(28),
      status: 'EXPIRING_SOON',
      notes: 'Renovação anual. Portal: macapa.ap.gov.br/servicos',
    },

    // ── Válidas (verde) — ok por enquanto
    {
      name: 'CND — Receita Federal / PGFN',
      category: 'FISCAL',
      issuingBody: 'Receita Federal do Brasil',
      expiresAt: futureDate(160),
      status: 'VALID',
    },
    {
      name: 'CNDT — Certidão Neg. Débitos Trabalhistas',
      category: 'TRABALHISTA',
      issuingBody: 'TST',
      expiresAt: futureDate(145),
      status: 'VALID',
    },
    {
      name: 'Registro no CRC Petrobras',
      category: 'PETROBRAS',
      issuingBody: 'Petrobras',
      expiresAt: futureDate(310),
      status: 'VALID',
      notes: 'Código CRC: cadastrar após aprovação no portal',
    },
    {
      name: 'Apólice de Seguro de Responsabilidade Civil',
      category: 'SEGURO',
      issuingBody: 'Porto Seguro',
      expiresAt: futureDate(205),
      status: 'VALID',
      notes: 'Apólice nº 0001234-5. Cobertura: R$ 500.000',
    },
    {
      name: 'PCMSO — Programa de Controle Médico',
      category: 'SEGURANCA',
      issuingBody: 'Médico do Trabalho',
      expiresAt: futureDate(270),
      status: 'VALID',
    },
    {
      name: 'CND Municipal (Macapá)',
      category: 'FISCAL',
      issuingBody: 'Prefeitura de Macapá',
      expiresAt: futureDate(120),
      status: 'VALID',
    },
    {
      name: 'Due Diligence ASG (Petrobras)',
      category: 'PETROBRAS',
      issuingBody: 'Petrobras / Fortalecer',
      expiresAt: futureDate(280),
      status: 'VALID',
      notes: 'Avaliação de integridade do Programa Fortalecer aprovada',
    },

    // ── Pendente de upload (roxo) — documentos sem arquivo ainda
    {
      name: 'ASO — Atestados de Saúde Ocupacional (equipe)',
      category: 'SEGURANCA',
      issuingBody: 'Médico do Trabalho',
      expiresAt: futureDate(90),
      status: 'PENDING_UPLOAD',
      notes: 'Subir ASO de todos os colaboradores alocados',
    },
    {
      name: 'Registro CREA (Responsável Técnico)',
      category: 'TECNICO',
      issuingBody: 'CREA-AP',
      expiresAt: futureDate(180),
      status: 'PENDING_UPLOAD',
      notes: 'Aguardando certidão de quitação anual do RT',
    },
  ];
}

// ─── Seed principal ───────────────────────────────────────────────────────────

async function seed() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   valinexus — Seed do banco de dados    ║');
  console.log('╚══════════════════════════════════════════╝');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. SUPER_ADMIN da plataforma ─────────────────────────────────────
    section('Criando usuário administrador valinexus...');

    // Empresa fantasma para o admin da plataforma (sem CNPJ real)
    const adminCompanyResult = await client.query(`
      INSERT INTO companies (
        cnpj, razao_social, nome_fantasia, email, phone, whatsapp,
        address_street, address_number, address_neighborhood,
        address_city, address_state, address_zip_code,
        status, plan_tier, plan_expires_at, service_categories
      ) VALUES (
        '00.000.000/0001-00', 'valinexus Tecnologia', 'valinexus',
        'admin@valinexus.com.br', '(96) 99911-3575', '(96) 99911-3575',
        'Av. FAB', '1', 'Centro',
        'Macapá', 'AP', '68900-000',
        'ACTIVE', 'ENTERPRISE', '2099-12-31', '{plataforma}'
      )
      ON CONFLICT (cnpj) DO UPDATE SET razao_social = EXCLUDED.razao_social
      RETURNING id
    `);
    const adminCompanyId = adminCompanyResult.rows[0].id;

    const adminHash = await bcrypt.hash(SUPER_ADMIN.password, 10);
    await client.query(`
      INSERT INTO users (company_id, name, email, password_hash, phone, role, must_change_password)
      VALUES ($1, $2, $3, $4, $5, 'SUPER_ADMIN', false)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [adminCompanyId, SUPER_ADMIN.name, SUPER_ADMIN.email, adminHash, SUPER_ADMIN.phone]);

    ok(`Admin criado: ${SUPER_ADMIN.email}`);
    log(`   Senha: ${SUPER_ADMIN.password}`);

    // ── 2. Primeira empresa cliente ──────────────────────────────────────
    section('Criando empresa cliente...');

    const companyResult = await client.query(`
      INSERT INTO companies (
        cnpj, razao_social, nome_fantasia, email, phone, whatsapp,
        address_street, address_number, address_neighborhood,
        address_city, address_state, address_zip_code,
        status, plan_tier, plan_expires_at, service_categories
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'Rua Cândido Mendes', '500', 'Central',
        'Macapá', 'AP', '68900-000',
        'ACTIVE', 'STARTER',
        $7,
        $8
      )
      ON CONFLICT (cnpj) DO UPDATE
        SET razao_social = EXCLUDED.razao_social,
            status = EXCLUDED.status
      RETURNING id
    `, [
      FIRST_CLIENT.cnpj,
      FIRST_CLIENT.razaoSocial,
      FIRST_CLIENT.nomeFantasia,
      FIRST_CLIENT.email,
      FIRST_CLIENT.phone,
      FIRST_CLIENT.whatsapp,
      futureDate(30), // plano trial de 30 dias
      `{${FIRST_CLIENT.serviceCategories.join(',')}}`,
    ]);

    const companyId = companyResult.rows[0].id;
    ok(`Empresa criada: ${FIRST_CLIENT.razaoSocial} (${FIRST_CLIENT.cnpj})`);
    log(`   ID: ${companyId}`);

    // ── 3. Usuário admin da empresa cliente ──────────────────────────────
    section('Criando usuário da empresa cliente...');

    const clientHash = await bcrypt.hash(FIRST_CLIENT.userPassword, 10);
    await client.query(`
      INSERT INTO users (company_id, name, email, password_hash, role, must_change_password)
      VALUES ($1, $2, $3, $4, 'COMPANY_ADMIN', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [companyId, FIRST_CLIENT.userName, FIRST_CLIENT.userEmail, clientHash]);

    ok(`Usuário cliente criado: ${FIRST_CLIENT.userEmail}`);
    log(`   Senha temporária: ${FIRST_CLIENT.userPassword}`);
    log(`   ⚠️  must_change_password = true — o cliente será obrigado a trocar a senha no primeiro login`);

    // ── 4. Certidões da empresa cliente ──────────────────────────────────
    section('Aplicando certidões Petrobras...');

    const certifications = buildCertifications();
    for (const cert of certifications) {
      await client.query(`
        INSERT INTO certifications (
          company_id, name, category, issuing_body,
          expires_at, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        companyId,
        cert.name,
        cert.category,
        cert.issuingBody,
        cert.expiresAt,
        cert.status,
        cert.notes ?? null,
      ]);
    }

    const expired = certifications.filter(c => c.status === 'EXPIRED').length;
    const expiring = certifications.filter(c => c.status === 'EXPIRING_SOON').length;
    const valid = certifications.filter(c => c.status === 'VALID').length;
    const pending = certifications.filter(c => c.status === 'PENDING_UPLOAD').length;

    ok(`${certifications.length} certidões cadastradas:`);
    log(`   🔴 ${expired} vencidas  ⏳ ${expiring} a vencer  ✅ ${valid} válidas  📤 ${pending} pendentes`);

    await client.query('COMMIT');

    // ── Resumo final ─────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║           SEED CONCLUÍDO ✅               ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('\n📋 Credenciais de acesso:\n');
    console.log('  ADMIN valinexus (plataforma):');
    console.log(`    Email:  ${SUPER_ADMIN.email}`);
    console.log(`    Senha:  ${SUPER_ADMIN.password}`);
    console.log('');
    console.log('  CLIENTE (empresa):');
    console.log(`    Email:  ${FIRST_CLIENT.userEmail}`);
    console.log(`    Senha:  ${FIRST_CLIENT.userPassword}`);
    console.log('');
    console.log('  Acesse: http://localhost:5173\n');

    if (expired > 0 || expiring > 0) {
      warn(`O cliente já tem ${expired + expiring} certidões críticas — o dashboard vai impressionar.`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed falhou:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
