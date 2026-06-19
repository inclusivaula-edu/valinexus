/**
 * __tests__/helpers/factories.ts
 *
 * Fábricas de dados de teste.
 *
 * Por que usar factories em vez de copiar objetos nos testes?
 * 1. Um campo novo na interface quebra UMA factory, não 40 testes
 * 2. Cada teste declara só o que é relevante — o resto tem valor padrão
 * 3. Fácil criar variações: certificationFactory({ status: 'EXPIRED' })
 *
 * Padrão: factory retorna o objeto mínimo válido.
 * O teste sobrescreve apenas os campos que importam para aquele cenário.
 */

import {
  Certification,
  CertificationStatus,
  CertificationCategory,
  Company,
  CompanyStatus,
  PlanTier,
  User,
  UserRole,
  CreateCertificationDto,
} from '@valinexus/shared';

let _idCounter = 1;
const nextId = () => `test-id-${_idCounter++}`;

// Data futura em dias a partir de hoje
export function futureDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function pastDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export function certificationFactory(
  overrides: Partial<Certification> = {}
): Certification {
  return {
    id: nextId(),
    companyId: nextId(),
    name: 'CRF — Certidão de Regularidade do FGTS',
    category: CertificationCategory.TRABALHISTA,
    issuingBody: 'Caixa Econômica Federal',
    documentNumber: null,
    issuedAt: null,
    expiresAt: futureDate(90),
    status: CertificationStatus.VALID,
    fileUrl: null,
    fileUploadedAt: null,
    notes: null,
    alertsSent: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function expiredCertificationFactory(
  overrides: Partial<Certification> = {}
): Certification {
  return certificationFactory({
    name: 'NR-35 — Treinamento Trabalho em Altura',
    status: CertificationStatus.EXPIRED,
    expiresAt: pastDate(5),
    ...overrides,
  });
}

export function expiringSoonCertificationFactory(
  overrides: Partial<Certification> = {}
): Certification {
  return certificationFactory({
    name: 'Alvará de Funcionamento',
    status: CertificationStatus.EXPIRING_SOON,
    expiresAt: futureDate(14),
    ...overrides,
  });
}

export function companyFactory(
  overrides: Partial<Company> = {}
): Company {
  return {
    id: nextId(),
    cnpj: '12.345.678/0001-90',
    razaoSocial: 'Construtora Amapá Ltda',
    nomeFantasia: 'ConstrAmapá',
    email: 'contato@constramapa.com.br',
    phone: '(96) 3212-0000',
    whatsapp: '5596999000000',
    address: {
      street: 'Rua Cândido Mendes',
      number: '500',
      complement: null,
      neighborhood: 'Central',
      city: 'Macapá',
      state: 'AP',
      zipCode: '68900-000',
    },
    crcPetrobrasCode: null,
    crcRegisteredAt: null,
    status: CompanyStatus.ACTIVE,
    planTier: PlanTier.STARTER,
    planExpiresAt: futureDate(30),
    serviceCategories: ['construcao', 'manutencao'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function userFactory(
  overrides: Partial<User> = {}
): User {
  return {
    id: nextId(),
    companyId: nextId(),
    name: 'Responsável Técnico',
    email: 'admin@constramapa.com.br',
    phone: null,
    role: UserRole.COMPANY_ADMIN,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createCertificationDtoFactory(
  overrides: Partial<CreateCertificationDto> = {}
): CreateCertificationDto {
  return {
    companyId: nextId(),
    name: 'CND — Receita Federal / PGFN',
    category: CertificationCategory.FISCAL,
    issuingBody: 'Receita Federal do Brasil',
    expiresAt: futureDate(180).toISOString(),
    ...overrides,
  };
}
