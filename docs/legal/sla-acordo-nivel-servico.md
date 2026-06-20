# SLA — Acordo de Nível de Serviço

**Service Level Agreement — VALINEXUS**

**Versão:** 1.0  
**Data de vigência:** 01 de julho de 2026

---

## 1. Objetivo

Este SLA define os níveis mínimos de disponibilidade e desempenho da Plataforma VALINEXUS, os procedimentos de resposta a incidentes e as compensações aplicáveis em caso de descumprimento.

---

## 2. Definições

**"Disponibilidade"** — percentual do tempo em que a Plataforma está acessível e funcionando corretamente em um mês calendário.

**"Indisponibilidade"** — período em que a Plataforma está inacessível ou com falha que impeça o uso das funcionalidades principais (login, visualização de certidões, upload de documentos).

**"Manutenção Programada"** — indisponibilidade previamente comunicada ao Cliente com mínimo de **24 horas de antecedência**.

**"Incidente"** — qualquer evento que cause ou possa causar Indisponibilidade ou degradação relevante de desempenho.

**"Tempo de Resposta"** — intervalo entre a abertura do chamado pelo Cliente e o primeiro contato da equipe VALINEXUS.

**"Tempo de Resolução"** — intervalo entre a abertura do chamado e a restauração do serviço ou solução definitiva.

---

## 3. Disponibilidade Garantida

| Plano | Disponibilidade mensal garantida | Equivale a downtime máximo/mês |
|-------|----------------------------------|-------------------------------|
| Starter | 99,0% | ~7,2 horas |
| Professional | 99,5% | ~3,6 horas |
| Enterprise | 99,7% | ~2,2 horas |

### 3.1 Cálculo da disponibilidade

```
Disponibilidade (%) = ((minutos no mês - minutos de indisponibilidade) / minutos no mês) × 100
```

A Manutenção Programada **não é contabilizada** como Indisponibilidade para fins de cálculo do SLA.

### 3.2 Janela de Manutenção Programada

- Horário preferencial: **terças e quintas-feiras, das 22h às 02h (horário de Brasília)**
- Duração máxima por evento: 2 horas
- Comunicação mínima: 24 horas antes, por e-mail e aviso na Plataforma
- Máximo de 2 manutenções programadas por mês

---

## 4. Classificação de Incidentes

### Severidade 1 — Crítica

**Definição:** Plataforma completamente inacessível para todos os usuários, ou falha que impede login de qualquer usuário.

**Exemplos:** API fora do ar, banco de dados inacessível, certificado SSL expirado.

| Plano | Tempo de resposta | Tempo de resolução alvo |
|-------|------------------|------------------------|
| Starter | 4 horas úteis | 24 horas |
| Professional | 2 horas (7×24) | 8 horas |
| Enterprise | 1 hora (7×24) | 4 horas |

### Severidade 2 — Alta

**Definição:** Funcionalidade principal degradada ou indisponível para parte dos usuários (ex: uploads falham, alertas não estão sendo enviados).

| Plano | Tempo de resposta | Tempo de resolução alvo |
|-------|------------------|------------------------|
| Starter | 8 horas úteis | 48 horas |
| Professional | 4 horas úteis | 16 horas |
| Enterprise | 2 horas (7×24) | 8 horas |

### Severidade 3 — Média

**Definição:** Funcionalidade secundária com problema, desempenho degradado, ou bug que tem contorno disponível.

| Plano | Tempo de resposta | Tempo de resolução alvo |
|-------|------------------|------------------------|
| Todos | 1 dia útil | Próxima versão planejada |

### Severidade 4 — Baixa

**Definição:** Problemas cosméticos, melhorias sugeridas, dúvidas de uso.

| Plano | Tempo de resposta | Tempo de resolução alvo |
|-------|------------------|------------------------|
| Todos | 2 dias úteis | Backlog priorizado |

**Horário útil:** segunda a sexta, 08h às 18h (horário de Brasília), exceto feriados nacionais e do Amapá.

---

## 5. Canais de Suporte

| Canal | Plano | Horário |
|-------|-------|---------|
| E-mail `suporte@valinexus.com.br` | Todos | Úteis 08h–18h |
| WhatsApp dedicado | Professional e Enterprise | Úteis 08h–18h |
| Telefone de emergência | Enterprise | 7×24 para Sev. 1 |

Para abertura de chamados, sempre inclua:
- Descrição do problema
- Plano contratado
- Usuário(s) afetado(s)
- Prints ou logs de erro (quando disponível)
- Horário em que o problema foi identificado

---

## 6. Compensações por Descumprimento do SLA

Quando a disponibilidade mensal ficar abaixo do garantido, o Cliente tem direito a crédito de serviço aplicado na próxima fatura:

| Disponibilidade real (mês) | Crédito |
|---------------------------|---------|
| 98,0% – abaixo do garantido | 10% da mensalidade |
| 95,0% – 97,9% | 25% da mensalidade |
| 90,0% – 94,9% | 50% da mensalidade |
| Abaixo de 90,0% | 100% da mensalidade |

### 6.1 Como solicitar o crédito

O Cliente deve abrir chamado em até **15 dias após o fim do mês** com evidências da indisponibilidade. A VALINEXUS analisará e aplicará o crédito na fatura seguinte em até 10 dias úteis.

### 6.2 Limitações

Os créditos são a **única compensação** por descumprimento deste SLA e não substituem as limitações de responsabilidade previstas nos Termos de Uso. O crédito máximo em um mês é de 100% da mensalidade daquele mês.

---

## 7. Exclusões — O SLA não se aplica a

a) Indisponibilidades causadas pelo próprio Cliente (configuração incorreta, uso indevido, sobrecarga deliberada);  
b) Manutenção Programada comunicada com antecedência;  
c) Falhas de provedores de internet ou dispositivos do Cliente;  
d) Indisponibilidade de APIs de terceiros (WhatsApp Business, provedores de e-mail) — esses serviços têm seus próprios SLAs;  
e) Casos fortuitos e força maior (desastres naturais, guerras, falhas generalizadas de infraestrutura de internet);  
f) Períodos de indisponibilidade não reportados ao suporte durante o mês de referência;  
g) Clientes com faturas em atraso.

---

## 8. Monitoramento e Transparência

8.1. A VALINEXUS mantém uma página pública de status em `status.valinexus.com.br` com:
- Uptime em tempo real de cada componente;
- Histórico de incidentes dos últimos 90 dias;
- Notificações de manutenção programada.

8.2. Relatório mensal de disponibilidade disponível sob solicitação para planos Professional e Enterprise.

---

## 9. Revisão do SLA

Este SLA pode ser atualizado com aviso prévio de **30 dias**. Alterações que reduzam os níveis de serviço garantidos podem ser recusadas pelo Cliente, que poderá rescindir o contrato sem multa dentro do prazo de notificação.

---

*Este SLA integra o Contrato de Prestação de Serviços e os Termos de Uso da VALINEXUS.*
