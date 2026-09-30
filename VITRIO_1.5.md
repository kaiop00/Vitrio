# Vitrio 1.5

Pacote de consolidação do fluxo SaaS e experiência de operação.

## Fluxo de acesso
- Master/Admin não precisa possuir loja e entra diretamente em `/admin`.
- Lojista se cadastra uma única vez, criando usuário + loja, e entra em `/painel`.
- Login comum identifica o papel e direciona automaticamente.
- Loja suspensa, cancelada, inadimplente ou com trial vencido tem operação bloqueada.
- Página `Plano e assinatura` permanece acessível mesmo quando o painel está suspenso.

## Novidades
- Recuperação de senha por e-mail.
- Envio e tela de confirmação de e-mail (sem bloquear o MVP).
- Onboarding/Primeiros passos para o lojista.
- Checklist de configuração no dashboard.
- Central de avisos operacionais (pedidos, estoque, assinatura e identidade visual).
- Página Plano e assinatura.
- Dashboard Master com saúde da base e testes vencidos.
- Central de suporte segura: Master consulta a loja sem usar a senha do cliente.
- Auditoria global do Master.
- Controle de plano, status, bloqueio e data de trial via Callable Function com auditoria.
- Regras Firestore/Storage também consideram trial expirado.

## Segurança
- Mercado Pago continua temporariamente fora dos exports de Functions até a configuração dos secrets.
- Não há impersonação de usuário. A tela de suporte é leitura administrativa, evitando compartilhamento de senha.
- Recomenda-se App Check e rate limiting antes de produção pública.

## Deploy
O `firebase.json` agora também possui Firebase Hosting com fallback SPA para `index.html`.
Após validar localmente, o deploy completo poderá ser feito com `npm run deploy` (ou por etapas, se preferir).
