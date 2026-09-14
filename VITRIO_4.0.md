# Vitrio 4.0

Correções no fechamento pelo WhatsApp:

- O campo **Troco para quanto?** foi movido para o resumo financeiro, imediatamente antes do Total.
- Se o total for R$ 250,00 e o cliente informar troco, o valor deve ser no mínimo R$ 250,00.
- Valores menores são bloqueados no frontend e também validados novamente no backend.
- Deixar o campo de troco em branco continua permitido quando não houver necessidade de troco.
- Removida a estratégia de abrir `about:blank`.
- Após o pedido ser registrado no Vitrio, a própria aba navega para `https://wa.me/...`.
- O WhatsApp recebe a conversa do número cadastrado pela loja e a mensagem já preenchida com:
  produtos, tamanho, cor/adicionais, subtotal, desconto, entrega, total, pagamento, troco, recebimento, cliente, telefone, endereço e observações.
- O pedido continua sendo registrado antes do redirecionamento para atualizar estoque, relatórios e caixa.
