# Política de Segurança da Informação — VALINEXUS

**Versão:** 1.0  
**Data de vigência:** 01 de julho de 2026  
**Classificação:** Pública

---

## 1. Objetivo

Esta Política define os princípios, controles e procedimentos que a VALINEXUS adota para proteger a confidencialidade, integridade e disponibilidade dos dados dos Clientes e da infraestrutura da Plataforma.

---

## 2. Escopo

Aplica-se a todos os sistemas, processos e pessoas envolvidos na operação da Plataforma VALINEXUS, incluindo colaboradores, prestadores de serviço e subprocessadores.

---

## 3. Controles de Segurança

### 3.1 Transmissão de dados

- Todo o tráfego entre cliente e servidor usa **HTTPS com TLS 1.2 ou superior**
- Certificados SSL/TLS renovados automaticamente (Let's Encrypt / Railway)
- Headers de segurança HTTP configurados (HSTS, X-Frame-Options, CSP, X-Content-Type-Options) via `helmet.js`
- CORS restrito ao domínio do frontend em produção

### 3.2 Autenticação e autorização

- Senhas armazenadas exclusivamente como **hash bcrypt** (fator de custo 12) — nunca em texto puro ou reversível
- Autenticação por **JWT (JSON Web Token)**: access token com expiração de 15 minutos + refresh token httpOnly com expiração de 7 dias
- Princípio do **menor privilégio**: cada role (SUPER_ADMIN, COMPANY_ADMIN, COMPANY_USER, VIEWER) acessa apenas o que é necessário
- Isolamento de dados por empresa: um Cliente nunca acessa dados de outro (tenant isolation a nível de query)
- Primeira senha gerada pelo administrador obriga troca no primeiro login (`mustChangePassword: true`)
- Rate limiting: máximo 100 requisições por IP a cada 15 minutos; endpoints de login têm limites mais restritivos

### 3.3 Armazenamento de dados

- Banco de dados PostgreSQL gerenciado pelo Railway com backups automáticos diários
- Documentos (PDFs, imagens) armazenados no **AWS S3** com:
  - Server-side encryption AES-256 (SSE-S3)
  - Bucket privado — sem acesso público
  - Acesso exclusivamente via **URLs pré-assinadas** com expiração de 1 hora
  - Região sa-east-1 (São Paulo) para dados dentro do Brasil
- Credenciais de infraestrutura gerenciadas por variáveis de ambiente (nunca no código-fonte)
- Repositório de código com `.env` no `.gitignore` — segredos nunca commitados

### 3.4 Controle de acesso interno

- Colaboradores da VALINEXUS acessam a infraestrutura de produção apenas por necessidade operacional comprovada
- Acesso ao banco de produção requer autenticação por chave SSH ou credencial pessoal — nenhum acesso compartilhado
- Contas de serviço têm permissões mínimas (IAM no AWS segue princípio do menor privilégio)
- Desligamento de colaboradores implica revogação imediata de todos os acessos no mesmo dia

### 3.5 Logs e monitoramento

- Logs estruturados (Winston) registram: método HTTP, path, IP, user-agent e timestamp de cada requisição
- Logs de autenticação: login, logout, tentativas falhas, troca de senha
- Retenção de logs: 12 meses (conforme Marco Civil da Internet)
- Logs armazenados separadamente dos dados de aplicação — não acessíveis por Usuários

### 3.6 Infraestrutura e fornecedores

- Hospedagem na Railway (infraestrutura AWS subjacente)
- Nenhum dado sensível armazenado em dispositivos locais de colaboradores
- Subprocessadores avaliados quanto à segurança antes da contratação e revisados anualmente
- Contratos com subprocessadores incluem cláusulas de segurança e proteção de dados

---

## 4. Gestão de Vulnerabilidades

4.1. **Dependências:** bibliotecas de terceiros são auditadas via `npm audit` a cada deploy. Vulnerabilidades críticas são corrigidas em até **7 dias úteis** após identificação.

4.2. **Código:** revisão de código antes de deploy em produção. Sem commits diretos na branch principal sem review.

4.3. **Divulgação responsável:** pesquisadores de segurança que identificarem vulnerabilidades são encorajados a reportar em `seguranca@valinexus.com.br` antes de qualquer divulgação pública. Comprometemo-nos a:
- Confirmar o recebimento em até 48 horas
- Investigar e comunicar o prazo de correção em até 7 dias
- Não tomar ações legais contra pesquisadores que agirem de boa-fé

---

## 5. Resposta a Incidentes

### 5.1 Classificação

| Nível | Descrição | Exemplos |
|-------|-----------|---------|
| P1 - Crítico | Exposição confirmada de dados de Clientes | Dump de banco vazado, acesso não autorizado a dados |
| P2 - Alto | Vulnerabilidade explorada sem confirmação de vazamento | Tentativa de invasão detectada |
| P3 - Médio | Vulnerabilidade identificada não explorada | CVE em dependência sem patch disponível |
| P4 - Baixo | Falha de configuração sem risco imediato | Header de segurança ausente |

### 5.2 Procedimento

**Identificação (0–2h):** Triagem do incidente, classificação de severidade, isolamento inicial se necessário.

**Contenção (2–8h P1, 8–24h P2):** Isolar sistemas afetados, revogar credenciais comprometidas, preservar evidências para análise forense.

**Notificação (dentro de 72h para P1/P2):** Notificar Clientes afetados por e-mail com: o que ocorreu, dados potencialmente afetados, ações tomadas e próximos passos.

**Erradicação e Recuperação:** Corrigir causa raiz, aplicar patches, restaurar serviço, verificar integridade dos dados.

**Pós-incidente (até 15 dias):** Relatório interno de lições aprendidas, atualização de controles para evitar recorrência.

### 5.3 Contato de segurança

`seguranca@valinexus.com.br`  
Para incidentes críticos em produção: número de emergência disponível para Clientes Enterprise no painel.

---

## 6. Continuidade de Negócio e Backup

6.1. **Backups do banco de dados:** automáticos diariamente pelo Railway, retenção de 7 dias, armazenados em região diferente da produção.

6.2. **Backups de documentos (S3):** versionamento habilitado no bucket, retenção de versões por 90 dias.

6.3. **RTO (Recovery Time Objective):** tempo máximo para restauração do serviço após falha — 4 horas para P1.

6.4. **RPO (Recovery Point Objective):** máximo de dados perdidos em caso de falha catastrófica — 24 horas (último backup diário).

6.5. Procedimento de restauração testado trimestralmente.

---

## 7. Treinamento e Conscientização

7.1. Novos colaboradores recebem orientação sobre esta Política antes do primeiro acesso a sistemas de produção.

7.2. Esta Política é revisada anualmente ou após qualquer incidente significativo.

---

## 8. Revisão e Contato

Esta Política é mantida pela VALINEXUS e revisada anualmente.

Para dúvidas ou reportar problemas de segurança:  
`seguranca@valinexus.com.br`
