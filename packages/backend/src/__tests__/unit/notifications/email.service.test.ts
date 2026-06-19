/**
 * unit/notifications/email.service.test.ts
 *
 * Testa o serviço de email em modo mock (NOTIFICATIONS_ENABLED=false).
 * Verifica geração de subject lines e estrutura do HTML.
 */

import { emailService } from '../../../modules/notifications/email.service';

describe('emailService.buildSubject', () => {

  it('subject de certidão vencida começa com 🔴 VENCIDA', () => {
    const subject = emailService.buildSubject('CRF — FGTS', -1);
    expect(subject).toContain('🔴');
    expect(subject).toContain('VENCIDA');
    expect(subject).toContain('CRF — FGTS');
  });

  it('subject crítico (≤7 dias) contém 🔴 URGENTE', () => {
    expect(emailService.buildSubject('Certidão X', 5)).toContain('🔴');
    expect(emailService.buildSubject('Certidão X', 5)).toContain('URGENTE');
    expect(emailService.buildSubject('Certidão X', 7)).toContain('7 dia(s)');
  });

  it('subject de atenção (8–15 dias) contém 🟠 ATENÇÃO', () => {
    const subject = emailService.buildSubject('Certidão Y', 12);
    expect(subject).toContain('🟠');
    expect(subject).toContain('ATENÇÃO');
    expect(subject).toContain('12 dias');
  });

  it('subject de aviso (>15 dias) contém 🟡 AVISO', () => {
    const subject = emailService.buildSubject('Certidão Z', 30);
    expect(subject).toContain('🟡');
    expect(subject).toContain('AVISO');
  });
});

describe('emailService.buildHtml', () => {

  const baseParams = {
    companyName: 'Construtora Amapá Ltda',
    certName: 'CRF — Certidão de Regularidade do FGTS',
    appUrl: 'https://app.valinexus.com.br',
  };

  it('HTML contém nome da empresa e da certidão', () => {
    const html = emailService.buildHtml({ ...baseParams, daysLeft: 15 });
    expect(html).toContain('Construtora Amapá Ltda');
    expect(html).toContain('CRF — Certidão de Regularidade do FGTS');
  });

  it('HTML tem link para o dashboard', () => {
    const html = emailService.buildHtml({ ...baseParams, daysLeft: 10 });
    expect(html).toContain('https://app.valinexus.com.br/dashboard');
  });

  it('HTML de certidão vencida usa cor vermelha (#ef4444)', () => {
    const html = emailService.buildHtml({ ...baseParams, daysLeft: 0 });
    expect(html).toContain('#ef4444');
    expect(html).toContain('VENCIDA');
  });

  it('HTML de certidão crítica menciona prazo crítico', () => {
    const html = emailService.buildHtml({ ...baseParams, daysLeft: 3 });
    // O template usa "Prazo crítico" para alertas de ≤7 dias
    expect(html.toLowerCase()).toContain('prazo cr');
  });

  it('HTML é válido (tem doctype e estrutura básica)', () => {
    const html = emailService.buildHtml({ ...baseParams, daysLeft: 30 });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<body');
  });

  it('sendAlert retorna sucesso em modo mock', async () => {
    const result = await emailService.sendAlert({
      to: 'cliente@empresa.com',
      companyName: 'Empresa Teste',
      certName: 'CND FGTS',
      daysLeft: 10,
      appUrl: 'http://localhost:5173',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^mock_/);
  });
});
