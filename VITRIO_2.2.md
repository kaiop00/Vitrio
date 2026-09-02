# Vitrio 2.2

## Opcionais e adicionais
- Produtos podem ter grupos de opcionais/adicionais.
- Cada grupo define se é obrigatório e quantas escolhas permite.
- Cada opção pode adicionar valor ao preço final.
- Vitrine exige grupos obrigatórios antes de adicionar ao carrinho.
- Carrinho diferencia combinações de variação + opcionais.
- Carrinho persistente restaura os opcionais válidos.
- Checkout e cotação recalculam tudo no backend; preços enviados pelo navegador não são confiados.
- Pedido, impressão e acompanhamento exibem variação e adicionais.

## Estoque e consistência
- Edição de produto agora permite alterar variações e adicionais.
- Estoque total de produto com variações é recalculado pela soma das variações.
- Criação de pedido agrega baixas por produto/variação para evitar inconsistência com combinações diferentes de adicionais.
- Cancelamento agora restaura também o estoque da variação correta, além do estoque total.

## Formato rápido no cadastro
Adicionais: `Grupo | Opção | Preço | Obrigatório | Máximo`

Exemplo:
`Embalagem | Presente | 5,00 | não | 1`
`Cor | Azul | 0 | sim | 1`
`Cor | Preto | 0 | sim | 1`
