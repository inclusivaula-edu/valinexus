import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@valinexus/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Em dev: proxy /api → backend local (evita CORS)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // desabilitar em prod reduz tamanho do bundle
    rollupOptions: {
      output: {
        // Separar vendor libs do código da aplicação
        // Resultado: o browser faz cache das libs separadamente do app code
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  // Variáveis de ambiente com prefixo VITE_ são expostas ao browser
  // Em produção, VITE_API_URL aponta para o Railway backend URL
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? '/api/v1'),
  },
});
