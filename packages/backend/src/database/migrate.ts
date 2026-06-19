/**
 * database/migrate.ts — Runner de migrations
 *
 * Por que precisamos disso em vez de rodar o SQL na mão?
 *
 * À medida que o produto evolui, o schema do banco muda: novas tabelas,
 * novos campos, índices removidos. Em um time ou em múltiplos ambientes
 * (dev, staging, produção), é inviável lembrar "quais SQLs já rodei aqui".
 *
 * O runner resolve isso:
 * 1. Cria uma tabela de controle (_migrations) se não existir
 * 2. Lê todos os arquivos .sql de /migrations em ordem alfabética
 * 3. Roda apenas os que ainda não foram aplicados
 * 4. Registra cada migration aplicada com timestamp
 *
 * Resultado: qualquer ambiente novo roda "npx ts-node src/database/migrate.ts"
 * e chega ao estado correto, independente de quantas migrations existam.
 *
 * Como usar:
 *   npx ts-node src/database/migrate.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432'),
        database: process.env.DB_NAME ?? 'valinexus',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres_dev_password',
      }
);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   VALINEXUS — Migrations                ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const client = await pool.connect();

  try {
    // 1. Garantir que a tabela de controle existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Buscar migrations já aplicadas
    const { rows } = await client.query('SELECT filename FROM _migrations');
    const applied = new Set(rows.map((r: { filename: string }) => r.filename));

    // 3. Ler arquivos de migration em ordem
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // ordem alfabética = ordem numérica com prefixo 001_, 002_...

    if (files.length === 0) {
      console.log('  ⚠️  Nenhum arquivo .sql encontrado em /migrations');
      return;
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ⏭️  Pulando (já aplicada): ${file}`);
        continue;
      }

      console.log(`  ▸ Aplicando: ${file}...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`  ✅ ${file}`);
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} falhou: ${(err as Error).message}`);
      }
    }

    if (ran === 0) {
      console.log('\n  ✅ Banco já está atualizado. Nenhuma migration pendente.');
    } else {
      console.log(`\n  ✅ ${ran} migration(s) aplicada(s) com sucesso.`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('\n❌ Falha no runner de migrations:', err.message);
  process.exit(1);
});
