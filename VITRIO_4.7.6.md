# Vitrio 4.7.6

## Correções
- Removidos os seletores Starter/Pro/Business da visão Master. A plataforma agora apresenta somente uma assinatura mensal.
- Criação de acessos do Master deixou de depender da Cloud Function `createStoreUser`.
- O novo usuário é criado em uma instância secundária do Firebase Auth, preservando a sessão do Master.
- O perfil do usuário é gravado pelo Master diretamente em `users/{uid}` e vinculado à loja selecionada.
- Em caso de falha ao gravar o perfil, a conta recém-criada no Authentication é removida para evitar usuário órfão.
- Mensagens de erro de criação de acesso ficaram mais específicas.
