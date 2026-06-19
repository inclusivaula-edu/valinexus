/**
 * unit/middleware.test.ts
 *
 * Testa os middlewares de autenticação e validação.
 * Simula req/res/next do Express sem subir o servidor HTTP.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import { UserRole } from '@valinexus/shared';
import { z } from 'zod';

// Helpers para criar mocks mínimos do Express
function makeReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, body: {}, params: {}, query: {}, ...overrides } as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock; } {
  const json = jest.fn();
  const status = jest.fn().mockReturnThis();
  const res = { json, status } as unknown as Response;
  return { res, json, status };
}

const next: NextFunction = jest.fn();

function validToken(payload = {}) {
  return jwt.sign(
    {
      userId: 'u1',
      companyId: 'c1',
      email: 'x@y.com',
      role: UserRole.COMPANY_ADMIN,
      ...payload,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
}

beforeEach(() => jest.clearAllMocks());

// ─── authenticate ─────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {

  it('chama next() com token válido e popula req.user', () => {
    const token = validToken();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const { res } = makeRes();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe('u1');
    expect(req.user?.role).toBe(UserRole.COMPANY_ADMIN);
  });

  it('401 quando header Authorization está ausente', () => {
    const req = makeReq();
    const { res, json, status } = makeRes();

    authenticate(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });

  it('401 quando header não começa com "Bearer "', () => {
    const req = makeReq({ headers: { authorization: 'Basic abc123' } });
    const { res, status } = makeRes();

    authenticate(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 com token expirado — mensagem específica', () => {
    const expired = jwt.sign(
      { userId: 'u1', companyId: 'c1', email: 'x@y.com', role: UserRole.COMPANY_USER },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' }
    );
    const req = makeReq({ headers: { authorization: `Bearer ${expired}` } });
    const { res, json, status } = makeRes();

    authenticate(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('expirado') })
    );
  });

  it('401 com token com assinatura inválida', () => {
    const tampered = validToken() + 'x';
    const req = makeReq({ headers: { authorization: `Bearer ${tampered}` } });
    const { res, status } = makeRes();

    authenticate(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole middleware', () => {

  it('chama next() quando o usuário tem o role exigido', () => {
    const req = makeReq() as Request;
    req.user = { userId: 'u1', companyId: 'c1', email: 'x@y.com', role: UserRole.SUPER_ADMIN };
    const { res } = makeRes();

    requireRole(UserRole.SUPER_ADMIN)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('403 quando o role do usuário é insuficiente', () => {
    const req = makeReq() as Request;
    req.user = { userId: 'u1', companyId: 'c1', email: 'x@y.com', role: UserRole.COMPANY_USER };
    const { res, status, json } = makeRes();

    requireRole(UserRole.SUPER_ADMIN)(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('Permissão') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('aceita múltiplos roles válidos', () => {
    const req = makeReq() as Request;
    req.user = { userId: 'u1', companyId: 'c1', email: 'x@y.com', role: UserRole.COMPANY_ADMIN };
    const { res } = makeRes();

    requireRole(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ─── validateRequest ──────────────────────────────────────────────────────────

describe('validateRequest middleware', () => {

  const schema = z.object({
    body: z.object({
      name: z.string().min(3, 'Nome muito curto'),
      email: z.string().email('E-mail inválido'),
      age: z.number().int().min(18, 'Menor de idade').optional(),
    }),
  });

  it('chama next() com body válido', () => {
    const req = makeReq({ body: { name: 'Ana', email: 'ana@email.com' } });
    const { res } = makeRes();

    validateRequest(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('400 com campo obrigatório ausente', () => {
    const req = makeReq({ body: { name: 'Ana' } }); // falta email
    const { res, status, json } = makeRes();

    validateRequest(schema)(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        details: expect.objectContaining({ email: expect.any(Array) }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('400 com múltiplos erros — todos retornados em details', () => {
    const req = makeReq({ body: { name: 'AB', email: 'nao-eh-email' } });
    const { res, json, status } = makeRes();

    validateRequest(schema)(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    const response = json.mock.calls[0][0];
    expect(Object.keys(response.details)).toHaveLength(2); // name + email
  });

  it('400 com tipo errado (string onde esperava número)', () => {
    const req = makeReq({ body: { name: 'Ana', email: 'ana@email.com', age: 'dezoito' } });
    const { res, status } = makeRes();

    validateRequest(schema)(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
  });
});
