/**
 * certifications.controller.ts — Camada HTTP
 *
 * O controller tem UMA responsabilidade: traduzir HTTP para chamadas de
 * serviço e devolver a resposta no formato correto. Ele NÃO contém
 * lógica de negócio. Se você vê um `if` aqui que não é sobre HTTP,
 * ele está no lugar errado — pertence ao service.
 *
 * Fluxo de uma request:
 * Client → Router → Middleware (auth, validação) → Controller → Service → Repository → DB
 */

import { Request, Response, NextFunction } from 'express';
import { certificationsService } from './certifications.service';
import { CreateCertificationDto, UpdateCertificationDto, UserRole } from '@valinexus/shared';
import { documentExtractorService } from '../../utils/document-extractor.service';
import { auditService } from '../../utils/audit.service';

function resolveCompanyId(req: Request): string {
  const user = req.user!;
  if (user.role === UserRole.SUPER_ADMIN) {
    return req.params.companyId ?? (req.query.companyId as string) ?? user.companyId;
  }
  return user.companyId;
}

async function assertOwnership(req: Request, certId: string): Promise<boolean> {
  const user = req.user!;
  if (user.role === UserRole.SUPER_ADMIN) return true;
  const cert = await certificationsService.getById(certId);
  if (!cert) return false;
  return cert.companyId === user.companyId;
}

export const certificationsController = {

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = resolveCompanyId(req);
      const certifications = await certificationsService.listByCompany(companyId);
      res.json({ success: true, data: certifications });
    } catch (err) {
      next(err);
    }
  },

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = resolveCompanyId(req);
      const dashboard = await certificationsService.getDashboard(companyId);
      res.json({ success: true, data: dashboard });
    } catch (err) {
      next(err);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      if (!(await assertOwnership(req, req.params.id))) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }
      const certification = await certificationsService.getById(req.params.id);
      if (!certification) {
        return res.status(404).json({ success: false, error: 'Certidão não encontrada' });
      }
      res.json({ success: true, data: certification });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = resolveCompanyId(req);
      const dto: CreateCertificationDto = {
        ...req.body,
        companyId,
      };
      const certification = await certificationsService.create(dto);
      auditService.log({
        userId: req.user!.userId, companyId, action: 'CREATE',
        entityType: 'certification', entityId: certification.id,
        details: { name: dto.name, category: dto.category }, ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: certification });
    } catch (err) {
      if (err instanceof Error && err.message === 'CERTIDAO_DUPLICADA') {
        return res.status(409).json({ success: false, error: 'Já existe uma certidão com este nome e categoria para esta empresa.' });
      }
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!(await assertOwnership(req, req.params.id))) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }
      const dto: UpdateCertificationDto = req.body;
      const updated = await certificationsService.update(req.params.id, dto);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Certidão não encontrada' });
      }
      auditService.log({
        userId: req.user!.userId, companyId: req.user!.companyId, action: 'UPDATE',
        entityType: 'certification', entityId: req.params.id,
        details: dto as Record<string, unknown>, ipAddress: req.ip,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!(await assertOwnership(req, req.params.id))) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Arquivo não enviado' });
      }
      const result = await certificationsService.uploadDocument(
        req.params.id,
        req.file
      );
      res.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof Error && err.message.includes('S3 não configurado')) {
        return res.status(503).json({
          success: false,
          error: 'Armazenamento de arquivos não configurado. Contate o administrador do sistema.',
        });
      }
      next(err);
    }
  },

  async getDownloadUrl(req: Request, res: Response, next: NextFunction) {
    try {
      if (!(await assertOwnership(req, req.params.id))) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }
      const url = await certificationsService.getDownloadUrl(req.params.id);
      if (!url) {
        return res.status(404).json({ success: false, error: 'Documento não encontrado para esta certidão' });
      }
      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!(await assertOwnership(req, req.params.id))) {
        return res.status(403).json({ success: false, error: 'Acesso negado' });
      }
      const deleted = await certificationsService.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Certidão não encontrada' });
      }
      auditService.log({
        userId: req.user!.userId, companyId: req.user!.companyId, action: 'DELETE',
        entityType: 'certification', entityId: req.params.id, ipAddress: req.ip,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async extractFromFile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Arquivo não enviado' });
      }
      if (!documentExtractorService.isConfigured()) {
        return res.status(503).json({ success: false, error: 'OCR não configurado. Defina ANTHROPIC_API_KEY no servidor.' });
      }
      const extracted = await documentExtractorService.extractFromFile(req.file);
      res.json({ success: true, data: extracted });
    } catch (err) {
      next(err);
    }
  },

  async getTemplates(_req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await certificationsService.getTemplates();
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = resolveCompanyId(req);
      const query = (req.query.q as string ?? '').trim();
      const status = req.query.status as string | undefined;
      const category = req.query.category as string | undefined;

      let certs = await certificationsService.listByCompany(companyId);

      if (query) {
        const lower = query.toLowerCase();
        certs = certs.filter(c =>
          c.name.toLowerCase().includes(lower) ||
          (c.issuingBody && c.issuingBody.toLowerCase().includes(lower)) ||
          (c.documentNumber && c.documentNumber.toLowerCase().includes(lower))
        );
      }
      if (status) {
        certs = certs.filter(c => c.status === status);
      }
      if (category) {
        certs = certs.filter(c => c.category === category);
      }

      res.json({ success: true, data: certs });
    } catch (err) {
      next(err);
    }
  },

  async extractBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
      }
      if (!documentExtractorService.isConfigured()) {
        return res.status(503).json({ success: false, error: 'OCR não configurado. Defina ANTHROPIC_API_KEY no servidor.' });
      }

      const results = await Promise.allSettled(
        files.map(file => documentExtractorService.extractFromFile(file))
      );

      const extracted = results.map((r, i) => ({
        filename: files[i].originalname,
        success: r.status === 'fulfilled',
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? (r.reason as Error).message : null,
      }));

      res.json({ success: true, data: extracted });
    } catch (err) {
      next(err);
    }
  },
};
