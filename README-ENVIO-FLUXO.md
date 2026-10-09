# Vitrio — organização do fluxo de entregas e checkout

Alterações desta versão:

- Entrega local (taxa única ou por bairro/região) centralizada em **Entregas**.
- Melhor Envio movido para **Configurações > Finalização da compra / Envio para outros locais**.
- CEP de origem do Melhor Envio configurado junto da integração.
- Aviso e validação de produtos ativos sem peso/dimensões de envio.
- Checkout de envio com endereço estruturado: destinatário, rua, número, complemento, bairro, cidade, UF e referência.
- Pedido salva `shippingAddress` e também um `address` formatado para compatibilidade.
- Modalidade do Melhor Envio salva com transportadora + serviço.
- O fluxo Mercado Pago existente continua ligado ao pedido e ao webhook; o pedido permanece aguardando pagamento até a confirmação.

Importante: este pacote é somente código-fonte. Não inclui `node_modules`, `.env`, `.git`, `dist` nem `functions/lib`.
