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
import { CreateCertificationDto, UpdateCertificationDto } from '@valinexus/shared';

export const certificationsController = {

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      // companyId pode vir da URL (/companies/:companyId/certifications)
      // ou do token JWT (quando o usuário vê as próprias certidões)
      const companyId = req.params.companyId ?? req.user!.companyId;
      const certifications = await certificationsService.listByCompany(companyId);
      res.json({ success: true, data: certifications });
    } catch (err) {
      next(err); // passa para o error handler global em config/app.ts
    }
  },

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.params.companyId ?? req.user!.companyId;
      const dashboard = await certificationsService.getDashboard(companyId);
      res.json({ success: true, data: dashboard });
    } catch (err) {
      next(err);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
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
      const dto: CreateCertificationDto = {
        ...req.body,
        companyId: req.body.companyId ?? req.user!.companyId,
      };
      const certification = await certificationsService.create(dto);
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
      const dto: UpdateCertificationDto = req.body;
      const updated = await certificationsService.update(req.params.id, dto);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Certidão não encontrada' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Arquivo não enviado' });
      }
      const result = await certificationsService.uploadDocument(
        req.params.id,
        req.file
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /certifications/:id/download-url
   * Gera uma URL pré-assinada nova (válida por 15min) para o documento.
   * O frontend chama isso sempre que o usuário clicar em "Ver arquivo" —
   * nunca reutiliza a URL antiga, que pode ter expirado.
   */
  async getDownloadUrl(req: Request, res: Response, next: NextFunction) {
    try {
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
      const deleted = await certificationsService.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Certidão não encontrada' });
      }
      // 204 No Content — padrão REST para DELETE bem-sucedido sem body de resposta
      res.status(204).send();
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
};
