# Vitrio 1.4 — fluxo SaaS

## Fluxo definitivo
- Master/Admin: conta de controle da plataforma, sem loja obrigatória. Login direciona para `/admin`.
- Lojista: `/cadastro` cria usuário + loja + vínculo + trial em uma etapa e entra em `/painel`.
- Login único: identifica a role e direciona automaticamente ao painel correto.
- Assinatura: o Master controla `trial`, `active`, `past_due`, `suspended` e `cancelled`.
- Bloqueio: loja suspensa/inadimplente/cancelada perde acesso ao painel; regras do Firestore/Storage também restringem operações.

## Melhorias desta versão
- Redirecionamento de login por role sem passar pela homepage.
- Perfil do usuário acompanhado em tempo real.
- Gate de assinatura/loja para lojistas.
- Tela amigável de acesso suspenso ou trial encerrado.
- Admin dashboard explicando e refletindo o fluxo SaaS.
- Gestão de clientes/lojas com busca, filtro, plano, assinatura, trial e bloqueio.
- Cadastro novo salva `ownerId` e `ownerEmail` na loja.
- Firestore/Storage reforçados para impedir operações de lojas suspensas.

## Observação de deploy
O projeto-base 1.3 tinha Mercado Pago temporariamente fora do deploy. Preserve essa decisão até configurar secrets válidos e reativar as exports de pagamento.
