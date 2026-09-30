# Vitrio 2.1

## Destaques
- Variações de produto com SKU, estoque próprio e acréscimo/desconto sobre o preço base.
- Seleção obrigatória de variação na vitrine quando o produto possui opções.
- Carrinho persistente diferencia o mesmo produto por variação.
- WhatsApp inclui a variação escolhida e o preço correto.
- Checkout server-side valida existência, disponibilidade, preço e estoque da variação.
- Criação do pedido baixa o estoque da variação e registra movimento de estoque específico.
- Pedido armazena `variantId`, `variantName` e `variantSku`.

## Cadastro
No campo Variações, use uma opção por linha:
`Nome | SKU | Estoque | Acréscimo`

Exemplo:
`Tamanho P / Preto | CAM-P-PT | 8 | 0`
`Tamanho G / Preto | CAM-G-PT | 5 | 5,00`

O estoque geral de um novo produto com variações é calculado pela soma das variações.
