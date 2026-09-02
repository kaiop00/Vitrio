# Vitrio 0.8 — Configuração Mercado Pago

Esta versão usa **Checkout Transparente + Orders API**, com cada loja conectando a própria conta Mercado Pago via OAuth.

## 1. URLs no Mercado Pago

Na aplicação de pagamentos do Vitrio, configure a URL de redirecionamento OAuth com a URL pública da Function `mercadoPagoOauthCallback`.

Depois do deploy, o Firebase exibirá a URL HTTPS da Function. Cadastre essa URL em **OAuth / URLs de redirecionamento** da aplicação Mercado Pago.

## 2. Webhook

Em **Mercado Pago Developers > Sua integração > Webhooks**, configure a URL pública da Function:

`mercadoPagoWebhook`

Ative notificações relacionadas a **Orders**. Copie a assinatura secreta gerada pelo Mercado Pago e salve no Firebase como `MP_WEBHOOK_SECRET`.

O Vitrio valida `x-signature` antes de processar a notificação.

## 3. Secrets das Cloud Functions

Execute na raiz do projeto:

```bash
firebase functions:secrets:set MP_CLIENT_ID
firebase functions:secrets:set MP_CLIENT_SECRET
firebase functions:secrets:set MP_OAUTH_REDIRECT_URI
firebase functions:secrets:set VITRIO_APP_URL
firebase functions:secrets:set MP_WEBHOOK_SECRET
```

`MP_ACCESS_TOKEN` continua opcional para a função administrativa de teste da credencial própria do Vitrio:

```bash
firebase functions:secrets:set MP_ACCESS_TOKEN
```

Não coloque Client Secret, Access Token ou Webhook Secret em arquivos `VITE_*`, no React ou no Firestore público.

## 4. Deploy

```bash
npm install
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions,firestore:rules,storage
```

## 5. Conectar uma loja

1. Entre no Vitrio como lojista.
2. Abra **Pagamentos**.
3. Clique em **Conectar Mercado Pago**.
4. Faça login na conta Mercado Pago da própria loja.
5. Autorize o Vitrio.
6. O Mercado Pago retorna Access Token, Refresh Token e Public Key daquela loja.
7. Tokens privados ficam em `storePaymentSecrets`, sem acesso pelo frontend.
8. A Public Key do vendedor é disponibilizada para o Card Payment Brick.

## 6. Fluxo Pix

Cliente → carrinho → pedido validado no backend → Orders API → QR Code/Copia e Cola → Mercado Pago envia webhook → Vitrio valida a assinatura → pedido vira **Pago** → painel atualiza → venda entra no caixa aberto.

## 7. Fluxo cartão

Cliente → carrinho → pedido validado → Card Payment Brick tokeniza o cartão no navegador → somente o token vai para Cloud Functions → Orders API processa com o Access Token OAuth da loja → webhook confirma o estado final.

O Vitrio nunca recebe o número completo do cartão e nunca envia o Access Token do lojista ao navegador.

## 8. Estoque

O estoque é reservado quando o pedido é criado. Pagamentos rejeitados liberam a reserva. Uma rotina horária também cancela pedidos abandonados que nunca chegaram a gerar cobrança após 45 minutos.

## Importante antes de produção

Use credenciais de teste durante desenvolvimento. Como credenciais de produção foram compartilhadas durante a configuração inicial, gere/rotacione novas credenciais antes do lançamento.
