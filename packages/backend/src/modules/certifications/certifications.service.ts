/**
 * certifications.service.ts — Camada de lógica de negócio
 *
 * Este é o núcleo real do módulo de certidões. Enquanto o repository
 * fala com o banco e o controller fala com o HTTP, o service é onde
 * as regras do negócio vivem.
 *
 * Exemplos de regras de negócio aqui:
 * - Uma certidão não pode ser deletada se tiver alertas pendentes
 * - O compliance score é recalculado após cada atualização
 * - O arquivo enviado passa por validação de tipo MIME antes do upload
 */

import { certificationsRepository } from './certifications.repository';
import {
  Certification,
  CreateCertificationDto,
  UpdateCertificationDto,
  CompanyDashboard,
  CertificationStatus,
} from '@valinexus/shared';
import { logger } from '../../utils/logger';
import { db } from '../../database/connection';
import { s3Service } from '../../utils/s3.service';
import { documentExtractorService } from '../../utils/document-extractor.service';

export const certificationsService = {

  async listByCompany(companyId: string): Promise<Certification[]> {
    return certificationsRepository.findByCompanyId(companyId);
  },

  async getById(id: string): Promise<Certification | null> {
    return certificationsRepository.findById(id);
  },

  async create(dto: CreateCertificationDto): Promise<Certification> {
    // Validação de data: certidão não pode vencer no passado ao ser criada
    // (a menos que seja para registrar um histórico — futuramente)
    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt < new Date()) {
      logger.warn(`Criando certidão já vencida para empresa ${dto.companyId}: ${dto.name}`);
      // Não bloqueamos — a empresa pode querer registrar para saber que precisa renovar
    }
    return certificationsRepository.create(dto);
  },

  async update(id: string, dto: UpdateCertificationDto): Promise<Certification | null> {
    return certificationsRepository.update(id, dto);
  },

  async uploadDocument(
    certificationId: string,
    file: Express.Multer.File
  ): Promise<{ fileUrl: string; extracted: import('../../utils/document-extractor.service').ExtractedDocumentData }> {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new Error('Tipo de arquivo não suportado. Envie PDF, JPG ou PNG.');
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new Error('Arquivo muito grande. Limite: 10MB.');
    }

    // Extração automática de dados via Claude (roda em paralelo com o upload)
    const [uploadResult, extracted] = await Promise.all([
      s3Service.upload(certificationId, file),
      documentExtractorService.extractFromFile(file).catch(err => {
        logger.warn(`Extração automática falhou (não crítico): ${err.message}`);
        return documentExtractorService.emptyResult('low');
      }),
    ]);

    const { key, fileUrl } = uploadResult;
    await certificationsRepository.updateFileUrl(certificationId, fileUrl, key);

    // Se Claude extraiu dados com confiança suficiente, atualiza a certidão
    if (extracted.expiresAt && extracted.confidence !== 'low') {
      await certificationsRepository.update(certificationId, {
        ...(extracted.expiresAt    && { expiresAt:      extracted.expiresAt }),
        ...(extracted.issuedAt     && { issuedAt:        extracted.issuedAt }),
        ...(extracted.documentNumber && { documentNumber: extracted.documentNumber }),
      });
      logger.info(`Certidão ${certificationId} atualizada com dados extraídos pelo Claude (conf: ${extracted.confidence})`);
    }

    logger.info(`Documento salvo no S3: ${key}`);

    return { fileUrl, extracted };
  },

  async getDownloadUrl(certificationId: string): Promise<string | null> {
    const s3Key = await certificationsRepository.getS3Key(certificationId);
    if (!s3Key) return null;
    return s3Service.getSignedUrl(s3Key);
  },

  async delete(id: string): Promise<boolean> {
    const { deleted, s3Key } = await certificationsRepository.delete(id);

    // Remove o arquivo do S3 se existia — evita custo de armazenamento acumulado
    if (deleted && s3Key) {
      await s3Service.delete(s3Key).catch(err =>
        // Logar mas não falhar o delete da certidão por causa do S3
        logger.warn(`Falha ao deletar S3 key ${s3Key}: ${err.message}`)
      );
    }

    return deleted;
  },

  async getDashboard(companyId: string): Promise<Partial<CompanyDashboard>> {
    const certifications = await certificationsRepository.findByCompanyId(companyId);
    const complianceScore = await certificationsRepository.getComplianceScore(companyId);

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const summary = {
      total: certifications.length,
      valid: certifications.filter(c => c.status === CertificationStatus.VALID).length,
      expiringSoon: certifications.filter(c => c.status === CertificationStatus.EXPIRING_SOON).length,
      expired: certifications.filter(c => c.status === CertificationStatus.EXPIRED).length,
      pendingUpload: certifications.filter(c => c.status === CertificationStatus.PENDING_UPLOAD).length,
    };

    const criticalAlerts = certifications.filter(c =>
      c.status === CertificationStatus.EXPIRED ||
      (c.expiresAt <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000))
    );

    const upcomingExpirations = certifications.filter(c =>
      c.expiresAt > now && c.expiresAt <= in30Days
    );

    return {
      certificationSummary: summary,
      criticalAlerts,
      upcomingExpirations,
      complianceScore,
    };
  },

  async getTemplates() {
    const result = await db.query(
      'SELECT * FROM certification_templates ORDER BY category, name'
    );
    return result.rows;
  },

  /** Chamado pelo scheduler — sincroniza EXPIRED e EXPIRING_SOON em transação atômica */
  async syncAllStatuses(): Promise<{ expired: number; expiringSoon: number }> {
    const { expired, expiringSoon } = await certificationsRepository.syncAllStatuses();
    logger.info(`Status sync: ${expired} expiradas, ${expiringSoon} a expirar em breve`);
    return { expired, expiringSoon };
  },
};
