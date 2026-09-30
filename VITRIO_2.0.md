# Vitrio 2.0

## Evoluções desta versão
- Observações do cliente no checkout, persistidas no pedido e visíveis na operação/impressão.
- Disponibilidade por produto para retirada e/ou entrega.
- Limite máximo de unidades por produto em cada pedido, validado também no backend.
- Produtos relacionados automaticamente pela categoria na vitrine.
- Dashboard com faturamento do mês e comparação com o mês anterior.
- Regras de disponibilidade e limite validadas pelo `getCheckoutQuote`/`createOrder`, evitando depender apenas da interface.
- Mantém o Mercado Pago temporariamente fora dos exports de Functions até a etapa de configuração.
