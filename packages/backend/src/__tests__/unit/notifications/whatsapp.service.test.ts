/**
 * unit/notifications/whatsapp.service.test.ts
 *
 * Testa o serviço de WhatsApp em modo mock (NOTIFICATIONS_ENABLED=false).
 * O setup.ts já garante que NOTIFICATIONS_ENABLED=false — nenhuma
 * requisição real é feita durante os testes.
 *
 * O que testamos:
 * - Formato das mensagens geradas (conteúdo e estrutura)
 * - Modo mock retorna sucesso sem chamar fetch
 * - Formatação de números WhatsApp
 */

import { whatsappService } from '../../../modules/notifications/whatsapp.service';

// fetch é global no Node 18+ — mockamos para garantir que não é chamado
global.fetch = jest.fn();

beforeEach(() => jest.clearAllMocks());

// ─── buildAlertMessage ────────────────────────────────────────────────────────

describe('whatsappService.buildAlertMessage', () => {

  const baseParams = {
    companyName: 'Construtora Amapá Ltda',
    certName: 'CRF — Certidão de Regularidade do FGTS',
    appUrl: 'http://localhost:5173',
  };

  it('mensagem de certidão vencida contém VENCIDA e urgência', () => {
    const msg = whatsappService.buildAlertMessage({ ...baseParams, daysLeft: 0 });

    expect(msg).toContain('VENCIDA');
    expect(msg).toContain('Construtora Amapá Ltda');
    expect(msg).toContain('CRF — Certidão de Regularidade do FGTS');
    expect(msg).toContain('http://localhost:5173/dashboard');
  });

  it('mensagem crítica (≤7 dias) contém URGENTE e emoji vermelho', () => {
    const msg = whatsappService.buildAlertMessage({ ...baseParams, daysLeft: 5 });

    expect(msg).toContain('🔴');
    expect(msg).toContain('URGENTE');
    expect(msg).toContain('5 dia(s)');
  });

  it('mensagem de atenção (8–15 dias) contém ATENÇÃO e emoji laranja', () => {
    const msg = whatsappService.buildAlertMessage({ ...baseParams, daysLeft: 10 });

    expect(msg).toContain('🟠');
    expect(msg).toContain('ATENÇÃO');
    expect(msg).toContain('10 dia(s)');
  });

  it('mensagem de aviso (16–30 dias) contém AVISO e emoji amarelo', () => {
    const msg = whatsappService.buildAlertMessage({ ...baseParams, daysLeft: 25 });

    expect(msg).toContain('🟡');
    expect(msg).toContain('AVISO');
    expect(msg).toContain('25 dia(s)');
  });

  it('todas as mensagens contêm o link do dashboard', () => {
    for (const days of [-1, 0, 5, 15, 30]) {
      const msg = whatsappService.buildAlertMessage({ ...baseParams, daysLeft: days });
      expect(msg).toContain('http://localhost:5173/dashboard');
    }
  });

  it('mensagem usa markdown WhatsApp (*negrito*)', () => {
    const msg = whatsappService.buildAlertMessage({ ...baseParams, daysLeft: 7 });
    // WhatsApp suporta *negrito* — nome da empresa e certidão devem estar em negrito
    expect(msg).toContain('*Construtora Amapá Ltda*');
    expect(msg).toContain('*CRF — Certidão de Regularidade do FGTS*');
  });
});

// ─── sendText (modo mock) ─────────────────────────────────────────────────────

describe('whatsappService.sendText (NOTIFICATIONS_ENABLED=false)', () => {

  it('retorna sucesso sem chamar fetch', async () => {
    const result = await whatsappService.sendText(
      '5596999113575',
      'Mensagem de teste'
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^mock_/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('funciona com qualquer número de telefone em modo mock', async () => {
    const numbers = ['(96) 99911-3575', '5596999113575', '96999113575'];

    for (const number of numbers) {
      const result = await whatsappService.sendText(number, 'teste');
      expect(result.success).toBe(true);
    }
  });
});
