# Vitrio 2.3 — Polimentos operacionais

Esta versão inicia a fase de refinamento antes da bateria completa de testes.

## Estoque
- Visão geral de unidades, itens em atenção e histórico de movimentações.
- Limite de estoque baixo passa a respeitar a configuração da loja (`lowStockThreshold`).
- Produtos com variações podem ser expandidos para visualizar estoque e SKU por variação.
- Ajuste manual pode ser feito diretamente em uma variação; o estoque total do produto é recalculado automaticamente.
- Busca por produto, SKU e variação.
- Filtros: todos, estoque baixo, esgotados e produtos com variações.
- Histórico mostra origem da movimentação, motivo, data/hora e saldo anterior → atual.

## Pedidos
- Filtros rápidos por etapa do pedido.
- Indicador visual de progresso do fluxo operacional.
- Pedidos abertos há 30 minutos ou mais recebem destaque de atenção.
- Busca e ações existentes foram mantidas.

## Catálogo
- Produtos agora possuem `sortOrder` opcional.
- O lojista pode mover itens para cima/baixo no catálogo.
- A vitrine usa essa ordem quando o cliente seleciona “Relevância”, mantendo produtos em destaque primeiro.
- Produtos antigos sem `sortOrder` continuam compatíveis; a primeira reorganização normaliza a ordem.

## Segurança e compatibilidade
- Mercado Pago permanece temporariamente desativado nos exports das Functions, como nas versões anteriores.
- Não houve relaxamento das regras de Firestore/Storage.
- Estrutura de variações, opcionais, carrinho e pedidos da 2.2 foi preservada.
