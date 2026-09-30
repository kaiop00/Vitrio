# Vitrio 2.5 — Polimento pré-testes

## Alterações
- Loading/skeleton real na vitrine, pedidos e gates de autenticação/acesso.
- Estado de loja indisponível/erro de conexão com ação para tentar novamente.
- Lock síncrono no checkout para impedir duplo envio mesmo em cliques muito rápidos.
- Bloqueio por pedido durante alteração de status, confirmação em dinheiro e cancelamento.
- Feedback por toast para status e erros operacionais.
- Mensagens de checkout mais amigáveis para rede, estoque, cupom e excesso de tentativas.
- Melhorias mobile em pedidos, filtros, checkout, modais e toasts.
- Skeleton respeita preferência de redução de movimento.

## Escopo
Esta versão evita módulos grandes novos e prepara a base para a bateria completa de testes. Mercado Pago continua preservado conforme a estratégia anterior.
