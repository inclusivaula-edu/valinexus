# Política de Privacidade — VALINEXUS

**Versão:** 1.0  
**Data de vigência:** 01 de julho de 2026  
**Última atualização:** 19 de junho de 2026

---

## 1. Quem somos

A **VALINEXUS Tecnologia Ltda.** ("VALINEXUS", "nós") é a empresa responsável pela Plataforma de gestão de certidões e conformidade acessível em `app.valinexus.com.br`.

Para fins da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), a VALINEXUS atua como:

- **Controladora** dos dados de cadastro dos Usuários e dados operacionais da Plataforma;
- **Operadora** dos dados inseridos pelo Cliente (empresa contratante) em nome próprio.

**Encarregado de Dados (DPO):** `privacidade@valinexus.com.br`

---

## 2. Quais dados coletamos e por quê

### 2.1 Dados de cadastro e conta

| Dado | Finalidade | Base legal (LGPD) |
|------|-----------|-------------------|
| Nome completo | Identificação do Usuário | Execução de contrato (art. 7º, V) |
| E-mail corporativo | Acesso à conta, envio de alertas | Execução de contrato (art. 7º, V) |
| Número de WhatsApp | Envio de alertas de vencimento | Execução de contrato (art. 7º, V) |
| Senha (hash bcrypt) | Autenticação segura | Execução de contrato (art. 7º, V) |
| CNPJ da empresa | Identificação do Cliente | Execução de contrato (art. 7º, V) |
| Razão social e nome fantasia | Exibição na Plataforma | Execução de contrato (art. 7º, V) |

### 2.2 Dados inseridos pelo Cliente (certidões e documentos)

| Dado | Finalidade | Base legal (LGPD) |
|------|-----------|-------------------|
| Nome e dados das certidões | Gestão de conformidade | Execução de contrato (art. 7º, V) |
| Datas de emissão e vencimento | Cálculo de status e alertas | Execução de contrato (art. 7º, V) |
| Arquivos PDF/imagem de certidões | Armazenamento digital | Execução de contrato (art. 7º, V) |
| Notas e observações | Gestão interna do Cliente | Execução de contrato (art. 7º, V) |

### 2.3 Dados de uso e técnicos

| Dado | Finalidade | Base legal (LGPD) |
|------|-----------|-------------------|
| Endereço IP | Segurança e prevenção a fraudes | Legítimo interesse (art. 7º, IX) |
| Logs de acesso e ações | Auditoria e suporte técnico | Obrigação legal (art. 7º, II) / Legítimo interesse |
| User-agent do navegador | Diagnóstico de compatibilidade | Legítimo interesse (art. 7º, IX) |
| Timestamps de login | Segurança da conta | Legítimo interesse (art. 7º, IX) |

### 2.4 Dados que NÃO coletamos

A VALINEXUS **não coleta** dados de pagamento (processados diretamente pelo gateway de pagamento), dados biométricos, dados de saúde, dados de menores de 18 anos, ou qualquer dado sensível conforme definido no art. 5º, II da LGPD.

---

## 3. Como usamos seus dados

Utilizamos os dados coletados exclusivamente para:

a) Prover as funcionalidades da Plataforma contratadas;  
b) Enviar Alertas automáticos de vencimento de certidões;  
c) Autenticar e proteger o acesso às contas;  
d) Oferecer suporte técnico e responder solicitações;  
e) Cumprir obrigações legais e regulatórias;  
f) Detectar e prevenir atividades fraudulentas ou abusivas;  
g) Melhorar a Plataforma com base em dados agregados e anonimizados.

**Não utilizamos os dados para publicidade de terceiros, venda a terceiros, ou qualquer finalidade incompatível com as listadas acima.**

---

## 4. Compartilhamento de dados

A VALINEXUS compartilha dados apenas nas seguintes situações:

### 4.1 Subprocessadores (fornecedores de tecnologia)

| Fornecedor | Função | País dos servidores | Política |
|-----------|--------|---------------------|----------|
| Amazon Web Services (S3) | Armazenamento de documentos | Brasil (sa-east-1) | aws.amazon.com/privacy |
| Railway | Hospedagem da aplicação | EUA | railway.app/legal/privacy |
| Evolution API / WhatsApp Business | Envio de alertas WhatsApp | Variável | — |
| Brevo (SMTP) | Envio de e-mails | França (UE) | brevo.com/legal/privacypolicy |

Para subprocessadores fora do Brasil, a VALINEXUS adota cláusulas contratuais padrão ou verifica a existência de nível adequado de proteção, conforme art. 33 da LGPD.

### 4.2 Autoridades competentes

Podemos divulgar dados quando exigido por lei, ordem judicial ou autoridade regulatória competente (ANPD, Receita Federal, etc.).

### 4.3 Transferência em caso de aquisição

Em caso de fusão, aquisição ou venda de ativos da VALINEXUS, os dados poderão ser transferidos ao sucessor, que ficará vinculado a esta Política ou notificará os titulares sobre alterações.

**Não vendemos dados a terceiros em hipótese alguma.**

---

## 5. Retenção de dados

| Tipo de dado | Período de retenção |
|-------------|---------------------|
| Dados de conta ativa | Durante toda a vigência do contrato |
| Dados após cancelamento | 90 dias (para possibilitar reativação) |
| Logs de acesso e auditoria | 12 meses (obrigação legal — Marco Civil da Internet) |
| Documentos armazenados (S3) | 90 dias após cancelamento, depois exclusão permanente |
| Dados de cobrança | 5 anos (obrigação fiscal) |

Após os prazos acima, os dados são excluídos de forma segura e irreversível dos sistemas ativos e de backup.

---

## 6. Segurança

Adotamos as seguintes medidas técnicas e organizacionais para proteger seus dados:

- **Transmissão:** HTTPS/TLS 1.3 em todas as comunicações;
- **Senhas:** armazenadas como hash bcrypt (fator de custo 12), nunca em texto puro;
- **Autenticação:** tokens JWT com expiração curta + refresh token httpOnly;
- **Armazenamento de documentos:** AWS S3 com server-side encryption (AES-256), acesso via URLs pré-assinadas com expiração;
- **Acesso interno:** princípio do menor privilégio — colaboradores da VALINEXUS acessam apenas o necessário para sua função;
- **Backups:** realizados automaticamente pelo Railway e AWS;
- **Monitoramento:** logs de auditoria de todas as ações relevantes.

Nenhum sistema é 100% seguro. Em caso de incidente de segurança que afete seus dados, notificaremos o Cliente em até **72 horas** após a confirmação do incidente.

---

## 7. Direitos do titular

Nos termos da LGPD (art. 18), você tem direito a:

| Direito | Como exercer |
|---------|-------------|
| **Confirmação** de que tratamos seus dados | E-mail para `privacidade@valinexus.com.br` |
| **Acesso** aos seus dados | Solicitação por e-mail — resposta em até 15 dias |
| **Correção** de dados incorretos | Diretamente na Plataforma ou por e-mail |
| **Anonimização, bloqueio ou exclusão** de dados desnecessários | Solicitação por e-mail |
| **Portabilidade** dos dados | Exportação disponível na Plataforma ou por solicitação |
| **Eliminação** dos dados | Solicitação por e-mail (sujeito a obrigações legais de retenção) |
| **Informação** sobre compartilhamentos | Seção 4 desta Política |
| **Revogação do consentimento** (onde aplicável) | Solicitação por e-mail |
| **Oposição** a tratamento irregular | `privacidade@valinexus.com.br` |

Respondemos solicitações de direitos em até **15 (quinze) dias úteis**. Para solicitações complexas, podemos prorrogar por igual período com justificativa.

---

## 8. Cookies

A Plataforma utiliza apenas cookies estritamente necessários para funcionamento:

| Cookie | Função | Duração |
|--------|--------|---------|
| `refreshToken` | Manter sessão autenticada (httpOnly, Secure) | 7 dias |
| Preferências de UI | Salvar configurações de interface | 30 dias |

Não utilizamos cookies de rastreamento, analytics de terceiros ou pixels de publicidade.

---

## 9. Menores de idade

A Plataforma é destinada exclusivamente a pessoas jurídicas e seus representantes legais maiores de 18 anos. Não coletamos intencionalmente dados de menores de 18 anos.

---

## 10. Alterações nesta Política

Podemos atualizar esta Política periodicamente. Alterações substanciais serão comunicadas por e-mail com antecedência mínima de **15 dias**. O uso continuado da Plataforma após esse prazo implica aceite da nova versão.

O histórico de versões estará disponível em `valinexus.com.br/privacidade/historico`.

---

## 11. Contato e DPO

Para exercer seus direitos, tirar dúvidas ou registrar reclamações:

**Encarregado de Dados (DPO):** `privacidade@valinexus.com.br`  
**Suporte geral:** `suporte@valinexus.com.br`  
**Autoridade supervisora:** Agência Nacional de Proteção de Dados — `anpd.gov.br`

---

*Esta Política integra os Termos de Uso da VALINEXUS e deve ser lida em conjunto com eles.*
