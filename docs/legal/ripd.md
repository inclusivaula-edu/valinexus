# RIPD — Relatório de Impacto à Proteção de Dados

**Relatório de Impacto à Proteção de Dados Pessoais — VALINEXUS**

**Versão:** 1.0  
**Data:** 19 de junho de 2026  
**Elaborado por:** VALINEXUS Tecnologia Ltda.  
**Encarregado (DPO):** `privacidade@valinexus.com.br`

> Este RIPD foi elaborado conforme art. 38 da LGPD (Lei nº 13.709/2018) e as diretrizes da ANPD.

---

## 1. Identificação da Operação de Tratamento

**Nome da operação:** Plataforma de Gestão de Certidões e Conformidade VALINEXUS

**Descrição resumida:** Sistema SaaS B2B que permite a empresas fornecedoras cadastrar, gerenciar e receber alertas automáticos sobre vencimento de certidões obrigatórias para manutenção de contratos com a Petrobras e outros contratantes.

**Controlador dos dados dos Usuários:** VALINEXUS Tecnologia Ltda.  
**Operadora dos dados inseridos pelos Clientes:** VALINEXUS Tecnologia Ltda.  
**Controlador dos dados inseridos:** O Cliente (empresa contratante)

---

## 2. Categorias de Dados Tratados

| Categoria | Dados específicos | Titulares | Quantidade estimada |
|-----------|-----------------|-----------|---------------------|
| Dados cadastrais de pessoas jurídicas | CNPJ, razão social, endereço, e-mail corporativo | Empresas clientes | < 500 (fase inicial) |
| Dados pessoais de usuários | Nome, e-mail corporativo, telefone, senha (hash) | Colaboradores dos clientes | < 2.000 (fase inicial) |
| Dados de certidões | Nome, datas, órgão emissor, número do documento | Não se aplica (dados da empresa, não pessoais) | Variável |
| Documentos digitais | PDFs de certidões (podem conter dados pessoais de sócios) | Sócios e representantes legais | Variável |
| Logs de acesso | IP, timestamp, user-agent | Usuários | 12 meses de histórico |

---

## 3. Finalidades do Tratamento

| Finalidade | Base legal (LGPD) | Necessidade e proporcionalidade |
|-----------|-------------------|--------------------------------|
| Prestação do serviço contratado | Execução de contrato (art. 7º, V) | Mínimo necessário para o serviço |
| Envio de alertas de vencimento | Execução de contrato (art. 7º, V) | E-mail e WhatsApp necessários para alertas |
| Autenticação e segurança | Execução de contrato / Legítimo interesse | Apenas dados mínimos de identificação |
| Logs de auditoria | Obrigação legal (Marco Civil) | 12 meses — prazo legal exato |
| Suporte técnico | Execução de contrato | Acesso pontual e controlado |
| Melhoria do produto (dados anonimizados) | Legítimo interesse | Dados agregados, sem identificação |

---

## 4. Avaliação de Necessidade e Proporcionalidade

4.1. **Minimização:** A Plataforma coleta apenas os dados estritamente necessários. Não são coletados dados de pagamento (processados pelo gateway), dados biométricos, dados de saúde ou dados sensíveis.

4.2. **Qualidade dos dados:** O Cliente é responsável pela exatidão dos dados inseridos. A Plataforma não valida certidões junto a órgãos emissores.

4.3. **Retenção:** Os prazos de retenção são proporcionais à finalidade (ver Política de Retenção de Dados). Dados são excluídos 90 dias após cancelamento, exceto onde há obrigação legal.

4.4. **Transferência internacional:** Ocorre para subprocessadores nos EUA (Railway) e França (Brevo). Mitigação: contratos com cláusulas de proteção adequadas.

---

## 5. Identificação e Avaliação de Riscos

### 5.1 Matriz de Riscos

| Risco | Probabilidade | Impacto | Nível | Salvaguarda |
|-------|--------------|---------|-------|-------------|
| Acesso não autorizado à conta de usuário | Média | Alto | Alto | bcrypt, JWT curto, rate limiting |
| Vazamento de documentos PDF | Baixa | Alto | Médio | S3 privado, URLs pré-assinadas com expiração |
| Dump de banco de dados | Muito baixa | Crítico | Alto | Railway gerenciado, acesso restrito, backups criptografados |
| Phishing de credenciais | Média | Médio | Médio | Educação do usuário, troca obrigatória de senha inicial |
| Falha no envio de alertas (WhatsApp/Email) | Média | Médio | Médio | Limitação de responsabilidade contratual, canal redundante (email + WhatsApp) |
| Acesso indevido por colaborador da VALINEXUS | Baixa | Alto | Médio | Menor privilégio, logs de auditoria, segregação de acesso |
| Indisponibilidade prolongada | Baixa | Médio | Baixo | SLA, backups, Railway HA |
| Compartilhamento indevido de credenciais por usuário | Alta | Médio | Médio | Termos de Uso, monitoramento de acessos simultâneos |

### 5.2 Riscos Residuais

Após aplicação das salvaguardas, os riscos residuais são considerados **aceitáveis para o porte e natureza do serviço**. Os maiores riscos residuais (dump de banco, acesso por colaborador) são mitigados por controles de acesso e monitoramento contínuos.

---

## 6. Medidas para Mitigar Riscos

| Medida | Status | Responsável |
|--------|--------|------------|
| HTTPS/TLS em toda comunicação | ✅ Implementado | Infraestrutura |
| Hash bcrypt para senhas | ✅ Implementado | Backend |
| JWT com expiração curta | ✅ Implementado | Backend |
| Rate limiting em endpoints sensíveis | ✅ Implementado | Backend |
| S3 privado com URL pré-assinada | ✅ Implementado | Backend |
| Tenant isolation no banco | ✅ Implementado | Backend |
| Logs de auditoria | ✅ Implementado | Backend |
| DPA com subprocessadores | ✅ Documentado | Jurídico |
| Política de resposta a incidentes | ✅ Documentada | Operações |
| Notificação de incidentes em 72h | ✅ Processo definido | Operações |
| Autenticação multifator (MFA) | ⬜ Roadmap | Produto |
| Penteste externo anual | ⬜ Roadmap | Segurança |

---

## 7. Consulta a Partes Interessadas

7.1. Este RIPD foi elaborado internamente pela equipe VALINEXUS.

7.2. Consulta prévia à ANPD: **não aplicável** neste momento — o tratamento não se enquadra, na fase atual, nas hipóteses de risco elevado que exigem consulta prévia obrigatória (art. 38, parágrafo único, LGPD).

7.3. Este RIPD será atualizado caso haja:
- Novo tratamento de dados sensíveis;
- Aumento significativo do volume de titulares;
- Novo serviço de tratamento automatizado para decisões individuais;
- Qualquer incidente de segurança significativo.

---

## 8. Conclusão

O tratamento de dados realizado pela Plataforma VALINEXUS é **proporcional, necessário e fundamentado em bases legais adequadas**. As salvaguardas implementadas são compatíveis com o porte da operação e com as melhores práticas de segurança disponíveis para SaaS na fase atual do produto.

**Próxima revisão:** julho de 2027 (ou antes, se houver mudança relevante no tratamento).

---

*Documento elaborado pela VALINEXUS Tecnologia Ltda. — `privacidade@valinexus.com.br`*
