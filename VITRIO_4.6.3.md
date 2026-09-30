# Vitrio 4.6.3

- Corrigida a Central de Suporte do Master.
- O painel administrativo passa a buscar chamados por Cloud Function com Firebase Admin, sem depender da leitura direta das regras do Firestore.
- Adicionadas as funções `adminListSupportTickets` e `adminAnswerSupportTicket`.
- Chamados agora mostram loja, lojista, e-mail, prioridade, data e status.
- Respostas e resolução passam por backend com validação de perfil Master e registro de auditoria.
- Botão Atualizar e mensagens de erro/sucesso adicionados à Central de Suporte.
