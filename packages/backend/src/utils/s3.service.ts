/**
 * utils/s3.service.ts — Serviço de armazenamento de arquivos no AWS S3
 *
 * Por que AWS S3 e não armazenar no servidor?
 * - O servidor é efêmero em containers/Railway: reinicia, migra, escala.
 *   Qualquer arquivo salvo em disco some no próximo deploy.
 * - S3 é praticamente infinito, barato (primeiros 5GB gratuitos),
 *   redundante por design (99.999999999% de durabilidade) e tem
 *   CDN embutida via CloudFront se precisar.
 * - URLs pré-assinadas: o arquivo fica privado no bucket, mas geramos
 *   um link temporário (15min) para o cliente visualizar. Sem expor
 *   credenciais AWS no frontend.
 *
 * Por que AWS SDK v3 e não v2?
 * - V3 é modular: importamos só o que usamos (S3Client, PutObjectCommand)
 *   em vez do SDK inteiro. Bundle menor, startup mais rápido.
 * - V3 é o padrão atual — v2 está em modo manutenção.
 *
 * Estrutura de chaves no bucket:
 *   certifications/{certificationId}/{timestamp}-{filename}
 *
 * Isso agrupa os arquivos de cada certidão numa "pasta" virtual.
 * Fácil de listar, fácil de deletar em lote se a certidão for removida.
 *
 * Modo local (sem AWS configurada):
 * Se AWS_ACCESS_KEY_ID não estiver definida, o serviço opera em modo
 * simulado — loga a operação mas não faz o upload de fato. Isso garante
 * que o ambiente de desenvolvimento funciona sem conta AWS.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';
import path from 'path';

// ─── Configuração ─────────────────────────────────────────────────────────────

const REGION      = process.env.AWS_REGION      ?? 'sa-east-1';
const BUCKET      = process.env.S3_BUCKET_NAME  ?? 'valinexus-docs';
const KEY_ID      = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY  = process.env.AWS_SECRET_ACCESS_KEY;

// URL pré-assinada válida por 15 minutos — suficiente para visualizar/baixar
const PRESIGNED_URL_TTL_SECONDS = 15 * 60;

function isConfigured(): boolean {
  return !!(KEY_ID && SECRET_KEY);
}

// Singleton — criado uma vez e reutilizado
let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: KEY_ID!,
        secretAccessKey: SECRET_KEY!,
      },
    });
  }
  return _client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitiza o nome do arquivo para uso seguro como chave S3.
 * Remove caracteres especiais, espaços, acentos.
 * Preserva a extensão original.
 */
function sanitizeFilename(original: string): string {
  const ext  = path.extname(original).toLowerCase();
  const base = path.basename(original, ext)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9_-]/g, '-') // substitui especiais por hífen
    .replace(/-+/g, '-')             // colapsa hífens duplos
    .slice(0, 100);                  // limita tamanho
  return `${base}${ext}`;
}

/**
 * Monta a chave (path) do objeto no bucket.
 * Ex: certifications/uuid-cert/1704067200000-certidao-fgts.pdf
 */
function buildKey(certificationId: string, filename: string): string {
  const safe = sanitizeFilename(filename);
  return `certifications/${certificationId}/${Date.now()}-${safe}`;
}

// ─── Interface pública ────────────────────────────────────────────────────────

export interface UploadResult {
  key: string;       // chave no S3 (guardamos no banco — não a URL pública)
  fileUrl: string;   // URL pré-assinada temporária para visualização imediata
  bucket: string;
  size: number;
}

export const s3Service = {

  /**
   * Faz upload do buffer para o S3 e retorna a chave e uma URL temporária.
   *
   * Guardamos a CHAVE no banco (não a URL), porque:
   * - URLs pré-assinadas expiram — se guardarmos a URL, ela fica inválida
   * - A partir da chave, geramos uma URL nova sempre que o usuário precisar
   */
  async upload(
    certificationId: string,
    file: Express.Multer.File
  ): Promise<UploadResult> {

    const key = buildKey(certificationId, file.originalname);

    if (!isConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('AWS S3 não configurado: defina AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY');
      }
      logger.warn(`[S3 LOCAL] Upload simulado: ${key} (${file.size} bytes)`);
      return {
        key,
        fileUrl: `https://mock-s3.local/${BUCKET}/${key}`,
        bucket:  BUCKET,
        size:    file.size,
      };
    }

    const command = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        file.buffer,
      ContentType: file.mimetype,
      // Metadados úteis para auditoria no console AWS
      Metadata: {
        certificationId,
        originalName: file.originalname,
        uploadedAt:   new Date().toISOString(),
      },
    });

    await getClient().send(command);
    logger.info(`S3 upload OK: ${key} (${file.size} bytes)`);

    // Gera URL pré-assinada para visualização imediata após upload
    const fileUrl = await this.getSignedUrl(key);

    return { key, fileUrl, bucket: BUCKET, size: file.size };
  },

  /**
   * Gera uma URL pré-assinada temporária para acesso ao arquivo.
   * Chame este método sempre que o usuário precisar visualizar/baixar
   * o documento — nunca guarde a URL no banco.
   */
  async getSignedUrl(key: string): Promise<string> {
    if (!isConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('AWS S3 não configurado: defina AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY');
      }
      return `https://mock-s3.local/${BUCKET}/${key}?mock=true`;
    }

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(getClient(), command, {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    });
  },

  /**
   * Remove o arquivo do S3.
   * Chamado quando uma certidão é deletada — sem isso, os arquivos
   * acumulam no bucket gerando custo desnecessário.
   */
  async delete(key: string): Promise<void> {
    if (!isConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('AWS S3 não configurado: defina AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY');
      }
      logger.warn(`[S3 LOCAL] Delete simulado: ${key}`);
      return;
    }

    const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
    await getClient().send(command);
    logger.info(`S3 delete OK: ${key}`);
  },

  /**
   * Extrai a chave S3 de uma URL pré-assinada ou da chave direta.
   * Útil para deletar ao receber o fileUrl guardado no banco.
   */
  extractKey(fileUrlOrKey: string): string {
    // Se começa com "certifications/", já é uma chave
    if (fileUrlOrKey.startsWith('certifications/')) return fileUrlOrKey;

    try {
      const url = new URL(fileUrlOrKey);
      // Remove a barra inicial do pathname
      return url.pathname.replace(`/${BUCKET}/`, '').replace(/^\//, '');
    } catch {
      return fileUrlOrKey;
    }
  },
};
