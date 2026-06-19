/**
 * integration/companies.routes.test.ts
 *
 * Testa os endpoints de empresas via supertest. Foco especial em
 * controle de acesso — este módulo é exclusivo de SUPER_ADMIN, então
 * todo teste de "usuário comum tentando acessar" é tão importante
 * quanto o caminho feliz.
 */

import request from 'supertest';
import { createApp } from '../../config/app';
import { companiesRepository } from '../../modules/companies/companies.repository';
import { authService } from '../../modules/auth/auth.service';
import { UserRole, CompanyStatus } from '@valinexus/shared';
import jwt from 'jsonwebtoken';
import { companyFactory } from '../helpers/factories';

jest.mock('../../modules/companies/companies.repository');
jest.mock('../../modules/auth/auth.service');
jest.mock('../../database/connection', () => ({
  db: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }), connect: jest.fn(), end: jest.fn(), on: jest.fn() },
  withTransaction: jest.fn(),
}));

const app = createApp();
const mockRepo = companiesRepository as jest.Mocked<typeof companiesRepository>;
const mockAuth = authService as jest.Mocked<typeof authService>;

function makeToken(role: UserRole) {
  return jwt.sign(
    { userId: 'u1', companyId: 'c1', email: 'x@y.com', role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
}

const SUPER_ADMIN_AUTH = `Bearer ${makeToken(UserRole.SUPER_ADMIN)}`;
const COMPANY_ADMIN_AUTH = `Bearer ${makeToken(UserRole.COMPANY_ADMIN)}`;

const VALID_CNPJ = '11.222.333/0001-81';

function validAddress() {
  return { street: 'Av. FAB', number: '100', complement: null, neighborhood: 'Centro', city: 'Macapá', state: 'AP', zipCode: '68900-000' };
}

beforeEach(() => jest.clearAllMocks());

// ─── Controle de acesso (aplicável a todas as rotas do módulo) ────────────────

describe('Controle de acesso — módulo companies', () => {

  it('401 sem autenticação', async () => {
    const res = await request(app).get('/api/v1/companies');
    expect(res.status).toBe(401);
  });

  it('403 quando o usuário não é SUPER_ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/companies')
      .set('Authorization', COMPANY_ADMIN_AUTH);

    expect(res.status).toBe(403);
  });

  it('200 quando o usuário é SUPER_ADMIN', async () => {
    mockRepo.findAll.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/companies')
      .set('Authorization', SUPER_ADMIN_AUTH);

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/v1/companies ────────────────────────────────────────────────────

describe('GET /api/v1/companies', () => {

  it('200 retorna lista de empresas', async () => {
    const companies = [companyFactory(), companyFactory()];
    mockRepo.findAll.mockResolvedValue(companies);

    const res = await request(app)
      .get('/api/v1/companies')
      .set('Authorization', SUPER_ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('passa filtros de query string para o service', async () => {
    mockRepo.findAll.mockResolvedValue([]);

    await request(app)
      .get('/api/v1/companies?status=ACTIVE&search=Norte')
      .set('Authorization', SUPER_ADMIN_AUTH);

    expect(mockRepo.findAll).toHaveBeenCalledWith({ status: 'ACTIVE', search: 'Norte' });
  });
});

// ─── GET /api/v1/companies/:id ────────────────────────────────────────────────

describe('GET /api/v1/companies/:id', () => {

  it('200 quando a empresa existe', async () => {
    const company = companyFactory();
    mockRepo.findById.mockResolvedValue(company);

    const res = await request(app)
      .get(`/api/v1/companies/${company.id}`)
      .set('Authorization', SUPER_ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(company.id);
  });

  it('404 quando a empresa não existe', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/companies/id-inexistente')
      .set('Authorization', SUPER_ADMIN_AUTH);

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/companies/onboard ───────────────────────────────────────────

describe('POST /api/v1/companies/onboard', () => {

  const validBody = {
    cnpj: VALID_CNPJ,
    razaoSocial: 'Transportadora Norte Ltda',
    email: 'contato@transnorte.com.br',
    phone: '(96) 3212-0000',
    whatsapp: '(96) 99900-0000',
    address: validAddress(),
    serviceCategories: ['transporte'],
    adminName: 'João Responsável',
    adminEmail: 'joao@transnorte.com.br',
  };

  it('201 e retorna a senha temporária com dados válidos', async () => {
    const created = companyFactory({ cnpj: VALID_CNPJ });
    mockRepo.findByCnpj.mockResolvedValue(null);
    mockAuth.hashPassword.mockResolvedValue('hash-fake');
    mockRepo.createWithAdmin.mockResolvedValue({ company: created, userId: 'u-novo' });

    const res = await request(app)
      .post('/api/v1/companies/onboard')
      .set('Authorization', SUPER_ADMIN_AUTH)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.temporaryPassword).toBeDefined();
    expect(res.body.data.adminEmail).toBe('joao@transnorte.com.br');
  });

  it('403 quando quem chama não é SUPER_ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/companies/onboard')
      .set('Authorization', COMPANY_ADMIN_AUTH)
      .send(validBody);

    expect(res.status).toBe(403);
    expect(mockRepo.createWithAdmin).not.toHaveBeenCalled();
  });

  it('400 com CNPJ ausente (validação Zod)', async () => {
    const { cnpj, ...withoutCnpj } = validBody;

    const res = await request(app)
      .post('/api/v1/companies/onboard')
      .set('Authorization', SUPER_ADMIN_AUTH)
      .send(withoutCnpj);

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('cnpj');
  });

  it('400 com adminEmail ausente', async () => {
    const { adminEmail, ...withoutAdminEmail } = validBody;

    const res = await request(app)
      .post('/api/v1/companies/onboard')
      .set('Authorization', SUPER_ADMIN_AUTH)
      .send(withoutAdminEmail);

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('adminEmail');
  });

  it('409 quando o CNPJ já está cadastrado', async () => {
    mockRepo.findByCnpj.mockResolvedValue(companyFactory({ cnpj: VALID_CNPJ }));

    const res = await request(app)
      .post('/api/v1/companies/onboard')
      .set('Authorization', SUPER_ADMIN_AUTH)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(mockRepo.createWithAdmin).not.toHaveBeenCalled();
  });

  it('400 quando o CNPJ tem dígito verificador inválido', async () => {
    const res = await request(app)
      .post('/api/v1/companies/onboard')
      .set('Authorization', SUPER_ADMIN_AUTH)
      .send({ ...validBody, cnpj: '11.222.333/0001-00' });

    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/v1/companies/:id ──────────────────────────────────────────────

describe('PATCH /api/v1/companies/:id', () => {

  it('200 atualiza campos parcialmente', async () => {
    const updated = companyFactory({ razaoSocial: 'Nome Atualizado' });
    mockRepo.update.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/v1/companies/company-123')
      .set('Authorization', SUPER_ADMIN_AUTH)
      .send({ razaoSocial: 'Nome Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.data.razaoSocial).toBe('Nome Atualizado');
  });

  it('404 quando a empresa não existe', async () => {
    mockRepo.update.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/companies/id-inexistente')
      .set('Authorization', SUPER_ADMIN_AUTH)
      .send({ razaoSocial: 'Nome Válido' }); // precisa passar na validação Zod (min 3) p/ chegar no service

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/companies/:id/suspend ───────────────────────────────────────

describe('POST /api/v1/companies/:id/suspend', () => {

  it('200 suspende a empresa', async () => {
    const suspended = companyFactory({ status: CompanyStatus.SUSPENDED });
    mockRepo.update.mockResolvedValue(suspended);

    const res = await request(app)
      .post('/api/v1/companies/company-123/suspend')
      .set('Authorization', SUPER_ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(CompanyStatus.SUSPENDED);
  });

  it('403 quando quem chama não é SUPER_ADMIN', async () => {
    const res = await request(app)
      .post('/api/v1/companies/company-123/suspend')
      .set('Authorization', COMPANY_ADMIN_AUTH);

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/v1/companies/:id/stats ──────────────────────────────────────────

describe('GET /api/v1/companies/:id/stats', () => {

  it('200 retorna estatísticas de uso', async () => {
    mockRepo.getUsageStats.mockResolvedValue({ userCount: 2, certificationCount: 14 });

    const res = await request(app)
      .get('/api/v1/companies/company-123/stats')
      .set('Authorization', SUPER_ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userCount: 2, certificationCount: 14 });
  });
});
