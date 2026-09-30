# Vitrio 4.1

## Ajustes
- Máscara de WhatsApp no padrão `(88) 9 9999 - 9999`.
- O campo aceita somente números e formata automaticamente.
- Aplicado no carrinho/checkout e no cadastro/configuração da loja.
- Mensagem amigável quando a função `createOrder` não estiver publicada.

## Sobre o erro 404
O erro `...cloudfunctions.net/createOrder -> 404` significa que a função `createOrder` não está publicada no Firebase ativo.

Publique somente essa função:

```bash
npm run deploy:create-order
```

Ou:

```bash
cd functions
npm install
npm run build
cd ..
firebase use teia-c860e
firebase deploy --only functions:createOrder
```

Depois confirme no terminal que `createOrder(us-central1)` foi criada ou atualizada.
