/**
 * notifications/whatsapp.service.ts
 *
 * Cliente para a Evolution API — solução open-source brasileira para
 * integração com WhatsApp Business.
 *
 * Por que Evolution API e não Twilio/Vonage?
 * - Custo: Evolution API é gratuita, Twilio cobra por mensagem
 * - Controle: roda no seu servidor, dados não saem da infraestrutura
 * - Adoção BR: é o padrão de mercado para startups brasileiras
 * - Alternativa hospedada disponível se não quiser gerenciar servidor
 *
 * Fluxo de uma mensagem:
 * 1. Formatar o número no padrão internacional (55 + DDD + número)
 * 2. POST /message/sendText/{instance}
 * 3. Se falhar, tentar novamente 1x após 5 segundos (retry simples)
 * 4. Registrar resultado no banco (delivered ou error)
 *
 * Estrutura da mensagem de alerta:
 * - Emoji de severidade para leitura rápida no preview da notificação
 * - Nome da certidão em negrito (WhatsApp suporta markdown)
 * - Dias restantes
 * - Link direto para o dashboard (reduz fricção de renovação)
 */

import { logger } from '../../utils/logger';

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Formata número para o padrão Evolution API: 5596999113575@s.whatsapp.net
function formatWhatsAppNumber(raw: string): string {
  // Remove tudo que não é dígito
  const digits = raw.replace(/\D/g, '');

  // Se já tem 55 na frente, usa como está
  // Se não tem, adiciona o código do Brasil
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;

  return `${withCountry}@s.whatsapp.net`;
}

export const whatsappService = {

  /**
   * Envia uma mensagem de texto via Evolution API.
   * Retorna sucesso/erro sem lançar exceção — o scheduler
   * decide o que fazer com o resultado.
   */
  async sendText(to: string, message: string): Promise<SendResult> {
    const enabled = process.env.NOTIFICATIONS_ENABLED === 'true';
    if (!enabled) {
      logger.info(`[WhatsApp MOCK] Para: ${to}\n${message}`);
      return { success: true, messageId: `mock_${Date.now()}` };
    }

    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey  = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE ?? 'valinexus';

    if (!baseUrl || !apiKey) {
      logger.warn('Evolution API não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY.');
      return { success: false, error: 'Evolution API não configurada' };
    }

    const number = formatWhatsAppNumber(to);
    const url = `${baseUrl}/message/sendText/${instance}`;

    const body = {
      number,
      options: { delay: 1200 },       // simula digitação humana — reduz bloqueio
      textMessage: { text: message },
    };

    // Tenta até 2 vezes antes de desistir
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000), // timeout de 10s
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json() as { key?: { id?: string } };
        const messageId = data?.key?.id ?? `ev_${Date.now()}`;

        logger.info(`📱 WhatsApp enviado para ${to} (tentativa ${attempt}) — ID: ${messageId}`);
        return { success: true, messageId };

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn(`WhatsApp falhou (tentativa ${attempt}/2) para ${to}: ${errMsg}`);

        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 5_000)); // aguarda 5s antes de retry
        } else {
          return { success: false, error: errMsg };
        }
      }
    }

    return { success: false, error: 'Falha após 2 tentativas' };
  },

  buildMissingCertsMessage(params: {
    companyName: string;
    missing: Array<{ templateName: string; category: string }>;
    appUrl: string;
  }): string {
    const { companyName, missing, appUrl } = params;
    const list = missing.slice(0, 5).map(m => `  • ${m.templateName}`).join('\n');
    const extra = missing.length > 5 ? `\n  ... e mais ${missing.length - 5}` : '';
    return [
      `📋 *CERTIDÕES FALTANTES — VALINEXUS*`,
      ``,
      `Empresa: *${companyName}*`,
      ``,
      `As seguintes certidões *não estão cadastradas* no sistema:`,
      list + extra,
      ``,
      `Cadastre-as agora para manter sua conformidade com a Petrobras.`,
      ``,
      `👉 Acessar painel: ${appUrl}/dashboard`,
      ``,
      `_VALINEXUS · Gestão de Conformidade Petrobras_`,
    ].join('\n');
  },

  /**
   * Monta a mensagem de alerta no formato WhatsApp (suporta markdown limitado).
   * Negrito: *texto*   Itálico: _texto_   Código: `texto`
   */
  buildAlertMessage(params: {
    companyName: string;
    certName: string;
    daysLeft: number;
    appUrl: string;
  }): string {
    const { companyName, certName, daysLeft, appUrl } = params;
    const dashboardUrl = `${appUrl}/dashboard`;

    if (daysLeft <= 0) {
      return [
        `🔴 *CERTIDÃO VENCIDA — VALINEXUS*`,
        ``,
        `Empresa: *${companyName}*`,
        `Certidão: *${certName}*`,
        `Status: *VENCIDA* — renovação urgente`,
        ``,
        `⚠️ Esta certidão está *bloqueando sua conformidade* no CRC Petrobras.`,
        `Renove imediatamente para não perder contratos.`,
        ``,
        `👉 Acesse o painel: ${dashboardUrl}`,
        ``,
        `_VALINEXUS · Gestão de Conformidade Petrobras_`,
      ].join('\n');
    }

    const emoji   = daysLeft <= 7  ? '🔴' : daysLeft <= 15 ? '🟠' : '🟡';
    const urgency = daysLeft <= 7  ? 'URGENTE' : daysLeft <= 15 ? 'ATENÇÃO' : 'AVISO';

    return [
      `${emoji} *${urgency} — VALINEXUS*`,
      ``,
      `Empresa: *${companyName}*`,
      `Certidão: *${certName}*`,
      `Vencimento: *${daysLeft} dia(s)*`,
      ``,
      daysLeft <= 7
        ? `⚠️ Prazo crítico! Renove *hoje* para manter conformidade com a Petrobras.`
        : daysLeft <= 15
          ? `Inicie o processo de renovação agora para evitar suspensão.`
          : `Programe a renovação desta certidão.`,
      ``,
      `👉 Ver no painel: ${dashboardUrl}`,
      ``,
      `_VALINEXUS · Gestão de Conformidade Petrobras_`,
    ].join('\n');
  },
};
