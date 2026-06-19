/**
 * unit/companies/companies.service.test.ts
 *
 * Testa a lógica de negócio do módulo de empresas com repositório mockado.
 *
 * Foco principal: o fluxo createWithAdmin(), que é o "onboarding assistido
 * pela UI" — substitui o seed.ts manual por uma chamada de API única.
 */

import { companiesService } from '../../../modules/companies/companies.service';
import { companiesRepository } from '../../../modules/companies/companies.repository';
import { authService } from '../../../modules/auth/auth.service';
import { CompanyStatus, PlanTier, CreateCompanyWithAdminDto } from '@valinexus/shared';
import { companyFactory } from '../../helpers/factories';

jest.mock('../../../modules/companies/companies.repository');
jest.mock('../../../modules/auth/auth.service');

const mockRepo = companiesRepository as jest.Mocked<typeof companiesRepository>;
const mockAuth = authService as jest.Mocked<typeof authService>;

beforeEach(() => jest.clearAllMocks());

// ─── CNPJs válidos/inválidos reais para os testes ─────────────────────────────
const VALID_CNPJ = '11.222.333/0001-81';
const INVALID_CNPJ = '11.222.333/0001-00';

function baseOnboardDto(overrides: Partial<CreateCompanyWithAdminDto> = {}): CreateCompanyWithAdminDto {
  return {
    cnpj: VALID_CNPJ,
    razaoSocial: 'Transportadora Norte Ltda',
    email: 'contato@transnorte.com.br',
    phone: '(96) 3212-0000',
    whatsapp: '(96) 99900-0000',
    address: {
      street: 'Av. FAB', number: '100', complement: null,
      neighborhood: 'Centro', city: 'Macapá', state: 'AP', zipCode: '68900-000',
    },
    serviceCategories: ['transporte'],
    adminName: 'João Responsável',
    adminEmail: 'joao@transnorte.com.br',
    ...overrides,
  };
}

// ─── list ─────────────────────────────────────────────────────────────────────

describe('companiesService.list', () => {

  it('delega ao repositório com os filtros informados', async () => {
    const companies = [companyFactory(), companyFactory()];
    mockRepo.findAll.mockResolvedValue(companies);

    const result = await companiesService.list({ status: CompanyStatus.ACTIVE, search: 'Norte' });

    expect(result).toEqual(companies);
    expect(mockRepo.findAll).toHaveBeenCalledWith({ status: CompanyStatus.ACTIVE, search: 'Norte' });
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('companiesService.create', () => {

  it('cria empresa com CNPJ válido', async () => {
    const created = companyFactory({ cnpj: VALID_CNPJ });
    mockRepo.findByCnpj.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(created);

    const dto = {
      cnpj: VALID_CNPJ,
      razaoSocial: 'Empresa Teste',
      email: 'x@x.com',
      phone: '96999999999',
      whatsapp: '96999999999',
      address: { street: 'Rua X', number: '1', complement: null, neighborhood: 'B', city: 'Macapá', state: 'AP', zipCode: '68900-000' },
      serviceCategories: [],
    };

    const result = await companiesService.create(dto);
    expect(result).toEqual(created);
  });

  it('rejeita CNPJ com dígito verificador inválido', async () => {
    const dto = {
      cnpj: INVALID_CNPJ,
      razaoSocial: 'Empresa Teste',
      email: 'x@x.com',
      phone: '96999999999',
      whatsapp: '96999999999',
      address: { street: 'Rua X', number: '1', complement: null, neighborhood: 'B', city: 'Macapá', state: 'AP', zipCode: '68900-000' },
      serviceCategories: [],
    };

    await expect(companiesService.create(dto)).rejects.toThrow('CNPJ_INVALIDO');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('rejeita CNPJ já cadastrado', async () => {
    mockRepo.findByCnpj.mockResolvedValue(companyFactory({ cnpj: VALID_CNPJ }));

    const dto = {
      cnpj: VALID_CNPJ,
      razaoSocial: 'Empresa Duplicada',
      email: 'x@x.com',
      phone: '96999999999',
      whatsapp: '96999999999',
      address: { street: 'Rua X', number: '1', complement: null, neighborhood: 'B', city: 'Macapá', state: 'AP', zipCode: '68900-000' },
      serviceCategories: [],
    };

    await expect(companiesService.create(dto)).rejects.toThrow('CNPJ_JA_CADASTRADO');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});

// ─── createWithAdmin (onboarding assistido) ───────────────────────────────────

describe('companiesService.createWithAdmin', () => {

  it('cria empresa + usuário admin e retorna a senha temporária em texto puro', async () => {
    const created = companyFactory({ cnpj: VALID_CNPJ, razaoSocial: 'Transportadora Norte Ltda' });
    mockRepo.findByCnpj.mockResolvedValue(null);
    mockAuth.hashPassword.mockResolvedValue('hash-fake-bcrypt');
    mockRepo.createWithAdmin.mockResolvedValue({ company: created, userId: 'user-novo-123' });

    const result = await companiesService.createWithAdmin(baseOnboardDto());

    expect(result.company).toEqual(created);
    expect(result.adminEmail).toBe('joao@transnorte.com.br');
    expect(result.temporaryPassword).toBeDefined();
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(8);
  });

  it('usa a senha fornecida quando adminPassword é informado, em vez de gerar uma', async () => {
    const created = companyFactory({ cnpj: VALID_CNPJ });
    mockRepo.findByCnpj.mockResolvedValue(null);
    mockAuth.hashPassword.mockResolvedValue('hash-fake');
    mockRepo.createWithAdmin.mockResolvedValue({ company: created, userId: 'u1' });

    const result = await companiesService.createWithAdmin(
      baseOnboardDto({ adminPassword: 'MinhaSenh@Custom1' })
    );

    expect(result.temporaryPassword).toBe('MinhaSenh@Custom1');
  });

  it('gera senha temporária com formato Palavra@DDDD quando não informada', async () => {
    const created = companyFactory({ cnpj: VALID_CNPJ });
    mockRepo.findByCnpj.mockResolvedValue(null);
    mockAuth.hashPassword.mockResolvedValue('hash-fake');
    mockRepo.createWithAdmin.mockResolvedValue({ company: created, userId: 'u1' });

    const result = await companiesService.createWithAdmin(baseOnboardDto());

    // Formato: Letra(s) + @ + 4 dígitos
    expect(result.temporaryPassword).toMatch(/^[A-Za-z]+@\d{4}$/);
  });

  it('hasheia a senha antes de persistir — nunca salva texto puro', async () => {
    const created = companyFactory({ cnpj: VALID_CNPJ });
    mockRepo.findByCnpj.mockResolvedValue(null);
    mockAuth.hashPassword.mockResolvedValue('$2a$10$hashbcryptfake');
    mockRepo.createWithAdmin.mockResolvedValue({ company: created, userId: 'u1' });

    await companiesService.createWithAdmin(baseOnboardDto());

    expect(mockAuth.hashPassword).toHaveBeenCalledTimes(1);
    const callArgs = mockRepo.createWithAdmin.mock.calls[0][0];
    expect(callArgs.adminPasswordHash).toBe('$2a$10$hashbcryptfake');
  });

  it('rejeita CNPJ inválido antes de chamar o repositório', async () => {
    await expect(
      companiesService.createWithAdmin(baseOnboardDto({ cnpj: INVALID_CNPJ }))
    ).rejects.toThrow('CNPJ_INVALIDO');

    expect(mockRepo.createWithAdmin).not.toHaveBeenCalled();
  });

  it('rejeita CNPJ já cadastrado antes de criar', async () => {
    mockRepo.findByCnpj.mockResolvedValue(companyFactory({ cnpj: VALID_CNPJ }));

    await expect(
      companiesService.createWithAdmin(baseOnboardDto())
    ).rejects.toThrow('CNPJ_JA_CADASTRADO');

    expect(mockRepo.createWithAdmin).not.toHaveBeenCalled();
  });

  it('aplica templates de certidão quando applyDefaultTemplates=true', async () => {
    const created = companyFactory({ cnpj: VALID_CNPJ });
    mockRepo.findByCnpj.mockResolvedValue(null);
    mockAuth.hashPassword.mockResolvedValue('hash');
    mockRepo.createWithAdmin.mockResolvedValue({ company: created, userId: 'u1' });
    mockRepo.applyDefaultCertificationTemplates.mockResolvedValue(18);

    await companiesService.createWithAdmin(baseOnboardDto({ applyDefaultTemplates: true }));

    expect(mockRepo.applyDefaultCertificationTemplates).toHaveBeenCalledWith(created.id);
  });

  it('NÃO aplica templates quando applyDefaultTemplates não é informado', async () => {
    const created = companyFactory({ cnpj: VALID_CNPJ });
    mockRepo.findByCnpj.mockResolvedValue(null);
    mockAuth.hashPassword.mockResolvedValue('hash');
    mockRepo.createWithAdmin.mockResolvedValue({ company: created, userId: 'u1' });

    await companiesService.createWithAdmin(baseOnboardDto());

    expect(mockRepo.applyDefaultCertificationTemplates).not.toHaveBeenCalled();
  });
});

// ─── suspend / reactivate ───────────────────────────────────────────────────

describe('companiesService.suspend / reactivate', () => {

  it('suspend atualiza status para SUSPENDED', async () => {
    const suspended = companyFactory({ status: CompanyStatus.SUSPENDED });
    mockRepo.update.mockResolvedValue(suspended);

    const result = await companiesService.suspend('company-123');

    expect(mockRepo.update).toHaveBeenCalledWith('company-123', { status: CompanyStatus.SUSPENDED });
    expect(result?.status).toBe(CompanyStatus.SUSPENDED);
  });

  it('reactivate atualiza status para ACTIVE', async () => {
    const active = companyFactory({ status: CompanyStatus.ACTIVE });
    mockRepo.update.mockResolvedValue(active);

    const result = await companiesService.reactivate('company-123');

    expect(mockRepo.update).toHaveBeenCalledWith('company-123', { status: CompanyStatus.ACTIVE });
    expect(result?.status).toBe(CompanyStatus.ACTIVE);
  });

  it('retorna null quando a empresa não existe', async () => {
    mockRepo.update.mockResolvedValue(null);
    const result = await companiesService.suspend('id-inexistente');
    expect(result).toBeNull();
  });
});

// ─── getUsageStats / listUsers ────────────────────────────────────────────────

describe('companiesService.getUsageStats', () => {

  it('retorna contagem de usuários e certidões', async () => {
    mockRepo.getUsageStats.mockResolvedValue({ userCount: 3, certificationCount: 14 });

    const result = await companiesService.getUsageStats('company-123');

    expect(result).toEqual({ userCount: 3, certificationCount: 14 });
  });
});

describe('companiesService.listUsers', () => {

  it('delega ao repositório', async () => {
    const users = [{ id: 'u1', name: 'Ana', email: 'ana@x.com', role: 'COMPANY_ADMIN', isActive: true, mustChangePassword: false, lastLoginAt: null }];
    mockRepo.listUsers.mockResolvedValue(users);

    const result = await companiesService.listUsers('company-123');

    expect(result).toEqual(users);
  });
});
