# Vitrio 1.8

Versão focada em operação, divulgação e experiência de compra.

## Novidades

- Nova área **Divulgação** no painel do lojista.
- Geração de QR Code da vitrine em alta resolução e download em PNG.
- Copiar e compartilhar link público da loja.
- Compartilhamento de produto com link profundo que abre o item diretamente na vitrine.
- Ordenação do catálogo por relevância, menor preço, maior preço e ordem alfabética.
- Botão de compartilhar loja na vitrine pública.
- Ação para limpar todo o carrinho com confirmação.
- Seleção de produtos e ações em lote: ativar, ocultar, destacar, remover destaque e excluir.
- Resumo operacional na tela de pedidos: em andamento, em preparo, prontos e vendas do dia.
- Tempo decorrido do pedido e botão de avanço rápido para o próximo status.
- Atalho de Divulgação incluído na busca global (`Cmd/Ctrl + K`).

## Dependência nova

A versão usa `qrcode` apenas no painel do lojista para gerar o QR Code localmente, sem depender de serviço externo.

Após extrair, execute `npm install` antes de `npm run build`.
