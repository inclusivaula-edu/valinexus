# TODO

## Documentação legal — publicar no site
- [ ] Publicar `docs/legal/termos-de-uso.md` em `valinexus.com.br/termos`
- [ ] Publicar `docs/legal/politica-de-privacidade.md` em `valinexus.com.br/privacidade`
- [ ] Publicar `docs/legal/sla-acordo-nivel-servico.md` em `valinexus.com.br/sla`
- [ ] Revisar cláusula 7 (limitação de responsabilidade) e cláusula 10.2 (juros) com advogado
- [ ] Inserir razão social e CNPJ definitivos nos documentos legais
- [ ] Criar página de histórico de versões dos Termos (`/termos/historico`)

---

## Deploy Railway

## Deploy VALINEXUS no Railway

### Pré-requisitos
- [ ] Instalar Railway CLI: `npm install -g @railway/cli`
- [ ] Login: `railway login`

### Passo a passo

1. **Criar projeto**
   ```bash
   railway init
   # "Create new project" → nome: valinexus
   ```

2. **Adicionar PostgreSQL**
   - Painel Railway → projeto `valinexus` → **"+ New"** → **"Database"** → **"PostgreSQL"**

3. **Criar serviço backend**
   ```bash
   railway service create
   # Nome: backend
   ```
   - Painel → Settings → Dockerfile Path: `packages/backend/Dockerfile`
   - Root Directory: `/`
   - Port: `3001`

4. **Variáveis de ambiente — backend**
   ```
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=<node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
   NOTIFICATIONS_ENABLED=true
   EVOLUTION_INSTANCE=valinexus
   EVOLUTION_API_URL=<sua evolution api>
   EVOLUTION_API_KEY=<sua chave>
   S3_BUCKET_NAME=valinexus-docs
   AWS_REGION=sa-east-1
   AWS_ACCESS_KEY_ID=<sua key>
   AWS_SECRET_ACCESS_KEY=<sua secret>
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=<email brevo>
   SMTP_PASS=<chave brevo>
   SMTP_FROM_NAME=VALINEXUS Alertas
   SMTP_FROM_EMAIL=alertas@valinexus.com.br
   ```
   > `DATABASE_URL` é injetado automaticamente pelo Railway — não configurar manualmente.

5. **Deploy backend**
   ```bash
   railway up --service backend
   railway logs --service backend
   ```

6. **Verificar saúde**
   ```bash
   curl https://valinexus-api.up.railway.app/health
   # esperado: {"status":"ok","service":"valinexus-api"}
   ```

7. **Seed inicial (uma única vez)**
   ```bash
   railway run --service backend node packages/backend/dist/database/seed.js
   ```

8. **Criar serviço frontend**
   - Painel → **"+ New"** → **"Empty Service"** → nome: `frontend`
   - Dockerfile Path: `packages/frontend/Dockerfile`
   - Port: `80`
   - Variável: `VITE_API_URL=https://valinexus-api.up.railway.app/api/v1`

9. **Atualizar variáveis do backend com URL do frontend**
   ```
   FRONTEND_URL=https://valinexus-frontend.up.railway.app
   APP_URL=https://valinexus-frontend.up.railway.app
   ```

10. **Deploy frontend**
    ```bash
    railway up --service frontend
    ```

---

> Guia completo: `DEPLOY.md`
