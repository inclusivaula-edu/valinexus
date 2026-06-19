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
      certificationScheduler.run().catch(err =>
        console.error('Scheduler manual falhou:', err)
      );
      res.json({ success: true, data: { message: 'Scheduler iniciado em background' } });
    } catch (err) { next(err); }
  }
);

export { router as notificationsRouter };
