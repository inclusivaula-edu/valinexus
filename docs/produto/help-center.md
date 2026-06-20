# Help Center — VALINEXUS

**Base de conhecimento — perguntas e respostas mais comuns**

---

## Conta e Acesso

**Esqueci minha senha. Como recupero?**  
Na tela de login, clique em "Esqueci minha senha" e informe seu e-mail. Você receberá um link de redefinição válido por 1 hora. Se não receber em 5 minutos, verifique a pasta de spam ou entre em contato com `suporte@valinexus.com.br`.

**Não consigo fazer login. O que fazer?**  
Verifique se está usando o e-mail correto (pode ser diferente do seu e-mail pessoal). Se recebeu uma senha temporária e ela não funciona, pode ter expirado — solicite nova senha em `suporte@valinexus.com.br`.

**Como altero minha senha?**  
Menu → seu nome (canto superior direito) → **Meu perfil** → **Alterar senha**. A nova senha precisa ter no mínimo 8 caracteres, com letras e números.

**Como adiciono um novo usuário?**  
Apenas usuários com role **COMPANY_ADMIN** podem convidar outros. Acesse **Usuários** → **+ Convidar usuário**, informe o e-mail e selecione o role. O usuário receberá um e-mail com a senha temporária.

**Qual a diferença entre os roles de usuário?**  
- **COMPANY_ADMIN:** acesso total — pode criar, editar e excluir certidões e gerenciar usuários
- **COMPANY_USER:** pode cadastrar e editar certidões, mas não gerencia usuários
- **VIEWER:** só visualização — não faz alterações

---

## Certidões

**Como cadastro uma nova certidão?**  
Menu → **Certidões** → **+ Nova Certidão**. Preencha nome, categoria, órgão emissor, datas de emissão e vencimento. O upload do documento é opcional mas recomendado.

**A certidão está mostrando status "Vencida" mas eu acabei de renovar. O que faço?**  
Você precisa atualizar a certidão com a nova data de vencimento e fazer o upload do novo documento. Acesse a certidão → **Editar** → atualize os campos e salve. O sistema não busca informações automaticamente nos órgãos emissores.

**O que significa cada status de certidão?**  
- **Válida:** vencimento em mais de 30 dias
- **Vencendo em breve:** vence em 30 dias ou menos
- **Vencida:** passou da data de vencimento
- **Aguardando upload:** certidão cadastrada sem documento anexado
- **Em revisão:** marcada para análise interna

**Posso cadastrar uma certidão sem data de vencimento?**  
Não — a data de vencimento é obrigatória pois é ela que aciona os alertas. Se a certidão não tem validade definida, consulte o documento para encontrar a data ou entre em contato com o órgão emissor.

**Qual o tamanho máximo de arquivo para upload?**  
10 MB por arquivo. Formatos aceitos: PDF, JPG, PNG, JPEG. Para arquivos maiores, comprima o PDF antes do upload (ferramentas gratuitas como smallpdf.com ou ilovepdf.com).

**Como faço para excluir uma certidão?**  
Apenas COMPANY_ADMIN pode excluir. Acesse a certidão → menu de ações (três pontos) → **Excluir**. A exclusão é permanente — o documento armazenado também é excluído.

**Consigo exportar minha lista de certidões?**  
Sim. Menu → **Certidões** → **Exportar** → escolha o formato (CSV ou Excel). O export inclui todos os metadados mas não os arquivos PDF — para exportar os documentos, acesse Configurações → Exportar documentos.

---

## Alertas e Notificações

**Por que não estou recebendo alertas no WhatsApp?**  
Verifique:
1. O número de WhatsApp no seu perfil está correto (com DDD, sem espaços)?
2. O WhatsApp nesse número está ativo?
3. As notificações estão habilitadas em Configurações → Notificações?
4. Você não bloqueou o número remetente?

Se tudo estiver correto e ainda não receber, contate o suporte.

**Os alertas chegam em que horário?**  
O sistema processa os alertas diariamente às **08h00 (horário de Brasília)**. Se uma certidão atingir o prazo de alerta naquele dia, a mensagem é enviada pela manhã.

**Recebi um alerta de certidão que já renovei. Por que?**  
Porque a data de vencimento na Plataforma ainda não foi atualizada. Edite a certidão com a nova data e o novo documento — o sistema vai recalcular o status automaticamente.

**Posso configurar alertas para uma equipe inteira?**  
Sim. Cada usuário tem seu próprio WhatsApp e e-mail configurados no perfil. Todos os usuários ativos com alertas habilitados recebem as notificações. Para receber alertas, o usuário precisa ter role COMPANY_ADMIN ou COMPANY_USER.

**É possível desativar alertas para certidões específicas?**  
Ainda não — todos os alertas seguem a mesma regra (30, 15 e 7 dias). Essa funcionalidade está no roadmap.

---

## Score de Conformidade

**Como é calculado o score de conformidade?**  
Score = (número de certidões válidas ÷ total de certidões) × 100. Certidões com status "Aguardando upload" são contadas como não-válidas para fins do score.

**Qual score devo buscar?**  
Mínimo recomendado: **90%**. Para empresas no CRC Petrobras, o ideal é **100%** — qualquer certidão vencida pode resultar em suspensão do cadastro.

**O score aparece para o cliente Petrobras?**  
Não — o score é interno, para gestão da sua empresa. A Petrobras faz sua própria verificação documental.

---

## Plano e Cobrança

**Como faço upgrade de plano?**  
Configurações → **Assinatura** → **Mudar plano**. O upgrade tem efeito imediato e a diferença de valor é cobrada proporcionalmente no próximo ciclo.

**Como cancelo minha assinatura?**  
Configurações → **Assinatura** → **Cancelar assinatura**, ou envie e-mail para `suporte@valinexus.com.br`. O cancelamento requer aviso prévio de 30 dias.

**Meus dados são excluídos imediatamente após o cancelamento?**  
Não. Após o cancelamento, você tem 90 dias para exportar seus dados. A exclusão definitiva só ocorre após esse prazo.

---

## Técnico

**O sistema funciona no celular?**  
Sim, a Plataforma é responsiva e funciona em navegadores mobile (Chrome, Safari). Um aplicativo dedicado está no roadmap.

**Quais navegadores são suportados?**  
Chrome 90+, Firefox 88+, Edge 90+, Safari 14+. Internet Explorer não é suportado.

**Tive um erro e não sei o que fazer.**  
Anote o horário exato do erro, o que você estava fazendo e se possível faça um print da tela de erro. Envie para `suporte@valinexus.com.br` com essas informações — isso acelera muito o diagnóstico.

---

## Contato

**Suporte técnico:** `suporte@valinexus.com.br`  
**Dúvidas sobre privacidade:** `privacidade@valinexus.com.br`  
**Questões comerciais/contratos:** `contratos@valinexus.com.br`  
**Horário de atendimento:** segunda a sexta, 08h às 18h (horário de Brasília)
