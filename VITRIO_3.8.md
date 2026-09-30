# Vitrio 3.8

Correções e melhorias do carrinho:

- O ícone da sacola agora mostra um badge roxo com a quantidade real de itens.
- O badge só aparece quando houver produto no carrinho.
- O carrinho recebeu melhor organização visual e ação de finalização fixa no rodapé.
- Ao escolher `Dinheiro`, aparece o campo `Troco para quanto?`.
- O valor do troco segue na mensagem enviada à loja.
- O número de WhatsApp da loja é normalizado automaticamente:
  - números brasileiros com DDD recebem o prefixo `55`;
  - o link utiliza `https://wa.me/`, mais compatível com Safari, WhatsApp Desktop e WhatsApp Web.
- Antes de abrir o WhatsApp, o pedido é registrado pelo backend do Vitrio.
- Assim, o pedido aparece no painel e o estoque é baixado pelo fluxo seguro do backend.
- A mensagem do WhatsApp leva número do pedido, produtos, tamanho, cor/adicionais, subtotal, entrega, total, forma de pagamento, troco, recebimento, cliente e observações.
