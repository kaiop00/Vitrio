# Vitrio 2.9 — pacote de atualização

Este ZIP contém **somente os arquivos alterados/novos**, para aplicar sobre o repositório `kaiop00/Vitrio`.

## Alterações
- Corrige taxa padrão de entrega que voltava para zero durante digitação.
- Corrige pedido mínimo/desconto de cupom com o mesmo problema.
- Remove o chevron sem ação no cartão da loja.
- Caixa mantém abertura/fechamento e ganha relatório por data inicial/final, vendas, entradas, saídas e impressão.
- Pagamentos reorganizados em:
  - Recebimentos da loja (Mercado Pago do próprio lojista).
  - Assinatura Vitrio (Pix do Master).
- Master configura chave Pix, nome/cidade, WhatsApp de conferência e valores dos planos.
- QR Code Pix da assinatura é gerado com o valor do plano.
- Botão “Paguei — enviar comprovante” abre o WhatsApp do Master com mensagem pronta.
- Central de Suporte para lojista abrir chamados.
- Central de Suporte no Master para responder e encerrar chamados.

## Aplicação
Copie o conteúdo deste ZIP para a raiz do projeto, substituindo os arquivos existentes.

Depois:
```bash
npm run build
firebase deploy --only firestore:rules
```

Para testar localmente:
```bash
npm run dev
```

## Observação importante
O QR Code Pix é para **monetização/assinatura do Vitrio**. Os pagamentos das vendas dos produtos continuam separados e vinculados à conta de recebimento do lojista.
