# Vitrio 2.6

Correções de validação em ambiente real.

## Master — situação da loja
- O Master continua usando `adminUpdateStoreAccess` para manter auditoria.
- Se a Function ainda não estiver publicada ou estiver desatualizada, o painel faz fallback seguro para atualização direta no Firestore.
- O fallback só funciona para usuário Master porque as regras do Firestore exigem `role=admin` e `active=true`.
- Rótulos foram esclarecidos: Em teste, Ativa, Pagamento pendente, Bloqueada e Cancelada.
- Erros deixam de falhar silenciosamente e passam a aparecer em toast.

## E-mails do Firebase Auth
- Idioma padrão do Firebase Auth definido como `pt-BR`.
- Confirmação de e-mail e recuperação de senha reforçam `pt-BR` antes do envio.
- Os templates padrão do Firebase passam a usar a versão localizada em português quando suportada.

## Campos no tema escuro
- Campos administrativos, login, cadastro e telas de acesso agora usam fundo escuro, texto claro e caret visível.
- Placeholder recebeu contraste adequado.
- Estados hover/focus foram padronizados.
- Controles de data/select usam `color-scheme: dark`.
- A vitrine pública e os modais claros não foram forçados para o tema escuro.
