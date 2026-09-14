# Vitrio 3.0

Correções deste pacote:

- Campo "Meta mensal de vendas" agora aceita apagar o valor e digitar normalmente.
- Campo "Pedido mínimo" de Minha Loja recebe a mesma correção preventiva.
- Após cadastrar um produto, o seletor de imagens é realmente limpo.
- Estoque inicial sem variações é persistido diretamente no produto.
- Produtos com variações passam a exibir o estoque total calculado pela soma das variações na tela de estoque e na vitrine.
- Edição de Variações e de Opcionais/Adicionais agora usa texto temporário e só converte ao salvar, evitando o campo "travar", perder linhas ou apagar opções durante a digitação.
- Cores/opcionais cadastrados aparecem no modal da vitrine quando existem em `addonGroups`.
- Botão "Adicionar ao carrinho" foi colocado antes das recomendações e ficou visível/sticky no modal.
- Fluxo do carrinho continua usando variação + adicionais selecionados.

Observação:
Se as cores/opcionais de um produto já foram apagadas do Firestore por uma edição anterior, o sistema não consegue reconstruir automaticamente os nomes perdidos. Nesse produto será necessário cadastrar as cores novamente uma única vez; depois desta versão, novas edições preservam o conteúdo corretamente.
