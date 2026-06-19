/**
 * middleware/validateRequest.ts — Middleware de validação com Zod
 *
 * Recebe um schema Zod que descreve o formato esperado do request
 * (body, params, query) e rejeita a request imediatamente se os dados
 * não estiverem no formato esperado.
 *
 * O resultado prático: os controllers recebem dados garantidamente válidos.
 * Não existe mais "e se o body não tiver o campo obrigatório?" nos controllers.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      // Zod retorna erros por campo — formatamos para o padrão ApiError
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.slice(1).join('.') || 'root';
        details[field] = [...(details[field] ?? []), issue.message];
      }
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos na requisição',
        details,
        statusCode: 400,
      });
    }

    next();
  };
}
