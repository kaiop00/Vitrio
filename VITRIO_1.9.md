# Vitrio 1.9

## Novidades
- Acompanhamento público de pedido em `/acompanhar/:orderId`, protegido pelo telefone usado na compra.
- Timeline visual do pedido: confirmado, preparação, pronto, entrega e concluído.
- Botão "Acompanhar meu pedido" após pedidos criados pelo checkout do Vitrio.
- Contato rápido com a loja na tela de acompanhamento.
- Meta mensal de vendas configurável em Minha loja.
- Progresso da meta mensal diretamente no dashboard do lojista.
- Interface adicional responsiva e alinhada ao padrão clean das versões 1.6–1.8.

## Backend
Nova callable Function `getPublicOrderTracking`. Ela não expõe a coleção de pedidos publicamente: valida o ID do pedido e os últimos dígitos do telefone antes de retornar somente os campos necessários ao acompanhamento.

## Observação
Mercado Pago continua temporariamente fora do bloco de exports/deploy conforme a estratégia adotada nas versões anteriores.
