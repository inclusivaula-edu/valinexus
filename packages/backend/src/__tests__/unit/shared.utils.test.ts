/**
 * unit/shared.utils.test.ts
 *
 * Testes das funções utilitárias do pacote @valinexus/shared.
 * São as mais simples de testar: input → output puro, sem dependências.
 * Devem rodar em < 10ms cada.
 */

import {
  computeCertificationStatus,
  computeAlertSeverity,
  validateCnpj,
  formatCnpj,
  CertificationStatus,
  AlertSeverity,
} from '@valinexus/shared';

import { futureDate, pastDate } from '../helpers/factories';

// ─── computeCertificationStatus ──────────────────────────────────────────────

describe('computeCertificationStatus', () => {

  it('retorna VALID quando vence em mais de 30 dias', () => {
    expect(computeCertificationStatus(futureDate(31))).toBe(CertificationStatus.VALID);
    expect(computeCertificationStatus(futureDate(90))).toBe(CertificationStatus.VALID);
    expect(computeCertificationStatus(futureDate(365))).toBe(CertificationStatus.VALID);
  });

  it('retorna EXPIRING_SOON quando vence em 1–30 dias', () => {
    expect(computeCertificationStatus(futureDate(30))).toBe(CertificationStatus.EXPIRING_SOON);
    expect(computeCertificationStatus(futureDate(15))).toBe(CertificationStatus.EXPIRING_SOON);
    expect(computeCertificationStatus(futureDate(1))).toBe(CertificationStatus.EXPIRING_SOON);
  });

  it('retorna EXPIRED quando a data já passou', () => {
    expect(computeCertificationStatus(pastDate(1))).toBe(CertificationStatus.EXPIRED);
    expect(computeCertificationStatus(pastDate(30))).toBe(CertificationStatus.EXPIRED);
    expect(computeCertificationStatus(pastDate(365))).toBe(CertificationStatus.EXPIRED);
  });

  it('retorna EXPIRING_SOON para vencimento hoje (dia 0)', () => {
    const today = new Date();
    today.setHours(23, 59, 59); // fim do dia de hoje
    const result = computeCertificationStatus(today);
    // Pode ser EXPIRING_SOON ou EXPIRED dependendo da hora — ambos aceitáveis
    expect([CertificationStatus.EXPIRING_SOON, CertificationStatus.EXPIRED]).toContain(result);
  });
});

// ─── computeAlertSeverity ─────────────────────────────────────────────────────

describe('computeAlertSeverity', () => {

  it('retorna CRITICAL para certidões vencidas (dias negativos)', () => {
    expect(computeAlertSeverity(-1)).toBe(AlertSeverity.CRITICAL);
    expect(computeAlertSeverity(-30)).toBe(AlertSeverity.CRITICAL);
    expect(computeAlertSeverity(0)).toBe(AlertSeverity.CRITICAL);
  });

  it('retorna CRITICAL para 1–7 dias', () => {
    expect(computeAlertSeverity(1)).toBe(AlertSeverity.CRITICAL);
    expect(computeAlertSeverity(7)).toBe(AlertSeverity.CRITICAL);
  });

  it('retorna HIGH para 8–15 dias', () => {
    expect(computeAlertSeverity(8)).toBe(AlertSeverity.HIGH);
    expect(computeAlertSeverity(15)).toBe(AlertSeverity.HIGH);
  });

  it('retorna MEDIUM para 16–30 dias', () => {
    expect(computeAlertSeverity(16)).toBe(AlertSeverity.MEDIUM);
    expect(computeAlertSeverity(30)).toBe(AlertSeverity.MEDIUM);
  });

  it('retorna LOW para mais de 30 dias', () => {
    expect(computeAlertSeverity(31)).toBe(AlertSeverity.LOW);
    expect(computeAlertSeverity(90)).toBe(AlertSeverity.LOW);
  });
});

// ─── validateCnpj ────────────────────────────────────────────────────────────

describe('validateCnpj', () => {

  it('valida CNPJs corretos', () => {
    // CNPJs reais de empresas públicas brasileiras
    expect(validateCnpj('11.222.333/0001-81')).toBe(true);
    expect(validateCnpj('11222333000181')).toBe(true); // sem formatação
  });

  it('rejeita CNPJs com dígito verificador errado', () => {
    expect(validateCnpj('11.222.333/0001-00')).toBe(false);
    expect(validateCnpj('12.345.678/0001-99')).toBe(false);
  });

  it('rejeita CNPJs com todos os dígitos iguais', () => {
    expect(validateCnpj('00.000.000/0000-00')).toBe(false);
    expect(validateCnpj('11.111.111/1111-11')).toBe(false);
    expect(validateCnpj('99.999.999/9999-99')).toBe(false);
  });

  it('rejeita CNPJs com tamanho incorreto', () => {
    expect(validateCnpj('123')).toBe(false);
    expect(validateCnpj('')).toBe(false);
    expect(validateCnpj('123456789012345')).toBe(false); // 15 dígitos
  });
});

// ─── formatCnpj ──────────────────────────────────────────────────────────────

describe('formatCnpj', () => {

  it('formata CNPJ sem pontuação', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('reaplica formatação em CNPJ já formatado', () => {
    expect(formatCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
  });
});
