/**
 * notifications.routes.ts
 *
 * Endpoints do módulo de notificações:
 * - GET  /notifications/settings     — ler configurações da empresa
 * - PUT  /notifications/settings     — salvar configurações
 * - POST /notifications/test         — disparar um alerta de teste agora
 * - POST /notifications/run-scheduler — rodar o scheduler manualmente (admin)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import { notificationsRepository } from './notifications.repository';
import { whatsappService } from './whatsapp.service';
import { emailService } from './email.service';
import { certificationScheduler } from './scheduler';
import { UserRole, AlertChannel } from '@valinexus/shared';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticate);

const settingsSchema = z.object({
  body: z.object({
    whatsappEnabled:  z.boolean().optional(),
    emailEnabled:     z.boolean().optional(),
    whatsappNumber:   z.string().min(10).optional().nullable(),
    emailAddress:     z.string().email().optional().nullable(),
    alertDays:        z.array(z.number().int().min(1).max(90)).optional(),
    dailyAlertDays:   z.number().int().min(1).max(14).optional(),
  }),
});

// GET /api/v1/notifications/settings
router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const settings = await notificationsRepository.getSettingsByCompany(companyId);
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

// PUT /api/v1/notifications/settings
router.put('/settings', validateRequest(settingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    await notificationsRepository.upsertSettings(companyId, req.body);
    const updated = await notificationsRepository.getSettingsByCompany(companyId);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// POST /api/v1/notifications/test
// Envia uma mensagem de teste imediatamente (sem esperar o scheduler)
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel = 'WHATSAPP', to } = req.body as { channel?: string; to?: string };
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';

    const testMessage = {
      companyName: 'Empresa Teste',
      certName:    'CRF — Certidão de Regularidade do FGTS',
      daysLeft:    7,
      appUrl,
    };

    let result: { success: boolean; error?: string };

    if (channel === 'EMAIL') {
      const emailTo = to ?? req.user!.email;
      result = await emailService.sendAlert({ to: emailTo, ...testMessage });
    } else {
      const settings = await notificationsRepository.getSettingsByCompany(req.user!.companyId);
      const whatsappTo = to ?? settings?.whatsappNumber ?? '';
      if (!whatsappTo) {
        return res.status(400).json({ success: false, error: 'Número WhatsApp não configurado' });
      }
      const message = whatsappService.buildAlertMessage(testMessage);
      result = await whatsappService.sendText(whatsappTo, message);
    }

    res.json({ success: result.success, data: result });
  } catch (err) { next(err); }
});

// POST /api/v1/notifications/run-scheduler (apenas SUPER_ADMIN)
// Permite disparar o scheduler manualmente — útil para testar em produção
router.post('/run-scheduler',
  requireRole(UserRole.SUPER_ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Roda em background sem bloquear a resposta HTTP
      certificationScheduler.morningRun().catch((err: unknown) =>
        console.error('Scheduler manual falhou:', err)
      );
      res.json({ success: true, data: { message: 'Scheduler iniciado em background' } });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/notifications/regulatory-changes (apenas SUPER_ADMIN)
router.get('/regulatory-changes',
  requireRole(UserRole.SUPER_ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query<{
        id: string; source_url: string; source_name: string;
        change_type: string; summary: string; detected_at: Date;
        reviewed: boolean; reviewed_at: Date | null; action_taken: string | null;
      }>(
        `SELECT id, source_url, source_name, change_type, summary,
                detected_at, reviewed, reviewed_at, action_taken
         FROM regulatory_changes
         ORDER BY detected_at DESC
         LIMIT 200`
      );
      const data = result.rows.map(r => ({
        id:          r.id,
        sourceUrl:   r.source_url,
        sourceName:  r.source_name,
        changeType:  r.change_type,
        summary:     r.summary,
        detectedAt:  r.detected_at,
        reviewed:    r.reviewed,
        reviewedAt:  r.reviewed_at,
        actionTaken: r.action_taken,
      }));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/notifications/regulatory-changes/:id/review (apenas SUPER_ADMIN)
router.post('/regulatory-changes/:id/review',
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { actionTaken } = req.body as { actionTaken?: string };
      await db.query(
        `UPDATE regulatory_changes
         SET reviewed = true, reviewed_at = NOW(), reviewed_by = $1, action_taken = $2
         WHERE id = $3`,
        [req.user!.userId, actionTaken ?? null, id]
      );
      res.json({ success: true, data: { id, reviewed: true } });
    } catch (err) { next(err); }
  }
);

export { router as notificationsRouter };
