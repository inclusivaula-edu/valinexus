# Changelog — VALINEXUS

Todas as mudanças relevantes da Plataforma são documentadas aqui.

Formato: `[MAJOR.MINOR.PATCH] - AAAA-MM-DD`  
Tipos de mudança: `Adicionado` · `Alterado` · `Corrigido` · `Removido` · `Segurança`

---

## [1.0.0] - 2026-07-01

Lançamento inicial da Plataforma VALINEXUS.

### Adicionado

**Autenticação e Controle de Acesso**
- Login com e-mail e senha
- Troca obrigatória de senha no primeiro acesso
- Controle de roles: SUPER_ADMIN, COMPANY_ADMIN, COMPANY_USER, VIEWER
- Tokens JWT com expiração de 15 minutos + refresh automático
- Rate limiting para proteção contra força bruta

**Gestão de Certidões**
- Cadastro de certidões com nome, categoria, órgão emissor, datas e número
- 8 categorias disponíveis: Fiscal, Trabalhista, Segurança, Técnico, Ambiental, Operacional, Petrobras, Seguro
- Cálculo automático de status (Válida, Vencendo em breve, Vencida, Aguardando upload)
- Upload de documentos PDF e imagens (até 10MB) com armazenamento em AWS S3
- Acesso a documentos via URL pré-assinada com expiração de 1 hora
- Score de conformidade (0–100) calculado em tempo real

**Alertas Automáticos**
- Alertas por WhatsApp (Evolution API) e e-mail (SMTP/Brevo)
- Gatilhos em: 30 dias, 15 dias, 7 dias antes do vencimento e no vencimento
- Scheduler automático executado diariamente às 08h
- Severidade automática: CRITICAL (≤7d), HIGH (8–15d), MEDIUM (16–30d)

**Dashboard**
- Visão geral de certidões por status
- Score de conformidade com histórico
- Alertas críticos em destaque
- Próximas expirations (30 dias)

**Painel Administrativo (SUPER_ADMIN)**
- Cadastro de empresas clientes com usuário admin em operação única
- Geração de senha temporária segura
- Listagem de empresas com KPIs
- Filtro por status e busca por nome/CNPJ
- Ação de suspender/reativar empresas

**Infraestrutura**
- Monorepo com pacotes `@valinexus/shared`, `@valinexus/backend`, `@valinexus/frontend`
- Deploy via Dockerfile no Railway
- Banco PostgreSQL gerenciado com migrations automáticas no boot
- 165 testes automatizados (unitários + integração), cobertura >80%

---

## Próximas versões (Roadmap)

### [1.1.0] — Previsto Q3 2026
- [ ] Autenticação multifator (MFA) por TOTP
- [ ] Exportação de certidões em CSV e ZIP
- [ ] Templates de certidões Petrobras pré-carregados no onboarding
- [ ] Página pública de status (`status.valinexus.com.br`)

### [1.2.0] — Previsto Q4 2026
- [ ] Relatório PDF exportável de conformidade
- [ ] Histórico de renovações por certidão
- [ ] Configuração de alertas customizados por certidão
- [ ] App mobile (PWA)

### [2.0.0] — Previsto 2027
- [ ] Módulo financeiro básico
- [ ] Integração com portal CRC Petrobras (consulta automática)
- [ ] Múltiplas empresas por conta (grupos empresariais)
- [ ] API pública documentada (OpenAPI)

---

*Para sugerir funcionalidades ou reportar bugs: `suporte@valinexus.com.br`*
