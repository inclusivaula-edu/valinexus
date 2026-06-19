/**
 * utils/logger.ts — Logger estruturado com Winston
 *
 * Por que não usar console.log?
 * Em produção você precisa de:
 * - Níveis de log (debug, info, warn, error) para filtrar no CloudWatch
 * - Formato JSON para logs poderem ser indexados e consultados
 * - Contexto automático (timestamp, nível)
 *
 * Winston resolve tudo isso. Em desenvolvimento, o output é legível no terminal.
 * Em produção, vira JSON puro para ingestão por Datadog/CloudWatch/ELK.
 */

import winston from 'winston';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: isDev
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
  transports: [
    new winston.transports.Console(),
  ],
});
