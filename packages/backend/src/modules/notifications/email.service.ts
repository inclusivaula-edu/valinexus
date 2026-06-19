/**
 * notifications/email.service.ts
 *
 * Serviço de email com Nodemailer.
 * Funciona como canal secundário — quando WhatsApp falha ou a empresa
 * prefere email, este serviço entra.
 *
 * Em desenvolvimento: usa Mailtrap (captura os emails sem enviar de verdade).
 * Em produção: troca para AWS SES ou Brevo (antigo Sendinblue) —
 * ambos têm plano gratuito generoso para o volume inicial do VALINEXUS.
 *
 * O template HTML do email é gerado inline — sem dependência de
 * template engine externa. Simples e portável.
 */

import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../../utils/logger';

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Singleton do transporter — criado uma vez, reutilizado
let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'sandbox.smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
    // Em produção com AWS SES, adicionar:
    // secure: true,
    // tls: { rejectUnauthorized: true }
  });

  return _transporter;
}

export const emailService = {

  async sendAlert(params: {
    to: string;
    companyName: string;
    certName: string;
    daysLeft: number;
    appUrl: string;
  }): Promise<SendResult> {

    const enabled = process.env.NOTIFICATIONS_ENABLED === 'true';
    if (!enabled) {
      logger.info(`[Email MOCK] Para: ${params.to} | ${params.certName} vence em ${params.daysLeft}d`);
      return { success: true, messageId: `mock_${Date.now()}` };
    }

    const from = `"${process.env.SMTP_FROM_NAME ?? 'VALINEXUS'}" <${process.env.SMTP_FROM_EMAIL ?? 'alertas@valinexus.com.br'}>`;

    const subject = this.buildSubject(params.certName, params.daysLeft);
    const html = this.buildHtml(params);

    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail({ from, to: params.to, subject, html });
      logger.info(`📧 Email enviado para ${params.to} — ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Email falhou para ${params.to}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  },

  buildSubject(certName: string, daysLeft: number): string {
    if (daysLeft <= 0)  return `🔴 VENCIDA: ${certName} — Ação imediata necessária`;
    if (daysLeft <= 7)  return `🔴 URGENTE: ${certName} vence em ${daysLeft} dia(s)`;
    if (daysLeft <= 15) return `🟠 ATENÇÃO: ${certName} vence em ${daysLeft} dias`;
    return `🟡 AVISO: ${certName} vence em ${daysLeft} dias`;
  },

  buildHtml(params: {
    companyName: string;
    certName: string;
    daysLeft: number;
    appUrl: string;
  }): string {
    const { companyName, certName, daysLeft, appUrl } = params;
    const dashboardUrl = `${appUrl}/dashboard`;

    const isExpired  = daysLeft <= 0;
    const isCritical = daysLeft <= 7;
    const isHigh     = daysLeft <= 15;

    const accentColor = isExpired || isCritical ? '#ef4444'
      : isHigh ? '#f97316'
      : '#eab308';

    const statusText = isExpired
      ? 'CERTIDÃO VENCIDA'
      : isCritical ? `VENCE EM ${daysLeft} DIA(S)`
      : isHigh ? `VENCE EM ${daysLeft} DIAS`
      : `VENCE EM ${daysLeft} DIAS`;

    const bodyText = isExpired
      ? `A certidão <strong>${certName}</strong> está <strong>VENCIDA</strong>. Renove imediatamente para evitar bloqueio no CRC Petrobras e suspensão de contratos.`
      : isCritical
        ? `A certidão <strong>${certName}</strong> vence em <strong>${daysLeft} dia(s)</strong>. Prazo crítico — renove hoje.`
        : isHigh
          ? `A certidão <strong>${certName}</strong> vence em <strong>${daysLeft} dias</strong>. Inicie o processo de renovação agora.`
          : `A certidão <strong>${certName}</strong> vence em <strong>${daysLeft} dias</strong>. Programe a renovação para evitar problemas futuros.`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta VALINEXUS</title>
</head>
<body style="margin:0;padding:0;background:#0a1a0e;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1a0e;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0d1f0f;border:1px solid #1a5c28;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:24px;">⛽</span>
                  <span style="font-family:monospace;font-weight:700;font-size:18px;color:#fff;letter-spacing:2px;margin-left:10px;">VALINEXUS</span>
                </td>
                <td align="right">
                  <span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;">MACAPÁ · AP</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Status banner -->
        <tr>
          <td style="background:${accentColor}18;border-bottom:2px solid ${accentColor};padding:16px 28px;">
            <span style="font-family:monospace;font-size:13px;font-weight:700;color:${accentColor};letter-spacing:2px;">
              ${statusText}
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px;">
            <p style="color:#9ab5a0;font-size:14px;margin:0 0 6px;">Empresa</p>
            <p style="color:#e2f0e8;font-size:16px;font-weight:700;margin:0 0 20px;">${companyName}</p>

            <p style="color:#9ab5a0;font-size:14px;margin:0 0 6px;">Certidão</p>
            <p style="color:#e2f0e8;font-size:16px;font-weight:700;margin:0 0 20px;">${certName}</p>

            <p style="color:#a7d9b2;font-size:14px;line-height:1.7;margin:0 0 28px;">${bodyText}</p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:linear-gradient(135deg,#059669,#10b981);">
                  <a href="${dashboardUrl}"
                     style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.5px;">
                    Acessar painel agora →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #1a3a1e;">
            <p style="color:#3d6b4a;font-size:11px;margin:0;font-family:monospace;">
              VALINEXUS · Gestão de Conformidade para Fornecedores Petrobras · Macapá, AP
            </p>
            <p style="color:#2a4a2e;font-size:11px;margin:6px 0 0;">
              Você recebe este alerta porque sua empresa está cadastrada no VALINEXUS.
              <a href="${appUrl}" style="color:#3d6b4a;">Gerenciar preferências</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  },
};
