# Vitrio 4.2

Correção no fechamento do pedido:

- Depois que o pedido é registrado com sucesso no backend, a sacola é limpa imediatamente.
- A cópia do carrinho salva no `localStorage` também é removida.
- Ao voltar do WhatsApp para a vitrine, o carrinho continua vazio.
- Cupom, troco e seleções temporárias também são zerados para iniciar um novo pedido.
- A limpeza só acontece depois que `createOrder` confirma o pedido; se houver erro, os itens permanecem no carrinho.
