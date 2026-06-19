/**
 * notifications/scheduler.ts — v2
 *
 * Reescrito para usar os canais reais (WhatsApp + Email).
 *
 * Mudanças em relação à v1:
 * - Usa notificationsRepository para queries com settings por empresa
 * - Chama whatsappService e emailService de verdade
 * - Registra resultado (sucesso/erro) em certification_alerts
 * - Lógica de "qual dia alertar" delegada ao banco (query já filtra)
 * - Alertas de certidões JÁ VENCIDAS também enviados (diariamente, por 7 dias)
 *
 * Agendamento:
 * - Todo dia às 08:00 horário de Macapá (America/Manaus, UTC-4, sem DST)
 */

import cron from 'node-cron';
import { certificationsService } from '../certifications/certifications.service';
import { notificationsRepository } from './notifications.repository';
import { whatsappService } from './whatsapp.service';
import { emailService } from './email.service';
import { logger } from '../../utils/logger';
import { computeAlertSeverity, AlertChannel, AlertSeverity } from '@valinexus/shared';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

export const certificationScheduler = {

  start() {
    cron.schedule('0 8 * * *', async () => {
      logger.info('⏰ Scheduler iniciado: verificando certidões...');
      await this.run();
    }, { timezone: 'America/Manaus' });

    logger.info('✅ Scheduler registrado — 08:00 diário (Macapá)');
  },

  async run() {
    try {
      // 1. Sincronizar status no banco
      const { expired, expiringSoon } = await certificationsService.syncAllStatuses();
      logger.info(`Status sync: ${expired} expiradas, ${expiringSoon} a expirar`);

      // 2. Disparar alertas por canal
      const [waResults, emailResults] = await Promise.allSettled([
        this.dispatchChannel(AlertChannel.WHATSAPP),
        this.dispatchChannel(AlertChannel.EMAIL),
      ]);

      if (waResults.status === 'rejected')    logger.error('WhatsApp dispatch falhou:', waResults.reason);
      if (emailResults.status === 'rejected') logger.error('Email dispatch falhou:', emailResults.reason);

      logger.info('✅ Scheduler concluído');
    } catch (err) {
      logger.error('❌ Erro crítico no scheduler:', err);
    }
  },

  async dispatchChannel(channel: AlertChannel) {
    // Busca certidões a vencer (não alertadas hoje neste canal)
    const dueCerts     = await notificationsRepository.findCertsDueForAlert(channel);
    // Busca certidões já vencidas (não alertadas hoje)
    const expiredCerts = await notificationsRepository.findExpiredCertsDueForAlert(channel);

    const allCerts = [...expiredCerts, ...dueCerts];
    if (allCerts.length === 0) {
      logger.info(`[${channel}] Nenhum alerta pendente`);
      return;
    }

    logger.info(`[${channel}] Disparando ${allCerts.length} alerta(s)...`);

    let sent = 0, failed = 0;

    for (const cert of allCerts) {
      const daysLeft = Math.ceil(
        (cert.expiresAt.getTime() - Date.now()) / 86400000
      );
      const severity = computeAlertSeverity(daysLeft);

      let result: { success: boolean; messageId?: string; error?: string };

      if (channel === AlertChannel.WHATSAPP) {
        const message = whatsappService.buildAlertMessage({
          companyName: cert.companyName,
          certName:    cert.certName,
          daysLeft,
          appUrl:      APP_URL,
        });
        result = await whatsappService.sendText(cert.whatsapp, message);

        await notificationsRepository.saveAlertResult({
          certificationId: cert.certId,
          severity,
          channel: AlertChannel.WHATSAPP,
          message,
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });

      } else {
        result = await emailService.sendAlert({
          to:          cert.email,
          companyName: cert.companyName,
          certName:    cert.certName,
          daysLeft,
          appUrl:      APP_URL,
        });

        const subject = emailService.buildSubject(cert.certName, daysLeft);
        await notificationsRepository.saveAlertResult({
          certificationId: cert.certId,
          severity,
          channel: AlertChannel.EMAIL,
          message: subject,
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });
      }

      if (result.success) {
        sent++;
        logger.info(`  ✅ [${channel}] ${cert.certName} → ${cert.companyName} (${daysLeft}d)`);
      } else {
        failed++;
        logger.warn(`  ❌ [${channel}] ${cert.certName} → ${cert.companyName}: ${result.error}`);
      }

      // Pausa de 500ms entre mensagens — evita rate limit da Evolution API
      await new Promise(r => setTimeout(r, 500));
    }

    logger.info(`[${channel}] Concluído: ${sent} enviados, ${failed} falhas`);
  },
};
