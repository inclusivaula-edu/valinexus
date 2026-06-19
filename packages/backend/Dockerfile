# =============================================================================
# Dockerfile — Backend VALINEXUS
#
# Build em 2 estágios (multi-stage):
# Estágio 1 (builder): instala TODAS as dependências e compila TypeScript
# Estágio 2 (runner):  copia só o /dist e as deps de produção
#
# Resultado: imagem final ~3x menor que uma imagem única.
# Imagem menor = pull mais rápido no deploy, menos superfície de ataque.
# =============================================================================

# ── Estágio 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifests de dependência ANTES do código fonte.
# Docker cacheia cada layer — se package.json não mudou, não reinstala.
# Isso torna rebuilds 10x mais rápidos na prática.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Instalar TODAS as deps (incluindo devDeps para o build TypeScript)
RUN npm install --frozen-lockfile

# Copiar código fonte
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

# Compilar shared primeiro (backend depende dele)
WORKDIR /app/packages/shared
RUN npm run build

# Compilar backend
WORKDIR /app/packages/backend
RUN npm run build

# ── Estágio 2: Runner (imagem de produção) ────────────────────────────────────
FROM node:20-alpine AS runner

# Criar usuário não-root — rodar como root em container é má prática de segurança
RUN addgroup -S valinexus && adduser -S valinexus -G valinexus

WORKDIR /app

# Copiar manifests para instalar apenas deps de produção
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN npm install --frozen-lockfile --omit=dev

# Copiar artefatos compilados do estágio builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copiar migrations e seed (rodados em runtime, não em build)
COPY packages/backend/src/database/migrations ./packages/backend/src/database/migrations

# Trocar para usuário não-root
USER valinexus

EXPOSE 3001

# Health check — Railway usa isso para saber se o container está saudável
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Script de entrada: roda migrations ANTES de subir o servidor
# Isso garante que o banco está sempre atualizado no deploy
CMD ["sh", "-c", "node packages/backend/dist/database/migrate.js && node packages/backend/dist/server.js"]
