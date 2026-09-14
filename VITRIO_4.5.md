# Vitrio 4.5 — Operação diária e histórico limpo

- Pedidos: a tela operacional mostra pedidos do dia atual e pendências de dias anteriores.
- Pedidos concluídos/cancelados de dias anteriores deixam de poluir a tela de operação e continuam disponíveis em Relatórios.
- Dashboard: faturamento/pedidos do dia já reiniciam automaticamente por data; “Pedidos de hoje” agora segue a mesma regra operacional.
- Estoque: histórico visual de movimentações limitado aos últimos 30 dias, sem excluir registros do Firestore.
- Busca do estoque mantida como “Buscar produto”, pesquisando somente pelo nome do produto.
- Relatórios e relatório financeiro do caixa continuam consultando o histórico preservado.

Nenhum pedido, venda ou movimentação histórica é apagado automaticamente.
