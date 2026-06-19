/**
 * middleware/authenticate.ts — Middleware de autenticação JWT
 *
 * Todo request para rotas protegidas passa aqui antes de chegar ao controller.
 * O middleware extrai o token JWT do header Authorization, valida a assinatura
 * e o prazo de validade, e injeta os dados do usuário em req.user.
 *
 * Por que JWT e não session?
 * - Stateless: o servidor não precisa guardar sessões — escala horizontalmente
 *   sem precisar de sticky sessions ou Redis para sessão compartilhada.
 * - Funciona bem para APIs consumidas por mobile e SPA.
 * - O refresh token (guardado no banco) permite revogar sessões quando necessário.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@valinexus/shared';

// Extensão do tipo Request do Express para incluir req.user
// Sem isso, TypeScript reclamaria de "Property 'user' does not exist on type 'Request'"
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        companyId: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // O token vem no header: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticação não fornecido',
    });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Isso nunca deve acontecer em produção — é um erro de configuração grave
    throw new Error('JWT_SECRET não configurado nas variáveis de ambiente');
  }

  try {
    const payload = jwt.verify(token, secret) as {
      userId: string;
      companyId: string;
      email: string;
      role: UserRole;
    };

    // Injeta o payload decodificado em req.user para os controllers usarem
    req.user = payload;
    next();

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token expirado. Faça login novamente.',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Token inválido',
    });
  }
}

/** Middleware de autorização por role — use depois do authenticate */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Permissão insuficiente para esta operação',
      });
    }
    next();
  };
}
