# valinexus — Primeiros Passos

Guia para rodar o projeto do zero pela primeira vez.

---

## Pré-requisitos

Instale antes de começar:

| Ferramenta | Versão mínima | Download |
|------------|---------------|----------|
| Node.js | 18+ | https://nodejs.org |
| Docker Desktop | qualquer | https://docker.com/products/docker-desktop |
| Git | qualquer | https://git-scm.com |

---

## Setup (primeira vez)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

O arquivo `.env` já vem com valores de desenvolvimento que funcionam localmente.
**Não altere nada por enquanto.**

### 3. Subir o banco de dados

```bash
docker-compose up -d postgres
```

Aguarde ~10 segundos até o PostgreSQL estar pronto. Verifique com:

```bash
docker-compose ps
# postgres deve mostrar "healthy"
```

### 4. Criar as tabelas (migration)

```bash
cd packages/backend
npx ts-node src/database/migrate.ts
```

Saída esperada:
```
▸ Aplicando: 001_initial_schema.sql...
✅ 001_initial_schema.sql
▸ Aplicando: 002_notification_settings.sql...
✅ 002_notification_settings.sql
▸ Aplicando: 003_certification_s3_key.sql...
✅ 003_certification_s3_key.sql
▸ Aplicando: 004_must_change_password.sql...
✅ 004_must_change_password.sql
✅ 4 migration(s) aplicada(s) com sucesso.
```

### 5. Popular com dados iniciais (seed)

```bash
npx ts-node src/database/seed.ts
```

Saída esperada:
```
▸ Criando usuário administrador valinexus...
  ✅ Admin criado: claudersonalmeida@gmail.com
▸ Criando empresa cliente...
  ✅ Empresa criada: Construtora Amapá Ltda
▸ Criando usuário da empresa cliente...
  ✅ Usuário cliente criado: admin@constramapa.com.br
   Senha temporária: Acesso@2026!
   ⚠️  must_change_password = true — o cliente será obrigado a trocar a senha no primeiro login
▸ Aplicando certidões Petrobras...
  ✅ 14 certidões cadastradas

📋 Credenciais de acesso:

  ADMIN valinexus (não precisa trocar senha):
    Email:  claudersonalmeida@gmail.com
    Senha:  valinexus@2026!

  CLIENTE (será obrigado a trocar a senha no primeiro login):
    Email:  admin@constramapa.com.br
    Senha:  Acesso@2026!
```

> **Nota sobre segurança:** o usuário da empresa cliente é criado com
> `must_change_password = true`. No primeiro login, o frontend redireciona
> automaticamente para a tela de troca de senha obrigatória — a senha
> temporária acima não pode ser usada permanentemente. O admin da
> plataforma (`SUPER_ADMIN`) é a única exceção.

### 6. Rodar o projeto completo

Abra **dois terminais**:

**Terminal 1 — Backend:**
```bash
cd packages/backend
npx ts-node-dev --respawn --transpile-only src/server.ts
```

**Terminal 2 — Frontend:**
```bash
cd packages/frontend
npm run dev
```

Acesse: **http://localhost:5173**

---

## Cadastrar um novo cliente (onboarding assistido)

Para cada novo cliente, rode o seed com as variáveis da empresa dele:

```bash
cd packages/backend

CLIENT_RAZAO="Transportadora Norte Ltda" \
CLIENT_CNPJ="98.765.432/0001-10" \
CLIENT_EMAIL="contato@transnorte.com.br" \
CLIENT_USER_EMAIL="admin@transnorte.com.br" \
CLIENT_USER_PASSWORD="Senha@Temp123" \
CLIENT_WHATSAPP="(96) 99888-7766" \
npx ts-node src/database/seed.ts
```

O cliente já entra no sistema com:
- Conta criada e senha temporária
- 14 certidões padrão Petrobras cadastradas
- Status realista (algumas vencidas, algumas a vencer) para o dashboard ter impacto visual imediato

Depois do onboarding, oriente o cliente a trocar a senha no primeiro acesso.

---

## Comandos úteis

```bash
# Subir tudo com Docker
docker-compose up -d

# Ver logs do banco
docker-compose logs -f postgres

# Resetar banco (apaga tudo e recomeça)
docker-compose down -v && docker-compose up -d postgres
# Depois: migrate + seed novamente

# Verificar saúde da API
curl http://localhost:3001/health
```

---

## Estrutura de URLs

| URL | O que é |
|-----|---------|
| http://localhost:5173 | Frontend (tela de login e dashboard) |
| http://localhost:3001/health | Health check da API |
| http://localhost:3001/api/v1/auth/login | Endpoint de login |
| http://localhost:3001/api/v1/certifications | Certidões (requer auth) |

---

## Próximos módulos a desenvolver

- [ ] Tela de cadastro de nova certidão (formulário)
- [ ] Upload de arquivo PDF da certidão
- [ ] Integração WhatsApp (Evolution API) para alertas
- [ ] Módulo de gestão de empresas (painel admin)
- [ ] Módulo de logística GPS (Fase 2)
