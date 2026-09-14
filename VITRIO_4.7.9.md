# Vitrio 4.7.9

- Central de suporte do Master passa a ler os chamados diretamente do Firestore em tempo real, eliminando a dependência da função que retornava `internal`.
- Envio de chamados do lojista também passa a gravar diretamente em `supportTickets`, respeitando as regras do Firestore.
- Respostas e encerramento de chamados pelo Master são atualizados diretamente no Firestore.
- Relatório PDF traduz status dos pedidos para PT-BR e padroniza nomes das formas de pagamento.
- CSV também exporta status em português.
- Organização textual dos relatórios refinada.
- Caixa: botão `Imprimir` substituído por `Gerar PDF`.
- PDF financeiro inclui resumo, vendas recebidas e movimentações manuais do período.
