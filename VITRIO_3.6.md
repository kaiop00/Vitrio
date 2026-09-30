# Vitrio 3.6

Correções:

1. **Preço das variações**
   - O quarto campo das variações agora é o **preço final daquela variação**, e não mais um acréscimo.
   - Exemplo:
     `Tamanho P | | 80 | 45,00`
     `Tamanho M | | 20 | 45,00`
   - Internamente o Vitrio continua calculando a diferença em relação ao preço-base, mas para o lojista o cadastro fica mais intuitivo.
   - Produtos antigos com `priceAdjustment = 0` passam a mostrar automaticamente o preço-base ao serem abertos para edição.

2. **Adicionar ao carrinho**
   - O botão fica sempre visível na parte inferior direita do modal em desktop.
   - No celular ele fica fixado/sticky na parte inferior do conteúdo.
   - Depois de escolher entrega/retirada, tamanho e cor, o cliente consegue adicionar ao carrinho e seguir para o checkout.

3. **Categoria Todos**
   - O filtro `Todos` ganhou contraste próprio e não depende mais da cor configurada pela loja.
   - O estado ativo usa fundo roxo e texto branco.
