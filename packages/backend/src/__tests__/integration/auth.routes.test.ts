/**
 * integration/auth.routes.test.ts
 *
 * Testes de integração da API de autenticação usando supertest.
 * Estes testes fazem requisições HTTP reais ao app Express,
 * mas mockam o repositório para não precisar de banco de dados.
 *
 * Diferença dos testes unitários:
 * - Testamos o stack completo: HTTP → middleware → controller → service
 * - Verificamos códigos de status HTTP corretos
 * - Verificamos formato exato das respostas JSON
 * - Verificamos headers (cookie httpOnly do refresh token)
 *
 * O que testamos:
 * - POST /api/v1/auth/login — sucesso e falhas
 * - POST /api/v1/auth/refresh — com e sem cookie
 * - POST /api/v1/auth/logout — limpa o cookie
 * - GET  /api/v1/auth/me — com e sem token
 */

import request from 'supertest';
import { createApp } from '../../config/app';
import { authRepository } from '../../modules/auth/auth.repository';
import { UserRole } from '@valinexus/shared';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('../../modules/auth/auth.repository');
jest.mock('../../database/connection', () => ({
  db: { query: jest.fn(), connect: jest.fn(), end: jest.fn(), on: jest.fn() },
  withTransaction: jest.fn(),
}));

const app = createApp();
const mockRepo = authRepository as jest.Mocked<typeof authRepository>;

let HASHED_PASSWORD: string;
const MOCK_USER = {
  id: 'user-test-123',
  companyId: 'company-test-456',
  name: 'Usuário Teste',
  email: 'teste@valinexus.com',
  passwordHash: '',
  role: UserRole.COMPANY_ADMIN,
  isActive: true,
  mustChangePassword: false,
};

beforeAll(async () => {
  HASHED_PASSWORD = await bcrypt.hash('SenhaValida@123', 10);
  MOCK_USER.passwordHash = HASHED_PASSWORD;
});

beforeEach(() => jest.clearAllMocks());

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {

  it('200 com credenciais válidas — retorna accessToken e seta cookie', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(MOCK_USER);
    mockRepo.saveRefreshToken.mockResolvedValue(undefined);
    mockRepo.updateLastLogin.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teste@valinexus.com', password: 'SenhaValida@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('teste@valinexus.com');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    // Cookie httpOnly deve estar presente
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('refreshToken'))).toBe(true);
    expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
  });

  it('401 com senha incorreta', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(MOCK_USER);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teste@valinexus.com', password: 'SenhaErrada' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('E-mail ou senha incorretos');
  });

  it('401 com email inexistente — mesma mensagem de erro (sem vazar info)', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'naoexiste@email.com', password: 'qualquer' });

    expect(res.status).toBe(401);
    // A mensagem deve ser IDÊNTICA ao caso de senha errada
    expect(res.body.error).toBe('E-mail ou senha incorretos');
  });

  it('400 com body inválido (campos faltando)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nao-eh-um-email' }); // falta password, email inválido

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details).toBeDefined();
  });

  it('400 com email em formato inválido', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'isso-nao-eh-email', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('email');
  });
});

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {

  it('401 sem cookie de refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Sessão expirada');
  });

  it('401 com refresh token inválido no cookie', async () => {
    mockRepo.validateRefreshToken.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=token-invalido-aqui');

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Sessão inválida');
  });

  it('200 com refresh token válido — retorna novo accessToken', async () => {
    mockRepo.validateRefreshToken.mockResolvedValue('user-test-123');
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);
    mockRepo.revokeRefreshToken.mockResolvedValue(undefined);
    mockRepo.saveRefreshToken.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=token-valido-do-banco');

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });
});

// ─── GET /api/v1/auth/me ─────────────────────────────────────────────────────

function makeToken(payload = {}) {
  return jwt.sign(
    {
      userId: 'user-test-123',
      companyId: 'company-test-456',
      email: 'teste@valinexus.com',
      role: UserRole.COMPANY_ADMIN,
      ...payload,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
}

describe('GET /api/v1/auth/me', () => {

  it('200 com token válido — busca dados atuais do usuário no banco', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);
    const token = makeToken();

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(MOCK_USER.id);
    expect(res.body.data.email).toBe(MOCK_USER.email);
    expect(res.body.data).toHaveProperty('mustChangePassword');
  });

  it('200 reflete mustChangePassword=true quando o usuário precisa trocar a senha', async () => {
    mockRepo.findUserById.mockResolvedValue({ ...MOCK_USER, mustChangePassword: true });
    const token = makeToken();

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it('404 quando o usuário do token não existe mais no banco', async () => {
    mockRepo.findUserById.mockResolvedValue(null);
    const token = makeToken();

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('401 sem header Authorization', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 com token expirado', async () => {
    const token = jwt.sign(
      { userId: 'x', companyId: 'y', email: 'z@z.com', role: UserRole.COMPANY_USER },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' } // já expirado
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('expirado');
  });

  it('401 com token malformado', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer token.invalido.aqui');

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/auth/logout ────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {

  it('200 e limpa o cookie de refresh token', async () => {
    mockRepo.revokeRefreshToken.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refreshToken=meu-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Cookie deve ser limpo (maxAge=0 ou expires no passado)
    const cookies = res.headers['set-cookie'] as unknown as string[];
    if (cookies) {
      const refreshCookie = cookies.find((c: string) => c.includes('refreshToken'));
      expect(refreshCookie).toContain('Expires=Thu, 01 Jan 1970');
    }
  });
});

// ─── PUT /api/v1/auth/change-password ────────────────────────────────────────

describe('PUT /api/v1/auth/change-password', () => {

  const AUTH = `Bearer ${makeToken()}`;

  it('200 com senha atual correta e nova senha forte', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);
    mockRepo.updatePassword.mockResolvedValue(undefined);
    mockRepo.revokeAllUserTokens.mockResolvedValue(undefined);

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', AUTH)
      .send({ currentPassword: 'SenhaValida@123', newPassword: 'NovaSenh@456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .send({ currentPassword: 'x', newPassword: 'NovaSenh@456' });

    expect(res.status).toBe(401);
  });

  it('401 quando a senha atual está incorreta', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', AUTH)
      .send({ currentPassword: 'SenhaErrada', newPassword: 'NovaSenh@456' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Senha atual incorreta');
  });

  it('400 quando a nova senha é muito curta (validação Zod)', async () => {
    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', AUTH)
      .send({ currentPassword: 'SenhaValida@123', newPassword: 'curta' });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('newPassword');
  });

  it('400 quando a nova senha não atende força mínima (validação no service)', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', AUTH)
      .send({ currentPassword: 'SenhaValida@123', newPassword: 'somenteletra' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('número');
  });

  it('400 quando a nova senha é igual à atual', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);

    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', AUTH)
      .send({ currentPassword: 'SenhaValida@123', newPassword: 'SenhaValida@123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('diferente');
  });

  it('400 quando currentPassword está ausente', async () => {
    const res = await request(app)
      .put('/api/v1/auth/change-password')
      .set('Authorization', AUTH)
      .send({ newPassword: 'NovaSenh@456' });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('currentPassword');
  });
});
