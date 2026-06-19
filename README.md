# valinexus Macapá

> Sistema de gestão de certidões e conformidade para empresas terceirizadas da cadeia Petrobras no Amapá.

---

## Visão Geral do Produto

O valinexus resolve um problema crítico e recorrente: empresas terceirizadas da Petrobras perdem contratos e pagamentos por vencimento de certidões obrigatórias. O sistema monitora automaticamente todos os documentos exigidos pelo CRC Petrobras e envia alertas via WhatsApp e e-mail com antecedência suficiente para renovação.

---

## Arquitetura do Sistema

```
valinexus/                        ← Monorepo (npm workspaces)
├── packages/
│   ├── shared/                    ← Tipos TypeScript compartilhados
│   │   └── src/index.ts           ← Enums, interfaces, DTOs, utilitários
│   │
│   ├── backend/                   ← API REST (Node.js + Express + TypeScript)
│   │   └── src/
│   │       ├── server.ts          ← Entry point
│   │       ├── config/app.ts      ← Middleware, rotas, error handler
│   │       ├── database/
│   │       │   ├── connection.ts  ← Pool PostgreSQL
│   │       │   └── migrations/    ← SQL versionado
│   │       ├── modules/
│   │       │   ├── auth/          ← JWT, refresh tokens
│   │       │   ├── companies/     ← CRUD de empresas
│   │       │   ├── certifications/← Módulo principal de certidões
│   │       │   └── notifications/ ← Scheduler de alertas
│   │       ├── middleware/
│   │       │   ├── authenticate.ts← Validação JWT
│   │       │   └── validateRequest.ts ← Validação Zod
│   │       └── utils/logger.ts    ← Winston structured logging
│   │
│   └── frontend/                  ← SPA React + Vite + TypeScript
│       └── src/
│           ├── pages/Dashboard.tsx← Dashboard principal
│           ├── components/        ← Componentes reutilizáveis
│           ├── hooks/             ← Custom hooks (useApi, useAuth)
│           ├── services/          ← Camada de chamadas HTTP (Axios)
│           └── store/             ← Estado global (Context API)
│
├── docker-compose.yml             ← Ambiente local completo em 1 comando
├── .env.example                   ← Template de variáveis de ambiente
└── package.json                   ← Configuração do monorepo
```

### Decisões de Arquitetura

**Por que monorepo?** O pacote `@valinexus/shared` contém os tipos TypeScript que são a "fonte da verdade" dos contratos entre frontend e backend. Quando você muda um campo na interface `Certification`, o TypeScript avisa em todos os lugares onde aquele campo é usado — em tempo de compilação, antes do bug chegar em produção.

**Por que SQL direto em vez de ORM?** Para a fase MVP, queries SQL explícitas são mais transparentes e mais fáceis de ensinar. Cada query no repositório pode ser lida e entendida sem conhecer a "mágica" de um ORM. A migração para Prisma ou TypeORM pode ser feita modularmente quando o projeto crescer.

**Por que Repository + Service + Controller em vez de tudo junto?** Cada camada tem uma responsabilidade única. O Repository só fala com o banco. O Service contém as regras de negócio. O Controller só traduz HTTP. Isso permite testar cada camada independentemente e facilita a manutenção à medida que o time cresce.

---

## Rodando Localmente

### Pré-requisitos
- Docker e Docker Compose
- Node.js >= 18
- npm >= 9

### Setup em 3 comandos

```bash
# 1. Clonar e entrar no projeto
git clone https://github.com/seu-usuario/valinexus.git && cd valinexus

# 2. Copiar e configurar as variáveis de ambiente
cp .env.example .env

# 3. Subir tudo (banco + API + frontend)
docker-compose up -d
```

A aplicação estará disponível em:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Health check:** http://localhost:3001/health

### Desenvolvimento sem Docker

```bash
# Instalar todas as dependências do monorepo
npm install

# Subir apenas o banco via Docker
docker-compose up -d postgres

# Rodar backend e frontend em paralelo (hot reload)
npm run dev
```

---

## Endpoints da API (v1)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/auth/login` | Login com email + senha |
| POST | `/api/v1/auth/refresh` | Renovar access token |
| GET | `/api/v1/certifications` | Listar certidões da empresa |
| GET | `/api/v1/certifications/dashboard` | Resumo e alertas |
| GET | `/api/v1/certifications/templates` | Certidões-padrão Petrobras |
| POST | `/api/v1/certifications` | Criar nova certidão |
| PATCH | `/api/v1/certifications/:id` | Atualizar certidão |
| POST | `/api/v1/certifications/:id/upload` | Upload do documento |
| DELETE | `/api/v1/certifications/:id` | Remover certidão |
| GET | `/api/v1/companies` | Listar empresas (admin) |

---

## Roadmap de Módulos

| Módulo | Status | Descrição |
|--------|--------|-----------|
| M1 — Cadastro CRC | 🔄 Em desenvolvimento | Cadastro no portal Petrobras |
| M2 — Certidões | ✅ MVP pronto | Gestão e alertas automáticos |
| M3 — Logística GPS | 📅 Fase 2 (mês 10+) | Rastreamento em tempo real |
| M4 — Financeiro | 📅 Fase 3 | Contratos e acesso a crédito |
| M5 — Painel Gestor | 📅 Fase 3 | Multi-empresa, ASG |

---

## Deploy em Produção

O projeto está estruturado para deploy no Railway (mais simples) ou AWS ECS (para quando precisar de escala):

```bash
# Build de produção
npm run build

# O Railway detecta automaticamente o Dockerfile e faz o deploy
# Configure as variáveis de ambiente no painel do Railway
```

---

## Contato Comercial

**Clauderson Sousa de Almeida** — Fundador  
📧 claudersonalmeida@gmail.com  
📱 (96) 99911-3575  
📍 Macapá, Amapá — Brasil
