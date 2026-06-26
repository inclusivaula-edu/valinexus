/**
 * notifications/scheduler.ts
 *
 * Todos os loops de background do VALINEXUS. Cada job é isolado:
 * falha num não para os outros.
 *
 * Crons registrados (Macapá, UTC-4, sem DST):
 *   • A cada 1h  — syncStatuses: VALID → EXPIRING_SOON → EXPIRED
 *   • 08:00      — dispatchAlerts + checkMissingCerts
 *   • 16:00      — dispatchAlerts (segundo turno)
 *   • Seg 07:00  — weeklyReport para SUPER_ADMIN
 *   • Dia 1 06:00— monthlyReport de conformidade
 */

import cron from 'node-cron';
import { certificationsService } from '../certifications/certifications.service';
import { notificationsRepository } from './notifications.repository';
import { whatsappService } from './whatsapp.service';
import { emailService } from './email.service';
import { regulatoryWatcherService } from '../../utils/regulatory-watcher.service';
import { logger } from '../../utils/logger';
import { computeAlertSeverity, AlertChannel } from '@valinexus/shared';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const TZ      = 'America/Manaus'; // Macapá: UTC-4, sem horário de verão

export const certificationScheduler = {

  start() {
    cron.schedule('0 * * * *',    () => this.syncStatuses(),                        { timezone: TZ });
    cron.schedule('0 8 * * *',    () => this.morningRun(),                          { timezone: TZ });
    cron.schedule('0 16 * * *',   () => this.dispatchAlerts(),                      { timezone: TZ });
    cron.schedule('0 7 * * 1',    () => this.weeklyReport(),                        { timezone: TZ });
    cron.schedule('0 6 1 * *',    () => this.monthlyReport(),                       { timezone: TZ });
    cron.schedule('0 5 * * 0',    () => this.regulatoryWatch(),                     { timezone: TZ });

    logger.info('✅ Scheduler registrado (Macapá UTC-4)');
    logger.info('   • Sync status:       a cada 1h');
    logger.info('   • Alertas:           08:00 e 16:00');
    logger.info('   • Missing certs:     08:00');
    logger.info('   • Relatório:         segunda 07:00');
    logger.info('   • Score mensal:      dia 1, 06:00');
    logger.info('   • Reg. watcher:      domingo 05:00');
  },

  // ── Jobs ───────────────────────────────────────────────────────────────────

  async syncStatuses() {
    try {
      const { expired, expiringSoon } = await certificationsService.syncAllStatuses();
      if (expired > 0 || expiringSoon > 0) {
        logger.info(`⏱️  Status sync: ${expired} expiradas, ${expiringSoon} a expirar`);
      }
    } catch (err) {
      logger.error('Status sync falhou:', err);
    }
  },

  async morningRun() {
    await this.dispatchAlerts();
    await this.checkMissingCerts();
  },

  async dispatchAlerts() {
    try {
      logger.info('📢 Disparando alertas de certidões...');
      const [wa, email] = await Promise.allSettled([
        this.dispatchChannel(AlertChannel.WHATSAPP),
        this.dispatchChannel(AlertChannel.EMAIL),
      ]);
      if (wa.status    === 'rejected') logger.error('WhatsApp dispatch falhou:', wa.reason);
      if (email.status === 'rejected') logger.error('Email dispatch falhou:', email.reason);
    } catch (err) {
      logger.error('dispatchAlerts falhou:', err);
    }
  },

  async dispatchChannel(channel: AlertChannel) {
    const due     = await notificationsRepository.findCertsDueForAlert(channel);
    const expired = await notificationsRepository.findExpiredCertsDueForAlert(channel);
    const all     = [...expired, ...due];

    if (all.length === 0) {
      logger.info(`[${channel}] Nenhum alerta pendente`);
      return;
    }

    logger.info(`[${channel}] ${all.length} alerta(s) a disparar`);
    let sent = 0, failed = 0;

    for (const cert of all) {
      const daysLeft = Math.ceil((cert.expiresAt.getTime() - Date.now()) / 86_400_000);
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
          certificationId: cert.certId, severity,
          channel: AlertChannel.WHATSAPP, message,
          success: result.success, messageId: result.messageId, error: result.error,
        });
      } else {
        result = await emailService.sendAlert({
          to:          cert.email,
          companyName: cert.companyName,
          certName:    cert.certName,
          daysLeft,
          appUrl:      APP_URL,
        });
        await notificationsRepository.saveAlertResult({
          certificationId: cert.certId, severity,
          channel: AlertChannel.EMAIL,
          message: emailService.buildSubject(cert.certName, daysLeft),
          success: result.success, messageId: result.messageId, error: result.error,
        });
      }

      result.success ? sent++ : failed++;
      await new Promise(r => setTimeout(r, 500)); // rate limit Evolution API
    }

    logger.info(`[${channel}] ✅ ${sent} enviados | ❌ ${failed} falhas`);
  },

  async checkMissingCerts() {
    try {
      logger.info('🔍 Verificando certidões faltantes...');
      const companies = await notificationsRepository.findCompaniesWithMissingCerts();

      if (companies.length === 0) {
        logger.info('✅ Nenhuma certidão obrigatória faltante');
        return;
      }

      logger.info(`⚠️  ${companies.length} empresa(s) com certidões faltantes`);

      for (const company of companies) {
        if (company.whatsappEnabled && company.whatsapp) {
          const msg = whatsappService.buildMissingCertsMessage({
            companyName: company.companyName,
            missing:     company.missingCerts,
            appUrl:      APP_URL,
          });
          await whatsappService.sendText(company.whatsapp, msg);
          await new Promise(r => setTimeout(r, 500));
        }

        if (company.emailEnabled && company.email) {
          await emailService.sendMissingCertsAlert({
            to:          company.email,
            companyName: company.companyName,
            missing:     company.missingCerts,
            appUrl:      APP_URL,
          });
        }

        logger.info(`  📋 ${company.companyName}: ${company.missingCerts.length} faltante(s)`);
      }
    } catch (err) {
      logger.error('checkMissingCerts falhou:', err);
    }
  },

  async weeklyReport() {
    try {
      logger.info('📊 Gerando relatório semanal...');
      const [stats, admins] = await Promise.all([
        notificationsRepository.getWeeklyStats(),
        notificationsRepository.findSuperAdminEmails(),
      ]);

      for (const email of admins) {
        await emailService.sendWeeklyReport({ to: email, stats, appUrl: APP_URL });
      }

      logger.info(`✅ Relatório semanal → ${admins.length} admin(s)`);
    } catch (err) {
      logger.error('weeklyReport falhou:', err);
    }
  },

  async regulatoryWatch() {
    try {
      logger.info('🔭 Iniciando varredura regulatória semanal...');
      const result = await regulatoryWatcherService.run();
      logger.info(
        `🔭 Varredura concluída: ${result.pagesChecked} portais, ` +
        `${result.changesFound} mudança(s), ${result.errors.length} erro(s)`
      );
      if (result.errors.length > 0) {
        result.errors.forEach(e => logger.warn(`  ⚠️  ${e}`));
      }
    } catch (err) {
      logger.error('regulatoryWatch falhou:', err);
    }
  },

  async monthlyReport() {
    try {
      logger.info('📈 Gerando relatório mensal...');
      const [stats, admins] = await Promise.all([
        notificationsRepository.getWeeklyStats(), // reusa mesma estrutura
        notificationsRepository.findSuperAdminEmails(),
      ]);

      for (const email of admins) {
        await emailService.sendWeeklyReport({
          to:      email,
          stats,
          appUrl:  APP_URL,
          monthly: true,
        });
      }

      logger.info(`✅ Relatório mensal → ${admins.length} admin(s)`);
    } catch (err) {
      logger.error('monthlyReport falhou:', err);
    }
  },
};
