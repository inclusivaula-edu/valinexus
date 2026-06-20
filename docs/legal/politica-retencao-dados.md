# Política de Retenção e Exclusão de Dados — VALINEXUS

**Versão:** 1.0  
**Data de vigência:** 01 de julho de 2026

---

## 1. Objetivo

Esta Política define por quanto tempo a VALINEXUS mantém cada categoria de dado, os procedimentos de exclusão segura e os direitos dos titulares e Clientes em relação à retenção.

---

## 2. Tabela de Retenção

| Categoria de dado | Período de retenção | Fundamento | O que ocorre após |
|-------------------|---------------------|-----------|-------------------|
| Dados de conta (nome, e-mail, telefone) | Enquanto conta ativa + 90 dias | Execução de contrato | Exclusão definitiva |
| Senha (hash bcrypt) | Enquanto conta ativa | Execução de contrato | Exclusão imediata no cancelamento |
| Dados cadastrais da empresa (CNPJ, razão social) | Enquanto conta ativa + 90 dias | Execução de contrato | Exclusão definitiva |
| Certidões cadastradas (metadados) | Enquanto conta ativa + 90 dias | Execução de contrato | Exclusão definitiva |
| Documentos armazenados (S3) | Enquanto conta ativa + 90 dias | Execução de contrato | Exclusão permanente do S3 |
| Logs de acesso e auditoria | 12 meses | Obrigação legal (Marco Civil da Internet, art. 15) | Exclusão definitiva |
| Registros de alertas enviados | 12 meses | Legítimo interesse (suporte, auditoria) | Exclusão definitiva |
| Dados de cobrança (valor, plano, datas) | 5 anos | Obrigação fiscal (Lei 9.430/96) | Exclusão definitiva |
| Conteúdo de suporte (e-mails, chamados) | 2 anos | Legítimo interesse (defesa em processo) | Exclusão definitiva |
| Backups do banco de dados | 7 dias (rolling) | Continuidade operacional | Sobrescrita automática |

---

## 3. Ciclo de Vida dos Dados do Cliente

```
Ativação → Uso ativo → Cancelamento/Encerramento → Período de graça (90 dias) → Exclusão definitiva
```

### 3.1 Conta ativa

Todos os dados são mantidos e processados conforme necessário para o serviço.

### 3.2 Suspensão por inadimplência

Os dados são preservados durante a suspensão (até 90 dias). A regularização do pagamento restaura o acesso integral. Após 90 dias de inadimplência, aplica-se o mesmo processo de cancelamento.

### 3.3 Cancelamento

Após confirmação do cancelamento:

**Dias 1–30 (período de acesso ativo):**
- Acesso à Plataforma mantido
- Exportação de dados disponível
- Novos dados podem ser inseridos

**Dias 31–90 (período de graça):**
- Acesso suspenso
- Dados preservados
- Reativação possível mediante pagamento

**Após 90 dias:**
- Exclusão definitiva e irreversível de todos os dados da aplicação
- Documentos removidos do S3
- Usuários desativados e removidos
- Logs mantidos conforme obrigação legal (até 12 meses da data de criação)

### 3.4 Comunicações de lembrança

A VALINEXUS enviará e-mail automático nos seguintes momentos:
- No dia da confirmação do cancelamento
- 7 dias antes do fim do período de acesso ativo
- 15 dias antes da exclusão definitiva
- 7 dias antes da exclusão definitiva

---

## 4. Procedimento de Exclusão Segura

4.1. **Banco de dados:** exclusão lógica seguida de exclusão física nos backups após o prazo de retenção do backup (7 dias rolling).

4.2. **Documentos (S3):** chamada à API `DeleteObject` do AWS S3. Dados deletados do S3 são irrecuperáveis após a janela de versionamento (90 dias).

4.3. **Logs:** expiração automática após 12 meses, após a qual são deletados permanentemente.

4.4. **Backups:** sobrescritos automaticamente a cada 24h (modelo rolling de 7 dias). Após 7 dias do cancelamento, os dados do Cliente deixam de existir em qualquer backup.

4.5. **Certificado de exclusão:** disponível sob solicitação em até 10 dias úteis após a exclusão definitiva. Enviar pedido para `privacidade@valinexus.com.br`.

---

## 5. Exportação de Dados (Portabilidade)

Antes da exclusão, o Cliente pode exportar seus dados:

| Tipo de dado | Formato | Como exportar |
|-------------|---------|--------------|
| Certidões (metadados) | CSV ou JSON | Painel → Configurações → Exportar dados |
| Documentos (PDFs) | ZIP com todos os arquivos | Painel → Configurações → Exportar documentos |
| Lista de usuários | CSV | Painel → Usuários → Exportar |
| Histórico de alertas | CSV | Painel → Relatórios → Exportar |

Para volumes muito grandes ou formatos específicos, solicitar via `suporte@valinexus.com.br`.

---

## 6. Solicitações de Exclusão Antecipada

6.1. O titular de dados pessoais pode solicitar a exclusão de seus dados a qualquer momento, conforme art. 18, VI da LGPD, enviando e-mail para `privacidade@valinexus.com.br`.

6.2. A exclusão de dados de um Usuário específico (sem cancelar a conta do Cliente) é possível e será processada em até **15 dias úteis**.

6.3. A exclusão não abrange dados que devam ser mantidos por obrigação legal (logs por 12 meses, dados fiscais por 5 anos).

6.4. O Cliente-controlador pode solicitar a exclusão de todos os dados de sua empresa a qualquer momento, sem aguardar o término do contrato. Nesse caso, o acesso é encerrado imediatamente.

---

## 7. Revisão

Esta Política é revisada anualmente ou sempre que houver mudança relevante nos sistemas ou na legislação aplicável.

**Contato:** `privacidade@valinexus.com.br`
