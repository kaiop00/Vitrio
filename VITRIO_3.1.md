# Vitrio 3.1

Correções desta versão:

- Meta mensal de vendas agora aceita formato brasileiro: `1000`, `1.000` e valores digitados com separador.
- Campo deixou de ser `type=number`, evitando o erro de “número inválido” do navegador ao usar ponto de milhar.
- Removido o campo de estoque do cadastro de produto.
- Produto com variações calcula o estoque total pela soma das quantidades de cada variação.
- Produto sem variações nasce com estoque 0 e deve ser abastecido pela página Estoque.
- Na edição, estoque não é mais alterado diretamente quando existem variações; é recalculado pelas variações.
- Campo de cores/adicionais aceita uma cor por linha:
  Azul
  Preto
  Verde
- Linhas simples são convertidas automaticamente para o grupo obrigatório `Cor`.
- Também continua aceitando o formato completo:
  `Cor | Azul | 0 | sim | 1`
- Após salvar, as cores passam a ser gravadas em `addonGroups` e ficam disponíveis para o cliente na vitrine.
- Botão de adicionar ao carrinho foi reforçado visualmente e permanece visível no modal do produto.
- Fluxo esperado: escolher tamanho -> escolher cor -> adicionar ao carrinho -> finalizar pedido.

Importante: para produtos cujas cores foram salvas anteriormente em formato inválido, abra o produto, informe novamente as cores (uma por linha) e salve uma vez nesta versão.
