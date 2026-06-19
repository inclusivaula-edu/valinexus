/**
 * integration/certifications.routes.test.ts
 *
 * Testa os endpoints de certidões com supertest + repositório mockado.
 *
 * Foco: comportamento HTTP correto — status codes, formato de resposta,
 * validação de campos obrigatórios e proteção de rotas.
 */

import request from 'supertest';
import { createApp } from '../../config/app';
import { certificationsRepository } from '../../modules/certifications/certifications.repository';
import { CertificationCategory, UserRole } from '@valinexus/shared';
import jwt from 'jsonwebtoken';
import {
  certificationFactory,
  expiredCertificationFactory,
  createCertificationDtoFactory,
  futureDate,
} from '../helpers/factories';

jest.mock('../../modules/certifications/certifications.repository');
jest.mock('../../database/connection', () => ({
  db: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }), connect: jest.fn(), end: jest.fn(), on: jest.fn() },
  withTransaction: jest.fn(),
}));

const app = createApp();
const mockRepo = certificationsRepository as jest.Mocked<typeof certificationsRepository>;

// Token válido para autenticar as requisições nos testes
function makeToken(role = UserRole.COMPANY_ADMIN, companyId = 'company-test-123') {
  return jwt.sign(
    { userId: 'user-test', companyId, email: 'teste@empresa.com', role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
}

const AUTH = `Bearer ${makeToken()}`;

beforeEach(() => jest.clearAllMocks());

// ─── GET /api/v1/certifications ───────────────────────────────────────────────

describe('GET /api/v1/certifications', () => {

  it('200 com token válido — retorna lista', async () => {
    const certs = [certificationFactory(), certificationFactory()];
    mockRepo.findByCompanyId.mockResolvedValue(certs);

    const res = await request(app)
      .get('/api/v1/certifications')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('401 sem token de autenticação', async () => {
    const res = await request(app).get('/api/v1/certifications');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/certifications/dashboard ────────────────────────────────────

describe('GET /api/v1/certifications/dashboard', () => {

  it('200 retorna summary correto', async () => {
    mockRepo.findByCompanyId.mockResolvedValue([
      certificationFactory(),
      expiredCertificationFactory(),
    ]);
    mockRepo.getComplianceScore.mockResolvedValue(50);

    const res = await request(app)
      .get('/api/v1/certifications/dashboard')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data.certificationSummary.total).toBe(2);
    expect(res.body.data.complianceScore).toBe(50);
  });
});

// ─── POST /api/v1/certifications ─────────────────────────────────────────────

describe('POST /api/v1/certifications', () => {

  it('201 com dados válidos — cria e retorna certidão', async () => {
    const created = certificationFactory({ name: 'CND — Receita Federal' });
    mockRepo.create.mockResolvedValue(created);

    const body = {
      name: 'CND — Receita Federal',
      category: CertificationCategory.FISCAL,
      issuingBody: 'Receita Federal do Brasil',
      expiresAt: futureDate(180).toISOString(),
    };

    const res = await request(app)
      .post('/api/v1/certifications')
      .set('Authorization', AUTH)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(created.name);
    expect(mockRepo.create).toHaveBeenCalledTimes(1);
  });

  it('400 sem campo obrigatório "expiresAt"', async () => {
    const res = await request(app)
      .post('/api/v1/certifications')
      .set('Authorization', AUTH)
      .send({
        name: 'Alguma Certidão',
        category: CertificationCategory.FISCAL,
        issuingBody: 'Órgão X',
        // expiresAt: ausente
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('expiresAt');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('400 com categoria inválida', async () => {
    const res = await request(app)
      .post('/api/v1/certifications')
      .set('Authorization', AUTH)
      .send({
        name: 'Certidão',
        category: 'CATEGORIA_INVALIDA',
        issuingBody: 'Órgão',
        expiresAt: futureDate(90).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('category');
  });

  it('400 com nome muito curto (< 3 caracteres)', async () => {
    const res = await request(app)
      .post('/api/v1/certifications')
      .set('Authorization', AUTH)
      .send({
        name: 'AB', // muito curto
        category: CertificationCategory.FISCAL,
        issuingBody: 'Órgão X',
        expiresAt: futureDate(90).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('name');
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/v1/certifications')
      .send(createCertificationDtoFactory());

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/v1/certifications/:id ────────────────────────────────────────

describe('PATCH /api/v1/certifications/:id', () => {

  it('200 atualiza campos parcialmente', async () => {
    const updated = certificationFactory({ notes: 'Nota atualizada' });
    mockRepo.update.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/v1/certifications/cert-123')
      .set('Authorization', AUTH)
      .send({ notes: 'Nota atualizada' });

    expect(res.status).toBe(200);
    expect(mockRepo.update).toHaveBeenCalledWith('cert-123', { notes: 'Nota atualizada' });
  });

  it('404 quando certidão não existe', async () => {
    mockRepo.update.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/certifications/id-inexistente')
      .set('Authorization', AUTH)
      .send({ notes: 'qualquer' });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/v1/certifications/:id ───────────────────────────────────────

describe('DELETE /api/v1/certifications/:id', () => {

  it('204 quando certidão existe e é deletada', async () => {
    mockRepo.delete.mockResolvedValue({ deleted: true, s3Key: null });

    const res = await request(app)
      .delete('/api/v1/certifications/cert-para-deletar')
      .set('Authorization', AUTH);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('204 quando certidão tinha arquivo — também limpa o S3', async () => {
    mockRepo.delete.mockResolvedValue({
      deleted: true,
      s3Key: 'certifications/cert-com-arquivo/123-doc.pdf',
    });

    const res = await request(app)
      .delete('/api/v1/certifications/cert-com-arquivo')
      .set('Authorization', AUTH);

    expect(res.status).toBe(204);
  });

  it('404 quando certidão não existe', async () => {
    mockRepo.delete.mockResolvedValue({ deleted: false, s3Key: null });

    const res = await request(app)
      .delete('/api/v1/certifications/id-inexistente')
      .set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .delete('/api/v1/certifications/qualquer-id');

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/certifications/:id/download-url ─────────────────────────────

describe('GET /api/v1/certifications/:id/download-url', () => {

  it('200 e retorna URL quando a certidão tem arquivo', async () => {
    mockRepo.getS3Key.mockResolvedValue('certifications/cert-123/1700000000-doc.pdf');

    const res = await request(app)
      .get('/api/v1/certifications/cert-123/download-url')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain('certifications/cert-123/1700000000-doc.pdf');
  });

  it('404 quando a certidão não tem arquivo', async () => {
    mockRepo.getS3Key.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/certifications/cert-sem-arquivo/download-url')
      .set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });

  it('401 sem autenticação', async () => {
    const res = await request(app)
      .get('/api/v1/certifications/qualquer-id/download-url');

    expect(res.status).toBe(401);
  });
});
