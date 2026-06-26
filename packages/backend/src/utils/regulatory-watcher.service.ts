/**
 * utils/regulatory-watcher.service.ts — Agente Regulatório (Fase 3)
 *
 * Monitora portais públicos da Petrobras e órgãos reguladores brasileiros
 * para detectar novas exigências de certificação para empresas terceirizadas.
 *
 * Fluxo (executado semanalmente pelo scheduler):
 *   1. Busca cada URL monitorada via HTTPS
 *   2. Gera hash SHA-256 do conteúdo
 *   3. Compara com o hash armazenado em regulatory_page_hashes
 *   4. Se mudou → envia para Claude analisar o que mudou
 *   5. Registra mudança em regulatory_changes
 *   6. Notifica SUPER_ADMIN por email
 *
 * Sem Playwright: usa https nativo do Node.js, que funciona para
 * portais públicos. Se a Petrobras exigir JS-rendering, o hash ainda
 * detecta mudanças no HTML base + redirect patterns.
 */

import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../database/connection';
import { logger } from './logger';

// ── URLs monitoradas ───────────────────────────────────────────────────────────
// Configurável via env: REGULATORY_URLS=url1|url2|...
// Padrão: portais públicos da Petrobras e órgãos federais relevantes

interface MonitoredPage {
  url: string;
  name: string;
}

function getMonitoredPages(): MonitoredPage[] {
  const envUrls = process.env.REGULATORY_URLS;
  if (envUrls) {
    return envUrls.split('|').map((entry, i) => {
      const [url, name] = entry.split('::');
      return { url: url.trim(), name: name?.trim() ?? `Portal ${i + 1}` };
    });
  }

  // Padrão: páginas públicas de portais regulatórios
  return [
    {
      url: 'https://fornecedores.petrobras.com.br/fornecedores/crc.aspx',
      name: 'Petrobras CRC — Cadastro de Fornecedores',
    },
    {
      url: 'https://fornecedores.petrobras.com.br/fornecedores/documentos.aspx',
      name: 'Petrobras — Documentos Exigidos',
    },
    {
      url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp-nrs/normas-regulamentadoras-de-seguranca-e-saude-no-trabalho',
      name: 'MTE — Normas Regulamentadoras (NRs)',
    },
    {
      url: 'https://www.gov.br/receita-federal/pt-br/assuntos/certidoes-e-situacao-fiscal/certidao-de-regularidade-fiscal',
      name: 'Receita Federal — CND/CNPJ',
    },
  ];
}

// ── HTTP fetch utilitário ──────────────────────────────────────────────────────

function fetchPage(url: string, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const req = (client as typeof https).get(
      url,
      {
        headers: {
          'User-Agent': 'VALINEXUS-RegulatoryBot/1.0 (+https://valinexus.com.br)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Segue redirect (max 3)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchPage(res.headers.location, timeoutMs).then(resolve).catch(reject);
          return;
        }

        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} em ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout (${timeoutMs}ms) em ${url}`));
    });
    req.on('error', reject);
  });
}

// ── SHA-256 de conteúdo relevante (strip whitespace/dates para reduzir falsos positivos) ──

function hashContent(html: string): string {
  // Remove timestamps, cookies banners e tokens que mudam a cada request
  const normalized = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ── Claude — análise de mudanças ───────────────────────────────────────────────

const REGULATORY_ANALYSIS_PROMPT = `Você é um especialista em compliance para empresas terceirizadas da Petrobras no Brasil.

Analise o conteúdo HTML de uma página regulatória e identifique:
1. Novas exigências de certificação/documentação para fornecedores
2. Mudanças em certidões já existentes (validade, formato, órgão emissor)
3. Remoção de exigências
4. Mudanças gerais relevantes para compliance de terceirizadas

Certidões relevantes para o contexto VALINEXUS:
- CND Federal (Receita Federal + PGFN)
- CND Estadual e Municipal (SEFAZ)
- CRF/FGTS (Caixa Econômica)
- CNDT (Tribunal Superior do Trabalho)
- NR-10, NR-33, NR-35 (Ministério do Trabalho)
- PPRA, PGR, PCMSO, ASO (Saúde e Segurança)
- CREA, CRQ (Conselhos profissionais)
- CRC Petrobras (cadastro específico)
- Licenças ambientais (IBAMA, SEMA-AP)
- Seguros RC e responsabilidade civil

Responda em JSON:
{
  "hasSignificantChanges": true|false,
  "changeType": "NEW_REQUIREMENT|UPDATED_REQUIREMENT|REMOVED_REQUIREMENT|CONTENT_CHANGE",
  "summary": "Resumo objetivo em português das mudanças relevantes (máx 500 chars)",
  "newRequirements": ["lista de novas exigências detectadas"],
  "confidence": "high|medium|low"
}

Se não houver mudanças relevantes para compliance, retorne hasSignificantChanges: false.`;

let _client: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (_client) return _client;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

interface ChangeAnalysis {
  hasSignificantChanges: boolean;
  changeType: string;
  summary: string;
  newRequirements: string[];
  confidence: string;
}

async function analyzeWithClaude(
  sourceName: string,
  html: string
): Promise<ChangeAnalysis> {
  const client = getAnthropicClient();
  if (!client) {
    return {
      hasSignificantChanges: true,
      changeType: 'CONTENT_CHANGE',
      summary: `Conteúdo de "${sourceName}" foi alterado (análise Claude indisponível — ANTHROPIC_API_KEY não configurada)`,
      newRequirements: [],
      confidence: 'low',
    };
  }

  // Envia apenas os primeiros 8000 chars para economizar tokens
  const excerpt = html.slice(0, 8000);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: REGULATORY_ANALYSIS_PROMPT,
    messages: [{
      role: 'user',
      content: `Página: ${sourceName}\n\nConteúdo HTML:\n${excerpt}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      hasSignificantChanges: true,
      changeType: 'CONTENT_CHANGE',
      summary: `Mudança detectada em "${sourceName}" (Claude não retornou análise estruturada)`,
      newRequirements: [],
      confidence: 'low',
    };
  }

  return JSON.parse(jsonMatch[0]) as ChangeAnalysis;
}

// ── Repository (DB) ────────────────────────────────────────────────────────────

interface StoredHash {
  content_hash: string;
  last_changed: Date;
}

async function getStoredHash(url: string): Promise<StoredHash | null> {
  const result = await db.query<StoredHash>(
    'SELECT content_hash, last_changed FROM regulatory_page_hashes WHERE url = $1',
    [url]
  );
  return result.rows[0] ?? null;
}

async function upsertHash(url: string, sourceName: string, hash: string): Promise<void> {
  await db.query(
    `INSERT INTO regulatory_page_hashes (url, source_name, content_hash, last_checked, last_changed)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (url) DO UPDATE SET
       content_hash  = EXCLUDED.content_hash,
       last_checked  = NOW(),
       last_changed  = CASE WHEN regulatory_page_hashes.content_hash <> EXCLUDED.content_hash
                            THEN NOW()
                            ELSE regulatory_page_hashes.last_changed END`,
    [url, sourceName, hash]
  );
}

async function touchLastChecked(url: string): Promise<void> {
  await db.query(
    'UPDATE regulatory_page_hashes SET last_checked = NOW() WHERE url = $1',
    [url]
  );
}

async function saveRegulatoryChange(params: {
  sourceUrl:    string;
  sourceName:   string;
  changeType:   string;
  summary:      string;
  rawDiff:      string;
  previousHash: string | null;
  currentHash:  string;
}): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO regulatory_changes
       (source_url, source_name, change_type, summary, raw_diff, previous_hash, current_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.sourceUrl, params.sourceName, params.changeType,
      params.summary, params.rawDiff,
      params.previousHash, params.currentHash,
    ]
  );
  return result.rows[0].id;
}

async function findSuperAdminEmails(): Promise<string[]> {
  const result = await db.query<{ email: string }>(
    `SELECT email FROM users WHERE role = 'SUPER_ADMIN' AND is_active = true`
  );
  return result.rows.map(r => r.email);
}

async function countUnreviewedChanges(): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM regulatory_changes WHERE reviewed = FALSE`
  );
  return parseInt(result.rows[0].count, 10);
}

// ── Serviço principal ──────────────────────────────────────────────────────────

export interface WatcherResult {
  pagesChecked:  number;
  changesFound:  number;
  errors:        string[];
}

export const regulatoryWatcherService = {

  async run(): Promise<WatcherResult> {
    const pages  = getMonitoredPages();
    const errors: string[] = [];
    let changesFound = 0;

    logger.info(`🔭 Regulatory Watcher — verificando ${pages.length} portal(is)...`);

    for (const page of pages) {
      try {
        const html = await fetchPage(page.url);
        const hash = hashContent(html);
        const stored = await getStoredHash(page.url);

        // Primeira vez — apenas registra o hash base
        if (!stored) {
          await upsertHash(page.url, page.name, hash);
          logger.info(`  📌 Hash base registrado: ${page.name}`);
          continue;
        }

        // Sem mudança
        if (stored.content_hash === hash) {
          await touchLastChecked(page.url);
          logger.info(`  ✅ Sem mudança: ${page.name}`);
          continue;
        }

        // Mudança detectada — analisa com Claude
        logger.info(`  ⚠️  Mudança detectada: ${page.name} — analisando...`);
        const analysis = await analyzeWithClaude(page.name, html);

        const changeId = await saveRegulatoryChange({
          sourceUrl:    page.url,
          sourceName:   page.name,
          changeType:   analysis.changeType ?? 'CONTENT_CHANGE',
          summary:      analysis.summary,
          rawDiff:      html.slice(0, 2000),
          previousHash: stored.content_hash,
          currentHash:  hash,
        });

        await upsertHash(page.url, page.name, hash);
        changesFound++;

        logger.info(`  📝 Mudança #${changeId} salva: ${analysis.summary.slice(0, 80)}...`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${page.name}: ${msg}`);
        logger.warn(`  ❌ Falha ao verificar ${page.name}: ${msg}`);
      }
    }

    if (changesFound > 0) {
      await this.notifyAdmins(changesFound);
    }

    logger.info(`🔭 Regulatory Watcher concluído: ${changesFound} mudança(s), ${errors.length} erro(s)`);
    return { pagesChecked: pages.length, changesFound, errors };
  },

  async notifyAdmins(changesFound: number): Promise<void> {
    const [admins, totalUnreviewed] = await Promise.all([
      findSuperAdminEmails(),
      countUnreviewedChanges(),
    ]);

    if (admins.length === 0) {
      logger.warn('[RegulatoryWatcher] Nenhum SUPER_ADMIN para notificar');
      return;
    }

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
    const { emailService } = await import('../modules/notifications/email.service');

    for (const email of admins) {
      await emailService.sendRegulatoryAlert({
        to:             email,
        changesFound,
        totalUnreviewed,
        appUrl,
      });
    }

    logger.info(`📧 Alerta regulatório enviado para ${admins.length} admin(s)`);
  },
};
