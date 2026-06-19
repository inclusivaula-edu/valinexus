/**
 * notifications/notifications.repository.ts
 *
 * Queries de banco para o módulo de notificações.
 * Separado do scheduler para manter responsabilidades claras.
 */

import { db } from '../../database/connection';
import { AlertSeverity, AlertChannel } from '@valinexus/shared';

export interface NotificationSettings {
  companyId: string;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  whatsappNumber: string | null;
  emailAddress: string | null;
  alertDays: number[];
  dailyAlertDays: number;
  sendHour: number;
}

export interface CertificationAlertRow {
  certId: string;
  certName: string;
  companyId: string;
  companyName: string;
  whatsapp: string;
  email: string;
  expiresAt: Date;
}

function mapSettings(row: Record<string, unknown>): NotificationSettings {
  return {
    companyId:       row.company_id as string,
    whatsappEnabled: row.whatsapp_enabled as boolean,
    emailEnabled:    row.email_enabled as boolean,
    whatsappNumber:  row.whatsapp_number as string | null,
    emailAddress:    row.email_address as string | null,
    alertDays:       row.alert_days as number[],
    dailyAlertDays:  row.daily_alert_days as number,
    sendHour:        row.send_hour as number,
  };
}

export const notificationsRepository = {

  async getSettingsByCompany(companyId: string): Promise<NotificationSettings | null> {
    const result = await db.query(
      'SELECT * FROM notification_settings WHERE company_id = $1',
      [companyId]
    );
    return result.rows.length > 0 ? mapSettings(result.rows[0]) : null;
  },

  async upsertSettings(companyId: string, settings: Partial<NotificationSettings>): Promise<void> {
    await db.query(`
      INSERT INTO notification_settings
        (company_id, whatsapp_enabled, email_enabled, whatsapp_number, email_address, alert_days, daily_alert_days)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (company_id) DO UPDATE SET
        whatsapp_enabled  = EXCLUDED.whatsapp_enabled,
        email_enabled     = EXCLUDED.email_enabled,
        whatsapp_number   = EXCLUDED.whatsapp_number,
        email_address     = EXCLUDED.email_address,
        alert_days        = EXCLUDED.alert_days,
        daily_alert_days  = EXCLUDED.daily_alert_days
    `, [
      companyId,
      settings.whatsappEnabled ?? true,
      settings.emailEnabled ?? true,
      settings.whatsappNumber ?? null,
      settings.emailAddress ?? null,
      settings.alertDays ?? [30, 15, 7],
      settings.dailyAlertDays ?? 3,
    ]);
  },

  /**
   * Busca certidões que vencem em exatamente N dias E ainda não foram
   * alertadas hoje neste canal.
   *
   * O JOIN com notification_settings garante que só notificamos empresas
   * que têm o canal ativo. O LEFT JOIN com certification_alerts filtra
   * as que já receberam alerta hoje.
   */
  async findCertsDueForAlert(channel: AlertChannel): Promise<CertificationAlertRow[]> {
    const channelCol = channel === AlertChannel.WHATSAPP
      ? 'ns.whatsapp_enabled'
      : 'ns.email_enabled';

    const contactCol = channel === AlertChannel.WHATSAPP
      ? 'COALESCE(ns.whatsapp_number, comp.whatsapp)'
      : 'COALESCE(ns.email_address, comp.email)';

    const result = await db.query(`
      SELECT
        c.id           AS cert_id,
        c.name         AS cert_name,
        comp.id        AS company_id,
        comp.razao_social AS company_name,
        ${contactCol}  AS contact,
        c.expires_at,
        -- Dias restantes calculado no banco para precisão
        (c.expires_at::DATE - NOW()::DATE)::INTEGER AS days_left
      FROM certifications c
      JOIN companies comp ON comp.id = c.company_id
      JOIN notification_settings ns ON ns.company_id = comp.id
      WHERE
        comp.status = 'ACTIVE'
        AND c.status NOT IN ('EXPIRED')
        AND ${channelCol} = true
        AND ${contactCol} IS NOT NULL
        -- Vence entre hoje e 30 dias (janela máxima de alerta)
        AND c.expires_at::DATE BETWEEN NOW()::DATE AND (NOW()::DATE + INTERVAL '30 days')
        -- Não foi alertado hoje neste canal
        AND NOT EXISTS (
          SELECT 1 FROM certification_alerts ca
          WHERE ca.certification_id = c.id
            AND ca.channel = $1
            AND ca.sent_at::DATE = NOW()::DATE
            AND ca.error_message IS NULL  -- só conta envios bem-sucedidos
        )
      ORDER BY c.expires_at ASC
    `, [channel]);

    return result.rows.map(row => ({
      certId:      row.cert_id as string,
      certName:    row.cert_name as string,
      companyId:   row.company_id as string,
      companyName: row.company_name as string,
      whatsapp:    row.contact as string,
      email:       row.contact as string,
      expiresAt:   new Date(row.expires_at as string),
      daysLeft:    row.days_left as number,
    }));
  },

  /**
   * Busca também certidões JÁ VENCIDAS que precisam de alerta diário
   * (enquanto não forem renovadas, continuam no radar).
   */
  async findExpiredCertsDueForAlert(channel: AlertChannel): Promise<CertificationAlertRow[]> {
    const channelCol = channel === AlertChannel.WHATSAPP
      ? 'ns.whatsapp_enabled'
      : 'ns.email_enabled';
    const contactCol = channel === AlertChannel.WHATSAPP
      ? 'COALESCE(ns.whatsapp_number, comp.whatsapp)'
      : 'COALESCE(ns.email_address, comp.email)';

    const result = await db.query(`
      SELECT
        c.id           AS cert_id,
        c.name         AS cert_name,
        comp.id        AS company_id,
        comp.razao_social AS company_name,
        ${contactCol}  AS contact,
        c.expires_at
      FROM certifications c
      JOIN companies comp ON comp.id = c.company_id
      JOIN notification_settings ns ON ns.company_id = comp.id
      WHERE
        comp.status = 'ACTIVE'
        AND c.status = 'EXPIRED'
        AND ${channelCol} = true
        AND ${contactCol} IS NOT NULL
        -- Alerta de vencida uma vez por dia, máximo 7 dias após vencer
        AND c.expires_at::DATE >= (NOW()::DATE - INTERVAL '7 days')
        AND NOT EXISTS (
          SELECT 1 FROM certification_alerts ca
          WHERE ca.certification_id = c.id
            AND ca.channel = $1
            AND ca.sent_at::DATE = NOW()::DATE
            AND ca.error_message IS NULL
        )
    `, [channel]);

    return result.rows.map(row => ({
      certId:      row.cert_id as string,
      certName:    row.cert_name as string,
      companyId:   row.company_id as string,
      companyName: row.company_name as string,
      whatsapp:    row.contact as string,
      email:       row.contact as string,
      expiresAt:   new Date(row.expires_at as string),
    }));
  },

  async saveAlertResult(params: {
    certificationId: string;
    severity: AlertSeverity;
    channel: AlertChannel;
    message: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }): Promise<void> {
    await db.query(`
      INSERT INTO certification_alerts
        (certification_id, severity, channel, message, delivered_at, error_message)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      params.certificationId,
      params.severity,
      params.channel,
      params.message,
      params.success ? new Date() : null,
      params.error ?? null,
    ]);
  },
};
