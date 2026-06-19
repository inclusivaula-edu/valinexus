# =============================================================================
# Dockerfile — Frontend VALINEXUS
#
# Estágio 1: build do Vite (Node.js)
# Estágio 2: serve os arquivos estáticos com nginx
#
# nginx é 10x mais eficiente que "vite preview" para servir arquivos estáticos.
# Além disso, o nginx.conf configura:
# - Gzip para reduzir tamanho dos assets em ~70%
# - Cache agressivo para assets com hash no nome (JS/CSS)
# - Fallback para index.html (necessário para React Router — SPA)
# =============================================================================

# ── Estágio 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

RUN npm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/

# Build do shared (tipos TypeScript usados no frontend)
WORKDIR /app/packages/shared
RUN npm run build

# Build do frontend (gera /dist com assets otimizados)
WORKDIR /app/packages/frontend
RUN npm run build

# ── Estágio 2: nginx ──────────────────────────────────────────────────────────
FROM nginx:1.25-alpine AS runner

# Remover config padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar nossa config customizada
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar os assets buildados
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
