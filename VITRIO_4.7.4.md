# Vitrio 4.7.4

Correção focada na criação de acessos pelo Master.

- Separadas as etapas de criação no Firebase Authentication, gravação do perfil em `users` e auditoria.
- Falha de auditoria não desfaz mais um usuário criado corretamente.
- Se a gravação do perfil falhar, somente então a conta recém-criada no Auth é removida para evitar usuário órfão.
- Erros agora indicam em qual etapa ocorreu a falha: criação da conta, vínculo com a loja ou finalização.
- Mantidos tratamentos para e-mail inválido, senha inválida, permissão e loja não localizada.
