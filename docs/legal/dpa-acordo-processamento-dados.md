# DPA — Acordo de Processamento de Dados

**Data Processing Agreement — VALINEXUS**

**Versão:** 1.0  
**Data de vigência:** 01 de julho de 2026

---

## Partes

**CONTROLADOR:** Cliente identificado no Contrato de Prestação de Serviços ou no cadastro da Plataforma VALINEXUS (doravante "Controlador").

**OPERADORA:** VALINEXUS Tecnologia Ltda., operadora da Plataforma (doravante "Operadora" ou "VALINEXUS").

Este Acordo de Processamento de Dados ("DPA") complementa os Termos de Uso e o Contrato de Prestação de Serviços celebrado entre as partes, regulando especificamente o tratamento de dados pessoais realizado pela Operadora em nome do Controlador, conforme exigido pelo art. 39 da LGPD (Lei nº 13.709/2018).

---

## 1. Definições

**"Dados Pessoais"** — qualquer informação relacionada a pessoa natural identificada ou identificável, nos termos do art. 5º, I da LGPD.

**"Tratamento"** — toda operação realizada com dados pessoais (coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação, controle, modificação, comunicação, transferência, difusão ou extração).

**"Incidente de Segurança"** — acesso não autorizado, destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito de dados pessoais.

**"Suboperador"** — terceiro contratado pela Operadora para realizar parte do Tratamento em nome do Controlador.

---

## 2. Objeto e Escopo do Tratamento

2.1. A Operadora realiza o Tratamento de Dados Pessoais exclusivamente para prover os serviços contratados pelo Controlador, conforme descrito abaixo:

| Categoria de dados | Operações | Finalidade |
|-------------------|-----------|-----------|
| Nome, e-mail e telefone de Usuários | Armazenamento, acesso, transmissão | Autenticação e envio de alertas |
| Documentos de certidões (PDFs) | Armazenamento, acesso, exibição | Gestão documental do Controlador |
| Logs de acesso e auditoria | Coleta, armazenamento | Segurança e suporte |
| Dados cadastrais da empresa | Armazenamento, exibição | Identificação do Controlador |

2.2. A Operadora **não realiza** Tratamento de Dados Pessoais para fins próprios, comercialização, publicidade ou qualquer finalidade além das instruções do Controlador.

---

## 3. Instruções do Controlador

3.1. A Operadora trata os Dados Pessoais **somente conforme as instruções documentadas** do Controlador, que consistem em:

a) As configurações e funcionalidades da Plataforma utilizadas pelo Controlador;  
b) As disposições deste DPA e dos Termos de Uso;  
c) Instruções específicas comunicadas por escrito pelo Controlador.

3.2. Se a Operadora entender que uma instrução viola a LGPD ou outra legislação aplicável, informará o Controlador imediatamente, podendo suspender a execução da instrução até esclarecimento.

3.3. O Controlador é responsável por garantir que possui base legal adequada para o Tratamento dos dados que insere na Plataforma, nos termos do art. 7º da LGPD.

---

## 4. Obrigações da Operadora

A Operadora se compromete a:

a) Tratar os dados apenas para as finalidades e nos termos estabelecidos neste DPA;  
b) Garantir que os colaboradores que acessam os dados estejam sujeitos a obrigações de confidencialidade;  
c) Implementar e manter as medidas técnicas e organizacionais de segurança descritas na Cláusula 6;  
d) Notificar o Controlador em até **72 horas** após tomar conhecimento de Incidente de Segurança que possa afetar os dados do Controlador;  
e) Auxiliar o Controlador no atendimento de solicitações de titulares de dados, na medida do tecnicamente possível;  
f) Após o término do contrato, excluir ou devolver os dados conforme instrução do Controlador, no prazo máximo de 90 dias;  
g) Disponibilizar ao Controlador as informações necessárias para demonstrar o cumprimento das obrigações previstas neste DPA.

---

## 5. Suboperadores

5.1. O Controlador autoriza expressamente a Operadora a contratar os seguintes Suboperadores para fins de prestação dos serviços:

| Suboperador | Serviço | País | Política de privacidade |
|-------------|---------|------|------------------------|
| Amazon Web Services | Armazenamento de arquivos (S3) | Brasil (sa-east-1) | aws.amazon.com/privacy |
| Railway | Hospedagem e banco de dados | EUA | railway.app/legal/privacy |
| Evolution API | Envio de mensagens WhatsApp | Variável | — |
| Brevo | Envio de e-mails transacionais | França | brevo.com/legal/privacypolicy |

5.2. A Operadora garante que os contratos com Suboperadores impõem obrigações de proteção de dados equivalentes às deste DPA.

5.3. A Operadora notificará o Controlador com **15 dias de antecedência** sobre qualquer alteração nos Suboperadores listados. O Controlador pode se opor à alteração; caso a oposição inviabilize a prestação do serviço, as partes poderão rescindir o contrato sem multa.

5.4. Para transferências internacionais de dados (Railway — EUA; Brevo — França), a Operadora adota cláusulas contratuais padrão ou verifica adequação do país receptor conforme art. 33 da LGPD.

---

## 6. Medidas de Segurança

A Operadora mantém as seguintes medidas técnicas e organizacionais:

**Técnicas:**
- Transmissão criptografada via HTTPS/TLS 1.3;
- Senhas armazenadas como hash bcrypt (custo 12);
- Autenticação por JWT com expiração curta e refresh token httpOnly;
- Armazenamento de documentos no S3 com AES-256 server-side encryption;
- Acesso a arquivos exclusivamente via URL pré-assinada com expiração de 1 hora;
- Isolamento de dados por empresa (tenant isolation) a nível de banco de dados;
- Backups automáticos diários com retenção de 7 dias.

**Organizacionais:**
- Princípio do menor privilégio no acesso interno;
- Logs de auditoria de todas as ações sobre dados;
- Política de resposta a incidentes documentada;
- Avaliação de fornecedores terceiros quanto à segurança.

---

## 7. Notificação de Incidentes

7.1. Em caso de Incidente de Segurança confirmado, a Operadora notificará o Controlador por e-mail em até **72 horas**, incluindo:

a) Descrição do incidente;  
b) Categorias e volume aproximado de dados afetados;  
c) Prováveis consequências;  
d) Medidas tomadas ou planejadas para mitigação.

7.2. O Controlador é responsável por notificar a ANPD e os titulares afetados, quando exigido pela LGPD, com base nas informações fornecidas pela Operadora.

---

## 8. Auxílio ao Controlador

8.1. A Operadora auxiliará o Controlador no atendimento das obrigações abaixo, na medida tecnicamente possível e mediante solicitação formal:

a) Resposta a solicitações de titulares (acesso, correção, exclusão, portabilidade);  
b) Realização de avaliações de impacto à proteção de dados (RIPD);  
c) Consultas prévia à ANPD.

8.2. O auxílio previsto nesta cláusula pode estar sujeito a cobrança adicional caso exija trabalho técnico significativo, a ser acordado previamente entre as partes.

---

## 9. Auditoria

9.1. O Controlador pode, mediante aviso prévio de **30 dias** e no máximo **uma vez por ano**, solicitar:

a) Documentação das medidas de segurança adotadas;  
b) Confirmação por escrito do cumprimento deste DPA;  
c) Relatórios de auditoria de segurança realizados por terceiros (quando disponíveis).

9.2. Auditorias in loco nas instalações da Operadora estão sujeitas a acordo prévio e podem ser substituídas por questionários de segurança detalhados.

---

## 10. Exclusão de Dados

10.1. Após o término do contrato, a Operadora:

a) Disponibilizará os dados para exportação pelo Controlador por **30 dias**;  
b) Excluirá definitivamente os dados após esse prazo, salvo instrução contrária do Controlador ou obrigação legal de retenção;  
c) Emitirá certificado de exclusão mediante solicitação.

10.2. Logs de auditoria serão mantidos por 12 meses conforme obrigação legal (Marco Civil da Internet), após o que serão excluídos.

---

## 11. Vigência e Rescisão

11.1. Este DPA entra em vigor na data de assinatura do Contrato de Prestação de Serviços e permanece válido enquanto a Operadora realizar Tratamento de dados em nome do Controlador.

11.2. As obrigações de confidencialidade e segurança sobrevivem à rescisão deste DPA pelo período necessário ao cumprimento de obrigações legais ou até a exclusão definitiva dos dados, o que ocorrer por último.

---

## 12. Legislação Aplicável e Foro

Este DPA é regido pela legislação brasileira, em especial a LGPD (Lei nº 13.709/2018). Fica eleito o foro da Comarca de Macapá, Estado do Amapá.

---

*Este DPA complementa os Termos de Uso da VALINEXUS e deve ser interpretado em conjunto com eles.*
