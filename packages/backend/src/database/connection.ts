/**
 * database/connection.ts — Pool de conexões PostgreSQL
 *
 * Por que Pool e não Client?
 * - Pool mantém N conexões abertas e as reutiliza.
 * - Abrir/fechar uma conexão TCP custaaprox. 50ms — inaceitável por request.
 * - Em produção, o pool gerencia até 20 conexões simultâneas sem overhead.
 *
 * Por que não ORM (Sequelize, Prisma)?
 * Decisão deliberada. Para a fase inicial do VALINEXUS:
 * - SQL direto é mais transparente (você vê exatamente o que vai no banco)
 * - Menos dependências = menos surface area de bugs e problemas de versão
 * - Mais fácil de ensinar e depurar para um dev iniciante
 * - Quando o projeto crescer, migrar para Prisma é uma refatoração limpa
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

// Railway injeta DATABASE_URL automaticamente no PostgreSQL plugin.
// Se DATABASE_URL existe, ela tem prioridade — contém host, porta, user,
// password e database num formato único aceito pelo pg.Pool.
// Em dev local, usamos as variáveis individuais do .env.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // SSL obrigatório em produção (Railway usa SSL no PostgreSQL)
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      max: parseInt(process.env.DB_POOL_MAX ?? '10'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      database: process.env.DB_NAME ?? 'valinexus',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      max: parseInt(process.env.DB_POOL_MAX ?? '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

// Instância única do pool (singleton) — importada por todos os repositórios.
export const db = new Pool(poolConfig);

// Log de eventos do pool — útil para diagnosticar vazamentos de conexão.
db.on('error', (err) => {
  logger.error('Erro inesperado no pool PostgreSQL:', err);
});

/**
 * Helper para executar queries dentro de uma transação.
 * Uso: await withTransaction(async (client) => { await client.query(...) })
 *
 * A transação é automaticamente commitada ou revertida (rollback) em caso
 * de erro. Sem isso, você precisa lembrar de chamar COMMIT/ROLLBACK manualmente
 * em cada lugar — fonte clássica de bugs.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // SEMPRE liberar o client de volta ao pool, mesmo em caso de erro.
    // Não fazer isso causa "connection leak" — o pool esgota em minutos.
    client.release();
  }
}
