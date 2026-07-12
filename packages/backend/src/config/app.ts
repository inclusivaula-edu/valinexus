/**
 * config/app.ts — Fábrica do app Express
 *
 * Padrão "app factory" (createApp) permite importar o app sem iniciar o
 * servidor HTTP, facilitando testes de integração. É a diferença entre
 * "const app = express()" na raiz (anti-pattern) e essa abordagem.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { logger } from '../utils/logger';
import { ApiError } from '@valinexus/shared';

// Importação de rotas por módulo
import { authRouter } from '../modules/auth/auth.routes';
import { companiesRouter } from '../modules/companies/companies.routes';
import { certificationsRouter } from '../modules/certifications/certifications.routes';
import { notificationsRouter } from '../modules/notifications/notifications.routes';

export function createApp(): Application {
  const app = express();

  // Railway (e a maioria dos hosts cloud) roteia via proxy reverso.
  // Sem isso, express-rate-limit lança ValidationError ao ver X-Forwarded-For.
  app.set('trust proxy', 1);

  // ── Segurança ────────────────────────────────────────────────────────────
  // helmet() define ~14 cabeçalhos HTTP de segurança automaticamente:
  // X-Content-Type-Options, X-Frame-Options, HSTS, CSP, etc.
  app.use(helmet());

  // CORS: em produção, FRONTEND_URL é obrigatório — sem ela qualquer origem
  // poderia fazer requests autenticados (credentials: true).
  const frontendOrigin = process.env.FRONTEND_URL;
  if (!frontendOrigin && process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_URL não definido — obrigatório em produção');
  }
  app.use(cors({
    origin: frontendOrigin ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Rate limiting global: máximo 100 requests por IP a cada 15 minutos.
  // Rotas sensíveis (login) terão seus próprios limitadores mais restritivos.
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  }));

  // ── Parsing ──────────────────────────────────────────────────────────────
  app.use(cookieParser()); // necessário para ler req.cookies (refreshToken httpOnly)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Logging de requests ──────────────────────────────────────────────────
  // Log estruturado de todas as requisições. Em produção, o JSON vai para
  // CloudWatch / Datadog. Em desenvolvimento, aparece formatado no terminal.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next();
  });

  // ── Health Check ─────────────────────────────────────────────────────────
  // Endpoint que load balancers e orquestradores (ECS, Kubernetes) usam
  // para verificar se o serviço está saudável.
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'valinexus-api',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
    });
  });

  // ── Rotas da API ─────────────────────────────────────────────────────────
  // Prefixo /api/v1 desde o início — facilita versionar a API no futuro
  // sem quebrar clientes existentes (v1 continua funcionando quando v2 sair).
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/companies', companiesRouter);
  app.use('/api/v1/certifications', certificationsRouter);
  app.use('/api/v1/notifications', notificationsRouter);

  // ── 404 Handler ──────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Rota não encontrada', statusCode: 404 } satisfies ApiError);
  });

  // ── Global Error Handler ─────────────────────────────────────────────────
  // Express reconhece o error handler pelo 4 parâmetros (err, req, res, next).
  // Centralizar tratamento de erros evita try/catch repetido em cada rota.
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error({
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    // Não expor stack trace em produção — vazamento de informação sensível.
    const message = process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message;

    res.status(500).json({
      success: false,
      error: message,
      statusCode: 500,
    } satisfies ApiError);
  });

  return app;
}
