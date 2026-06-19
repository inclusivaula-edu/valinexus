/**
 * server.ts — Ponto de entrada da aplicação
 *
 * Este arquivo faz UMA coisa: configura o servidor Express e o inicializa.
 * Toda a lógica de negócio fica nos módulos dentro de /modules.
 * Toda a configuração de middleware fica em /config/app.ts.
 * Separar responsabilidades assim facilita testes (podemos importar o app
 * sem subir o servidor HTTP — padrão usado em grandes codebases).
 */

import 'dotenv/config';
import { createApp } from './config/app';
import { db } from './database/connection';
import { logger } from './utils/logger';
import { certificationScheduler } from './modules/notifications/scheduler';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

async function bootstrap() {
  try {
    // 1. Testar conexão com o banco antes de subir o servidor
    await db.connect();
    logger.info('✅ Conexão com PostgreSQL estabelecida');

    // 2. Criar e configurar o app Express
    const app = createApp();

    // 3. Iniciar o servidor HTTP
    app.listen(PORT, () => {
      logger.info(`🚀 VALINEXUS API rodando em http://localhost:${PORT}`);
      logger.info(`📋 Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
    });

    // 4. Iniciar scheduler de alertas de vencimento de certidões
    // (roda em background, verifica todo dia às 8h)
    certificationScheduler.start();
    logger.info('⏰ Scheduler de alertas de certidões ativo');

    // 5. Graceful shutdown — encerra conexões limpamente
    const shutdown = async (signal: string) => {
      logger.info(`📴 Recebido ${signal}, encerrando servidor...`);
      await db.end();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Falha ao inicializar o servidor:', error);
    process.exit(1);
  }
}

bootstrap();
