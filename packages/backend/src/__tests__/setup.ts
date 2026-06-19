/**
 * __tests__/setup.ts
 *
 * Executado antes de cada arquivo de teste (Jest setupFiles).
 * Define variáveis de ambiente para o ambiente de teste e
 * silencia o logger para não poluir o output dos testes.
 *
 * Padrão: testes unitários NUNCA tocam em banco de dados real.
 * Testes de integração usam uma database separada (valinexus_test).
 */

// Variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_seguro_o_suficiente_para_testes_unitarios';
process.env.JWT_EXPIRES_IN = '15m';
process.env.NOTIFICATIONS_ENABLED = 'false'; // nunca enviar mensagens reais em teste
process.env.APP_URL = 'http://localhost:5173';

// Banco de teste — separado do desenvolvimento
process.env.DB_NAME = 'valinexus_test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres_dev_password';

// Silenciar o logger durante testes — output limpo no terminal
jest.mock('../utils/logger', () => ({
  logger: {
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
