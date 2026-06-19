# valinexus — Guia de Deploy no Railway

Deploy completo em ~20 minutos. Ao final, você terá:
- API rodando em `https://valinexus-api.up.railway.app`
- Frontend em `https://valinexus.up.railway.app`
- PostgreSQL gerenciado pelo Railway (backup automático)
- Deploy automático a cada `git push`

---

## Pré-requisitos

1. Conta no Railway: https://railway.app (plano Hobby: $5/mês — suficiente para MVP)
2. Conta no GitHub com o repositório do projeto
3. Railway CLI instalado:
```bash
npm install -g @railway/cli
railway login
```

---

## Parte 1 — Criar o projeto no Railway

### 1.1 Criar projeto

```bash
# Na raiz do projeto
railway init
# Escolha: "Create new project"
# Nome: valinexus
```

### 1.2 Adicionar PostgreSQL

No painel Railway (railway.app):
1. Abra o projeto `valinexus`
2. Clique em **"+ New"** → **"Database"** → **"PostgreSQL"**
3. O Railway cria o banco e injeta `DATABASE_URL` automaticamente

---

## Parte 2 — Deploy do Backend

### 2.0 Criar o bucket S3 para documentos das certidões

O upload de documentos (PDFs, fotos de certidões) é armazenado no AWS S3.
Sem isso configurado, o sistema funciona em **modo simulado** — os uploads
"funcionam" na interface mas os arquivos não são salvos de fato.

**Criar o bucket:**

1. AWS Console → S3 → **Create bucket**
   - Nome: `valinexus-docs` (ou outro nome único globalmente)
   - Região: `sa-east-1` (São Paulo — menor latência para Macapá)
   - Bloquear acesso público: **mantenha ativado** (os arquivos são privados;
     o acesso é via URL pré-assinada temporária gerada pela API)

2. Criar um usuário IAM dedicado (não use a conta root):
   - IAM → Users → **Create user** → `valinexus-s3-uploader`
   - Anexe esta política (substitua `valinexus-docs` pelo nome do seu bucket):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::valinexus-docs/*"
    }
  ]
}
```

3. Gere uma **Access Key** para este usuário (IAM → Users → Security credentials
   → Create access key → "Application running outside AWS")

4. Guarde o `Access Key ID` e `Secret Access Key` — você vai usar nas
   variáveis de ambiente do backend (próximo passo)

> **Custo:** S3 cobra ~$0.023/GB/mês de armazenamento + requests.
> Para o volume do MVP (centenas de PDFs), o custo fica abaixo de $1/mês —
> dentro do free tier do primeiro ano da AWS (5GB gratuitos).


### 2.1 Criar serviço backend

```bash
# Crie um serviço apontando para o Dockerfile do backend
railway service create
# Nome: backend
```

No painel Railway → Service `backend` → Settings:
- **Root Directory:** `/` (raiz do monorepo)
- **Dockerfile Path:** `packages/backend/Dockerfile`
- **Port:** `3001`

### 2.2 Configurar variáveis de ambiente

No painel Railway → Service `backend` → **Variables**, adicione:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
NOTIFICATIONS_ENABLED=true
EVOLUTION_API_URL=<sua evolution api>
EVOLUTION_API_KEY=<sua chave>
EVOLUTION_INSTANCE=valinexus
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<seu email brevo>
SMTP_PASS=<sua chave brevo>
SMTP_FROM_NAME=valinexus Alertas
SMTP_FROM_EMAIL=alertas@valinexus.com.br
AWS_REGION=sa-east-1
AWS_ACCESS_KEY_ID=<access key do usuário IAM criado no passo 2.0>
AWS_SECRET_ACCESS_KEY=<secret key do usuário IAM criado no passo 2.0>
S3_BUCKET_NAME=valinexus-docs
```

> O Railway injeta `DATABASE_URL` automaticamente — não precisa configurar manualmente.

### 2.3 Deploy

```bash
railway up --service backend
```

Acompanhe os logs:
```bash
railway logs --service backend
```

Saída esperada após ~2min:
```
▸ Aplicando: 001_initial_schema.sql...
✅ 001_initial_schema.sql
▸ Aplicando: 002_notification_settings.sql...
✅ 002_notification_settings.sql
🚀 valinexus API rodando em http://0.0.0.0:3001
✅ Conexão com PostgreSQL estabelecida
⏰ Scheduler de alertas ativo
```

### 2.4 Verificar saúde da API

```bash
curl https://valinexus-api.up.railway.app/health
# {"status":"ok","service":"valinexus-api","timestamp":"..."}
```

### 2.5 Rodar o seed inicial (uma única vez)

```bash
# Conectar no serviço e rodar o seed
railway run --service backend \
  node packages/backend/dist/database/seed.js
```

---

## Parte 3 — Deploy do Frontend

### 3.1 Criar serviço frontend

No painel Railway → **"+ New"** → **"Empty Service"**
- Nome: `frontend`
- **Dockerfile Path:** `packages/frontend/Dockerfile`
- **Port:** `80`

### 3.2 Configurar variável de ambiente do frontend

No painel Railway → Service `frontend` → **Variables**:

```
VITE_API_URL=https://valinexus-api.up.railway.app/api/v1
```

> **Importante:** esta variável é injetada em tempo de BUILD pelo Vite.
> Depois de configurar, você precisa fazer um novo deploy do frontend.

### 3.3 Atualizar FRONTEND_URL no backend

No service `backend` → Variables, adicione:
```
FRONTEND_URL=https://valinexus-frontend.up.railway.app
APP_URL=https://valinexus-frontend.up.railway.app
```

### 3.4 Deploy do frontend

```bash
railway up --service frontend
```

---

## Parte 4 — Domínio personalizado (opcional)

Se você tiver um domínio (ex: `app.valinexus.com.br`):

1. Railway → Service `frontend` → Settings → **Custom Domain**
2. Adicione `app.valinexus.com.br`
3. O Railway gera os registros DNS — configure no seu registrador (Registro.br, Cloudflare, etc.)
4. SSL é provisionado automaticamente (Let's Encrypt)

---

## Parte 5 — CI/CD automático (deploy a cada push)

O Railway detecta o repositório GitHub automaticamente.

1. Railway → Service → Settings → **Source** → conecte o repositório GitHub
2. Branch: `main`
3. A partir daí, cada `git push origin main` dispara um novo deploy automaticamente

Fluxo recomendado:
```
develop branch → testa local → merge para main → Railway deploy automático
```

---

## Comandos úteis pós-deploy

```bash
# Ver logs em tempo real
railway logs --service backend -f

# Executar migrations manualmente
railway run --service backend \
  node packages/backend/dist/database/migrate.js

# Cadastrar novo cliente via seed
railway run --service backend \
  CLIENT_RAZAO="Nome da Empresa" \
  CLIENT_CNPJ="00.000.000/0001-00" \
  CLIENT_USER_EMAIL="admin@empresa.com.br" \
  CLIENT_USER_PASSWORD="Senha@Temp123" \
  node packages/backend/dist/database/seed.js

# Disparar scheduler manualmente (via API)
curl -X POST https://valinexus-api.up.railway.app/api/v1/notifications/run-scheduler \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN"

# Verificar uso de recursos
railway status
```

---

## Estimativa de custo Railway (MVP)

| Recurso | Plano | Custo |
|---------|-------|-------|
| Backend (Node.js) | Hobby | ~$2/mês |
| Frontend (nginx) | Hobby | ~$1/mês |
| PostgreSQL | Hobby | ~$2/mês |
| **Total** | | **~$5/mês** |

Com 10 clientes pagando R$ 490/mês = R$ 4.900 MRR.
Custo de infra = ~R$ 27/mês (menos de 1% da receita).

---

## Troubleshooting comum

**Build falha: "cannot find module @valinexus/shared"**
→ Verifique se o Dockerfile copia e builda o pacote shared antes do backend.

**API retorna 500 em produção**
→ `railway logs --service backend` — procure por "Error" nos logs.
→ Verifique se todas as variáveis de ambiente estão configuradas.

**Frontend não conecta na API (CORS)**
→ Confirme que `FRONTEND_URL` no backend está com a URL exata do frontend (sem barra no final).

**Scheduler não envia WhatsApp**
→ Confirme `NOTIFICATIONS_ENABLED=true` e que `EVOLUTION_API_URL` está acessível.
→ Teste manualmente: POST `/api/v1/notifications/test` com o token de admin.
