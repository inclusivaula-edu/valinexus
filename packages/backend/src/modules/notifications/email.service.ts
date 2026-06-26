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

  async sendWelcomeCredentials(params: {
    to: string;
    adminName: string;
    companyName: string;
    temporaryPassword: string;
    appUrl: string;
  }): Promise<SendResult> {
    const { to, adminName, companyName, temporaryPassword, appUrl } = params;
    const from = `"${process.env.SMTP_FROM_NAME ?? 'VALINEXUS'}" <${process.env.SMTP_FROM_EMAIL ?? 'alertas@valinexus.com.br'}>`;
    const loginUrl = `${appUrl}/login`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Bem-vindo ao VALINEXUS</title></head>
<body style="margin:0;padding:0;background:#0a1a0e;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1a0e;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0d1f0f;border:1px solid #1a5c28;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 28px;">
            <span style="font-family:monospace;font-weight:700;font-size:18px;color:#fff;letter-spacing:2px;">⛽ VALINEXUS</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="color:#e2f0e8;font-size:16px;font-weight:700;margin:0 0 8px;">Bem-vindo(a), ${adminName}!</p>
            <p style="color:#a7d9b2;font-size:14px;line-height:1.7;margin:0 0 24px;">
              Sua empresa <strong>${companyName}</strong> foi cadastrada no VALINEXUS.<br>
              Use as credenciais abaixo para acessar o painel pela primeira vez.
            </p>
            <table cellpadding="0" cellspacing="0" style="background:#070f0a;border:1px solid #1a3a22;border-radius:8px;padding:16px;width:100%;">
              <tr><td style="padding:6px 0;">
                <span style="color:#3d6b4a;font-family:monospace;font-size:12px;">LOGIN</span><br>
                <span style="color:#e2f0e8;font-family:monospace;font-size:15px;">${to}</span>
              </td></tr>
              <tr><td style="padding:6px 0;">
                <span style="color:#3d6b4a;font-family:monospace;font-size:12px;">SENHA TEMPORÁRIA</span><br>
                <span style="color:#fbbf24;font-family:monospace;font-size:15px;font-weight:700;">${temporaryPassword}</span>
              </td></tr>
            </table>
            <p style="color:#5a9a68;font-size:12px;margin:14px 0 24px;">
              ⚠️ Você será obrigado(a) a trocar essa senha no primeiro acesso.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:linear-gradient(135deg,#059669,#10b981);">
                  <a href="${loginUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">
                    Acessar o painel →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #1a3a1e;">
            <p style="color:#2a4a2e;font-size:11px;margin:0;font-family:monospace;">
              VALINEXUS · Gestão de Conformidade Petrobras · Macapá, AP
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail({
        from,
        to,
        subject: `🔐 Suas credenciais de acesso — VALINEXUS`,
        html,
      });
      logger.info(`📧 Credenciais enviadas para ${to} — ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Falha ao enviar credenciais para ${to}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  },

  async sendMissingCertsAlert(params: {
    to: string;
    companyName: string;
    missing: Array<{ templateName: string; category: string; issuingBody: string; typicalValidityDays: number }>;
    appUrl: string;
  }): Promise<SendResult> {
    const { to, companyName, missing, appUrl } = params;
    const from = `"${process.env.SMTP_FROM_NAME ?? 'VALINEXUS'}" <${process.env.SMTP_FROM_EMAIL ?? 'alertas@valinexus.com.br'}>`;

    const rows = missing.map(m => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #1a3a1e;color:#e2f0e8;">${m.templateName}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a3a1e;color:#9ab5a0;">${m.issuingBody}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a3a1e;color:#fbbf24;">${m.typicalValidityDays}d</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a1a0e;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1a0e;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#0d1f0f;border:1px solid #1a5c28;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 28px;">
        <span style="font-family:monospace;font-weight:700;font-size:18px;color:#fff;letter-spacing:2px;">⛽ VALINEXUS</span>
      </td></tr>
      <tr><td style="background:#f59e0b18;border-bottom:2px solid #f59e0b;padding:14px 28px;">
        <span style="font-family:monospace;font-size:12px;font-weight:700;color:#f59e0b;letter-spacing:2px;">⚠️ CERTIDÕES OBRIGATÓRIAS FALTANDO</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <p style="color:#e2f0e8;font-size:15px;font-weight:700;margin:0 0 6px;">${companyName}</p>
        <p style="color:#a7d9b2;font-size:13px;line-height:1.7;margin:0 0 20px;">
          As certidões abaixo são <strong>exigidas pelo CRC Petrobras</strong> e não estão cadastradas no seu painel.
          Cadastre-as para evitar irregularidades.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a3a1e;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#070f0a;">
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#5a9a68;font-weight:600;">Certidão</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#5a9a68;font-weight:600;">Órgão</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#5a9a68;font-weight:600;">Validade</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
          <tr><td style="border-radius:8px;background:linear-gradient(135deg,#059669,#10b981);">
            <a href="${appUrl}/dashboard" style="display:inline-block;padding:12px 24px;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">
              Cadastrar certidões →
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 28px;border-top:1px solid #1a3a1e;">
        <p style="color:#2a4a2e;font-size:11px;margin:0;font-family:monospace;">VALINEXUS · Gestão de Conformidade Petrobras · Macapá, AP</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    try {
      const info = await getTransporter().sendMail({
        from, to,
        subject: `⚠️ ${missing.length} certidão(ões) faltando no seu cadastro — VALINEXUS`,
        html,
      });
      logger.info(`📧 Missing-certs enviado para ${to}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Missing-certs falhou para ${to}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  },

  async sendWeeklyReport(params: {
    to: string;
    stats: {
      activeCompanies: number;
      totalCerts: number;
      validCerts: number;
      expiredCerts: number;
      expiringSoonCerts: number;
      upcomingExpirations: Array<{ companyName: string; certName: string; daysLeft: number }>;
      topRiskCompanies: Array<{ companyName: string; expiredCount: number }>;
    };
    appUrl: string;
    monthly?: boolean;
  }): Promise<SendResult> {
    const { to, stats, appUrl, monthly = false } = params;
    const from = `"${process.env.SMTP_FROM_NAME ?? 'VALINEXUS'}" <${process.env.SMTP_FROM_EMAIL ?? 'alertas@valinexus.com.br'}>`;
    const period = monthly ? 'Mensal' : 'Semanal';
    const compliancePct = stats.totalCerts > 0
      ? Math.round((stats.validCerts / stats.totalCerts) * 100)
      : 0;

    const upcomingRows = stats.upcomingExpirations.slice(0, 10).map(u => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #1a3a1e;color:#e2f0e8;font-size:12px;">${u.companyName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #1a3a1e;color:#9ab5a0;font-size:12px;">${u.certName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #1a3a1e;color:${u.daysLeft <= 7 ? '#ef4444' : u.daysLeft <= 15 ? '#f59e0b' : '#22c55e'};font-size:12px;font-weight:700;">${u.daysLeft}d</td>
      </tr>`).join('');

    const riskRows = stats.topRiskCompanies.map(r => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #1a3a1e;color:#e2f0e8;font-size:12px;">${r.companyName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #1a3a1e;color:#ef4444;font-size:12px;font-weight:700;">${r.expiredCount} vencida(s)</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a1a0e;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1a0e;padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#0d1f0f;border:1px solid #1a5c28;border-radius:12px;overflow:hidden;max-width:580px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 28px;">
        <span style="font-family:monospace;font-weight:700;font-size:18px;color:#fff;letter-spacing:2px;">⛽ VALINEXUS</span>
        <span style="float:right;font-size:12px;color:rgba(255,255,255,0.7);">Relatório ${period}</span>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <p style="color:#e2f0e8;font-size:15px;font-weight:700;margin:0 0 20px;">Resumo de Conformidade — ${new Date().toLocaleDateString('pt-BR')}</p>

        <!-- KPIs -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="text-align:center;padding:14px;background:#070f0a;border:1px solid #1a3a1e;border-radius:8px;width:25%;">
              <div style="font-size:22px;font-weight:800;color:#e2f0e8;">${stats.activeCompanies}</div>
              <div style="font-size:10px;color:#5a9a68;margin-top:2px;">EMPRESAS ATIVAS</div>
            </td>
            <td style="width:3%;"></td>
            <td style="text-align:center;padding:14px;background:#070f0a;border:1px solid #1a3a1e;border-radius:8px;width:25%;">
              <div style="font-size:22px;font-weight:800;color:#22c55e;">${compliancePct}%</div>
              <div style="font-size:10px;color:#5a9a68;margin-top:2px;">CONFORMIDADE GERAL</div>
            </td>
            <td style="width:3%;"></td>
            <td style="text-align:center;padding:14px;background:#070f0a;border:1px solid #1a3a1e;border-radius:8px;width:25%;">
              <div style="font-size:22px;font-weight:800;color:#ef4444;">${stats.expiredCerts}</div>
              <div style="font-size:10px;color:#5a9a68;margin-top:2px;">VENCIDAS</div>
            </td>
            <td style="width:3%;"></td>
            <td style="text-align:center;padding:14px;background:#070f0a;border:1px solid #1a3a1e;border-radius:8px;width:25%;">
              <div style="font-size:22px;font-weight:800;color:#f59e0b;">${stats.expiringSoonCerts}</div>
              <div style="font-size:10px;color:#5a9a68;margin-top:2px;">A VENCER (30d)</div>
            </td>
          </tr>
        </table>

        ${upcomingRows ? `
        <!-- Próximos vencimentos -->
        <p style="color:#9ab5a0;font-size:12px;font-weight:700;margin:0 0 8px;letter-spacing:0.5px;">VENCIMENTOS NOS PRÓXIMOS 30 DIAS</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a3a1e;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <thead><tr style="background:#070f0a;">
            <th style="padding:7px 10px;text-align:left;font-size:10px;color:#5a9a68;">Empresa</th>
            <th style="padding:7px 10px;text-align:left;font-size:10px;color:#5a9a68;">Certidão</th>
            <th style="padding:7px 10px;text-align:left;font-size:10px;color:#5a9a68;">Dias</th>
          </tr></thead>
          <tbody>${upcomingRows}</tbody>
        </table>` : ''}

        ${riskRows ? `
        <!-- Empresas de risco -->
        <p style="color:#9ab5a0;font-size:12px;font-weight:700;margin:0 0 8px;letter-spacing:0.5px;">EMPRESAS COM MAIOR RISCO</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a3a1e;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <tbody>${riskRows}</tbody>
        </table>` : ''}

        <table cellpadding="0" cellspacing="0">
          <tr><td style="border-radius:8px;background:linear-gradient(135deg,#059669,#10b981);">
            <a href="${appUrl}/admin/companies" style="display:inline-block;padding:12px 24px;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">
              Ver painel completo →
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 28px;border-top:1px solid #1a3a1e;">
        <p style="color:#2a4a2e;font-size:11px;margin:0;font-family:monospace;">VALINEXUS · Relatório automático · Macapá, AP</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    try {
      const info = await getTransporter().sendMail({
        from, to,
        subject: `📊 Relatório ${period} VALINEXUS — ${compliancePct}% conformidade`,
        html,
      });
      logger.info(`📧 Relatório ${period.toLowerCase()} enviado para ${to}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Relatório ${period} falhou para ${to}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  },

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

  async sendRegulatoryAlert(params: {
    to: string;
    changesFound: number;
    totalUnreviewed: number;
    appUrl: string;
  }): Promise<SendResult> {
    const { to, changesFound, totalUnreviewed, appUrl } = params;
    const from = `"${process.env.SMTP_FROM_NAME ?? 'VALINEXUS'}" <${process.env.SMTP_FROM_EMAIL ?? 'alertas@valinexus.com.br'}>`;
    const reviewUrl = `${appUrl}/admin/regulatory-changes`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a1a0e;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1a0e;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#0d1f0f;border:1px solid #1a5c28;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 28px;">
        <span style="font-family:monospace;font-weight:700;font-size:18px;color:#fff;letter-spacing:2px;">⛽ VALINEXUS</span>
      </td></tr>
      <tr><td style="background:#3b82f618;border-bottom:2px solid #3b82f6;padding:14px 28px;">
        <span style="font-family:monospace;font-size:12px;font-weight:700;color:#3b82f6;letter-spacing:2px;">🔭 MUDANÇA REGULATÓRIA DETECTADA</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <p style="color:#e2f0e8;font-size:15px;font-weight:700;margin:0 0 16px;">
          ${changesFound} mudança(s) detectada(s) em portais regulatórios
        </p>
        <p style="color:#a7d9b2;font-size:13px;line-height:1.7;margin:0 0 16px;">
          O agente de monitoramento do VALINEXUS detectou alterações em portais
          da Petrobras ou órgãos reguladores. Pode indicar novas exigências de
          certidão para empresas terceirizadas.
        </p>
        <table cellpadding="0" cellspacing="0" style="background:#070f0a;border:1px solid #1a3a1e;border-radius:8px;padding:16px;width:100%;margin-bottom:24px;">
          <tr>
            <td style="padding:6px 0;">
              <span style="color:#3d6b4a;font-size:11px;font-family:monospace;">MUDANÇAS ESTA SEMANA</span><br>
              <span style="color:#e2f0e8;font-size:22px;font-weight:800;">${changesFound}</span>
            </td>
            <td style="padding:6px 0;padding-left:32px;">
              <span style="color:#3d6b4a;font-size:11px;font-family:monospace;">TOTAL NÃO REVISADO</span><br>
              <span style="color:#f59e0b;font-size:22px;font-weight:800;">${totalUnreviewed}</span>
            </td>
          </tr>
        </table>
        <p style="color:#a7d9b2;font-size:12px;margin:0 0 20px;">
          Revise as mudanças detectadas e atualize os templates de certidão se necessário.
        </p>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="border-radius:8px;background:linear-gradient(135deg,#059669,#10b981);">
            <a href="${reviewUrl}" style="display:inline-block;padding:12px 24px;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">
              Revisar mudanças regulatórias →
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 28px;border-top:1px solid #1a3a1e;">
        <p style="color:#2a4a2e;font-size:11px;margin:0;font-family:monospace;">VALINEXUS · Agente Regulatório · Macapá, AP</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    try {
      const info = await getTransporter().sendMail({
        from, to,
        subject: `🔭 ${changesFound} mudança(s) regulatória(s) detectada(s) — VALINEXUS`,
        html,
      });
      logger.info(`📧 Alerta regulatório enviado para ${to}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Alerta regulatório falhou para ${to}: ${errMsg}`);
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
