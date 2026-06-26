/**
 * utils/document-extractor.service.ts — Agente de Documentos (Fase 2)
 *
 * Usa a Claude API para extrair automaticamente data de validade e tipo
 * de certidão de PDFs e imagens enviados pelos clientes.
 *
 * Fluxo:
 *   1. Arquivo chega via multipart/form-data (multer)
 *   2. Este serviço converte para base64 e envia para Claude
 *   3. Claude lê o documento e retorna JSON estruturado
 *   4. O controller usa os dados para pré-preencher o cadastro
 *
 * Por que Claude e não Tesseract/AWS Textract?
 *   - Tesseract OCR extrai texto bruto — ainda precisa de regex frágil
 *     para encontrar a data em formatos variados (DD/MM/YYYY, por extenso, etc.)
 *   - Textract é pago por página e não entende contexto semântico
 *   - Claude lê, entende e já retorna o campo certo em JSON — uma chamada
 *
 * Custo estimado: ~0,01 USD por documento (Haiku 4.5)
 * Latência: 3-8 segundos por documento
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';

export interface ExtractedDocumentData {
  certificationName: string | null;     // ex: "Certidão de Regularidade do FGTS"
  issuingBody: string | null;           // ex: "Caixa Econômica Federal"
  documentNumber: string | null;        // número do documento/certidão
  issuedAt: string | null;              // ISO date: "2024-01-15"
  expiresAt: string | null;             // ISO date: "2024-07-15" ← o mais importante
  category: string | null;             // FISCAL | TRABALHISTA | SEGURANCA | etc.
  confidence: 'high' | 'medium' | 'low';
  rawText: string | null;              // texto bruto extraído para auditoria
}

const SYSTEM_PROMPT = `Você é um especialista em documentos regulatórios brasileiros para empresas terceirizadas da Petrobras.
Você analisa certidões, atestados e documentos de conformidade e extrai informações estruturadas.

Responda SEMPRE com JSON válido no formato exato abaixo. Se não conseguir identificar um campo, use null.
{
  "certificationName": "nome completo da certidão",
  "issuingBody": "órgão emissor",
  "documentNumber": "número do documento se visível",
  "issuedAt": "YYYY-MM-DD ou null",
  "expiresAt": "YYYY-MM-DD ou null",
  "category": "FISCAL|TRABALHISTA|SEGURANCA|TECNICO|AMBIENTAL|OPERACIONAL|PETROBRAS|SEGURO ou null",
  "confidence": "high|medium|low",
  "rawText": "primeiros 500 chars do texto extraído"
}

Mapeamento de categorias:
- FISCAL: CND Federal, PGFN, Receita Federal, CND Estadual, CND Municipal, SEFAZ
- TRABALHISTA: FGTS, CRF, CNDT, TST, débitos trabalhistas
- SEGURANCA: NR-10, NR-33, NR-35, PPRA, PGR, PCMSO, ASO, CIPA, SESMT
- TECNICO: CREA, CAU, CRQ, ISO, ART, RRT
- AMBIENTAL: IBAMA, SEMA, licença ambiental
- OPERACIONAL: Alvará, licença de funcionamento
- PETROBRAS: CRC, ASG, cadastro Petrobras
- SEGURO: apólice, seguro RC, responsabilidade civil

Para datas: converta qualquer formato para YYYY-MM-DD. Se a validade for expressa como "válida por 180 dias a partir de DD/MM/YYYY", calcule a data de vencimento.`;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada');
  _client = new Anthropic({ apiKey });
  return _client;
}

export const documentExtractorService = {

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  },

  async extractFromFile(file: Express.Multer.File): Promise<ExtractedDocumentData> {
    if (!this.isConfigured()) {
      logger.warn('[DocumentExtractor] ANTHROPIC_API_KEY não configurada — extração desabilitada');
      return this.emptyResult('low');
    }

    const supported = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!supported.includes(file.mimetype)) {
      logger.warn(`[DocumentExtractor] Tipo não suportado: ${file.mimetype}`);
      return this.emptyResult('low');
    }

    try {
      const base64 = file.buffer.toString('base64');

      // PDFs usam document block, imagens usam image block
      const contentBlock = file.mimetype === 'application/pdf'
        ? {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: base64,
            },
          }
        : {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp',
              data: base64,
            },
          };

      const response = await getClient().messages.create({
        model:      'claude-haiku-4-5-20251001', // rápido e barato para extração
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: 'Extraia as informações desta certidão e retorne o JSON.',
            },
          ],
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('[DocumentExtractor] Claude não retornou JSON válido');
        return this.emptyResult('low');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ExtractedDocumentData;
      logger.info(`[DocumentExtractor] Extraído: "${parsed.certificationName}" | venc: ${parsed.expiresAt} | conf: ${parsed.confidence}`);
      return parsed;

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[DocumentExtractor] Falhou: ${errMsg}`);
      return this.emptyResult('low');
    }
  },

  emptyResult(confidence: 'high' | 'medium' | 'low'): ExtractedDocumentData {
    return {
      certificationName: null,
      issuingBody:       null,
      documentNumber:    null,
      issuedAt:          null,
      expiresAt:         null,
      category:          null,
      confidence,
      rawText:           null,
    };
  },
};
