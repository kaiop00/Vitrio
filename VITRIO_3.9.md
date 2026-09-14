# Vitrio 3.9

Automação completa das vendas pelo WhatsApp:

- Ao clicar em `Finalizar pelo WhatsApp`, o pedido é criado primeiro no backend.
- O backend valida os produtos, variações, adicionais, estoque, cupom e entrega.
- O estoque do produto e da variação é baixado na mesma transação do pedido.
- É criada movimentação em `inventoryMovements`.
- O pedido do WhatsApp nasce como venda confirmada/paga para entrar nos indicadores e relatórios.
- O valor é somado ao `totalSpent` do cliente.
- Se existir caixa aberto, é criada automaticamente uma entrada em `cashMovements`.
- A movimentação financeira fica vinculada ao `orderId` para evitar duplicidade.
- A origem do pedido fica registrada como `whatsapp_checkout`.
- Depois de toda a atualização interna, o sistema abre o WhatsApp da loja com o pedido formatado.
- Mercado Pago permanece separado e não foi alterado nesta versão.

Observação de regra comercial:
Nesta versão, finalizar pelo WhatsApp é tratado como confirmação da venda. Portanto estoque, relatórios e caixa são atualizados imediatamente, conforme solicitado.
