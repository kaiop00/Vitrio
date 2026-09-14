# Vitrio 4.7 — fluxo de assinatura manual por Pix

- Teste vencido é detectado pela data mesmo quando o status ainda está `trial`.
- Loja vencida perde acesso operacional, mas mantém acesso à página Plano e assinatura.
- Página de assinatura agora exibe valor do plano, QR Code Pix, Pix copia e cola e WhatsApp financeiro.
- O lojista registra a solicitação e abre o WhatsApp para enviar o comprovante manualmente.
- O Master configura chave Pix, recebedor, cidade, WhatsApp e valores dos planos em Configurações.
- Clientes e lojas exibe testes expirados e comprovantes aguardando conferência.
- O Master pode aprovar um comprovante e liberar a assinatura por 30 dias.
- Nenhuma API de pagamento é necessária para esse fluxo.
