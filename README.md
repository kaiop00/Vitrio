## Vitrio 2.8

Veja `VITRIO_2.8.md` para as correções de interface, compartilhamento e checkout.

> Versão atual do pacote: **2.5.0** — polimento pré-testes, prevenção de duplo envio e UX mobile.

# Vitrio 2.3

> Versão de polimento operacional. Consulte `VITRIO_2.3.md` e `PRE_TEST_CHECKLIST.md` antes da bateria completa de testes.

# Vitrio 1.8

A versão atual inclui melhorias de divulgação, catálogo, ações em lote e operação de pedidos. Veja `VITRIO_1.8.md` para o resumo da versão.

# Vitrio 0.4 — React + Firebase

Base funcional multi-loja do Vitrio.

## Já incluído
- React + Vite + TypeScript.
- Firebase Auth, Firestore, Storage e Cloud Functions.
- Perfis `admin` e `merchant`.
- Painel separado para administrador e lojista.
- Cadastro de lojas pelo administrador.
- Criação de acesso do lojista via Cloud Function segura.
- Cadastro de produtos com upload de imagem.
- Personalização da loja: marca, logo, WhatsApp, Instagram, endereço e cor principal.
- Catálogo público em `/loja/:slug`.
- Carrinho e finalização pelo WhatsApp com itens, total, pagamento e entrega.
- Regras iniciais de segurança do Firestore e Storage.

## 1. Rodar localmente
1. Instale Node.js 20+.
2. Na pasta do projeto, rode `npm install`.
3. O `.env` já está preenchido com a configuração web do projeto Firebase informado nesta conversa.
4. Rode `npm run dev`.

## 2. Criar o primeiro administrador
A criação do primeiro admin deve ser manual para evitar uma rota pública insegura:
1. Firebase Console > Authentication > Users > Add user.
2. Crie seu e-mail e senha.
3. Copie o UID criado.
4. Firestore > coleção `users` > documento com ID igual ao UID.
5. Salve os campos:
   - `displayName`: seu nome
   - `email`: seu e-mail
   - `role`: `admin`
   - `active`: `true`

Depois, faça login em `/login`. O Vitrio redirecionará o admin para `/admin`.

## 3. Publicar regras
Com Firebase CLI autenticado:
```bash
firebase deploy --only firestore:rules,storage
```

## 4. Publicar a função para criar lojistas
Cloud Functions normalmente exige projeto no plano Blaze.
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Depois disso, em `/admin/acessos`, o administrador pode criar o usuário/senha de cada lojista e vinculá-lo à loja.

## 5. Estrutura inicial
- `users`: perfil, papel e `storeId`.
- `stores`: identidade e configurações da loja.
- `products`: produtos com `storeId`.
- `categories`: categorias por loja.
- `orders`: reservado para pedidos reais.

Próxima etapa sugerida: pedidos persistidos, estoque por movimentação, caixa, pagamentos online (Mercado Pago/Stripe), taxas de entrega e ofertas relâmpago.

## Atualização 0.3 — checkout flexível e responsividade
- Painel mobile-first para celular, tablet e notebook.
- Configuração por loja: finalizar pelo WhatsApp, pelo Vitrio ou oferecer os dois.
- Formas de recebimento: retirada ou entrega, com taxa padrão configurável.
- Formas de pagamento configuráveis: Pix, dinheiro e preparação para pagamento online.
- Pedidos feitos pelo Vitrio são gravados no Firestore e aparecem em tempo real no painel da loja.
- Tela de pedidos com status operacional.
- Tela inicial de estoque com alerta de estoque baixo.
- Vitrine pública responsiva, busca, carrinho e checkout adaptado para celular.

> O botão de pagamento online já cria o pedido com status de pagamento pendente. A cobrança real ainda depende da conexão de um gateway (ex.: Mercado Pago/Stripe) e webhook seguro no backend.


## Atualização 0.4 — operação comercial e segurança do checkout
- Categorias reais por loja e filtros no catálogo público.
- Produtos com categoria, preço anterior e marcação de oferta relâmpago.
- Área destacada de ofertas relâmpago na vitrine.
- Ajustes de estoque com histórico em `inventoryMovements`.
- Caixa com abertura, suprimento/entrada, sangria/saída e fechamento.
- Relatórios iniciais: pedidos, faturamento pago, ticket médio e produtos mais pedidos.
- Dashboard com pedidos e faturamento do dia, estoque baixo e últimas demandas.
- Pedido robusto agora é criado pela Cloud Function `createOrder`: o backend recalcula preços, valida a loja, valida disponibilidade e baixa o estoque em transação.
- O navegador não possui mais permissão para criar pedidos diretamente no Firestore.
- Correção do redirecionamento de login para perfis administrador e lojista.

### Importante para o modo "Pelo sistema"
Publique novamente as Functions e as regras após atualizar:
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions,firestore:rules,storage
```

O pagamento online ainda não captura dinheiro de verdade. A estrutura de pedido e status de pagamento está pronta para receber Mercado Pago/Stripe, mas a integração exige as credenciais privadas do gateway e webhook no backend.


## Vitrio 0.5
- Administração de lojas com bloqueio/liberação.
- Planos Starter, Pro e Business e status de assinatura.
- Regras do Firestore endurecidas para impedir o lojista de alterar plano, status, bloqueio ou credenciais de pagamento.
- Central de pagamentos no painel do lojista.
- Arquitetura preparada para Mercado Pago Marketplace via OAuth.
- Tokens privados devem permanecer exclusivamente no backend/Cloud Functions.
- Próximo passo para cobrança real: criar a aplicação Mercado Pago do Vitrio, configurar OAuth/webhook e segredos no Firebase.

## Mercado Pago - configuração segura

### Frontend
Somente a Public Key fica no `.env` do React:

```bash
VITE_MERCADO_PAGO_PUBLIC_KEY=SUA_PUBLIC_KEY_NOVA
```

### Backend / Firebase Functions
Nunca grave o Access Token ou Client Secret no `.env` do Vite. Configure-os como Secrets do Firebase:

```bash
firebase functions:secrets:set MP_ACCESS_TOKEN
firebase functions:secrets:set MP_CLIENT_ID
firebase functions:secrets:set MP_CLIENT_SECRET
firebase functions:secrets:set MP_OAUTH_REDIRECT_URI
firebase functions:secrets:set VITRIO_APP_URL
```

`MP_OAUTH_REDIRECT_URI` deve apontar para a URL publicada da function `mercadoPagoOauthCallback` e a mesma URL deve ser cadastrada como Redirect URL na aplicação do Mercado Pago.

Exemplo de `VITRIO_APP_URL` em desenvolvimento/publicação: `https://seu-dominio.com.br`.

Depois:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions,firestore:rules
```

### Marketplace
O Access Token próprio da aplicação Vitrio não deve ser usado para cobrar vendas das lojas. Cada lojista usa **Conectar Mercado Pago**, autoriza via OAuth, e o token recebido em nome dele fica na coleção privada `storePaymentSecrets`. Os clientes React não têm acesso a essa coleção.

> Por segurança, gere/rotacione novas credenciais antes de produção se alguma chave privada já tiver sido compartilhada ou exposta.

## Passo a passo do lojista para conectar o Mercado Pago
O Vitrio também mostra este passo a passo dentro de **Painel > Pagamentos**:
1. O lojista precisa ter uma conta Mercado Pago da própria loja.
2. No Vitrio, clicar em **Conectar Mercado Pago**.
3. Fazer login no ambiente oficial do Mercado Pago.
4. Autorizar o Vitrio a operar os pagamentos da loja.
5. Aguardar o redirecionamento automático de volta ao Vitrio.
6. Confirmar que o status aparece como **Conta conectada**.
7. Em Configurações, escolher **Checkout Vitrio** ou **WhatsApp + Vitrio** para liberar o pagamento online.

> O lojista nunca deve informar senha, Access Token ou códigos de segurança ao administrador do Vitrio. O vínculo é feito por OAuth diretamente no Mercado Pago.


## Vitrio 0.8
- Checkout Transparente com Mercado Pago Orders API.
- Pix com QR Code, Copia e Cola e confirmação por webhook.
- Cartão com Card Payment Brick e tokenização segura no frontend.
- OAuth individual por lojista com renovação de Access Token.
- Validação HMAC da assinatura do webhook.
- Pedido pago atualizado automaticamente no painel.
- Lançamento automático no caixa quando houver caixa aberto.
- Reserva de estoque e limpeza de pedidos abandonados.
- Lojista não pode alterar `paymentStatus` manualmente pelo Firestore.
- Consulte `MERCADO_PAGO_SETUP.md` antes do deploy.


## Vitrio 0.9
- Módulo de clientes.
- Cupons promocionais.
- Áreas/bairros de entrega com taxas próprias.
- Personalização ampliada da loja: banner, texto de destaque, horário e exibição de estoque.
- Navegação mobile atualizada com os novos módulos.
- Cadastro automático do cliente ao finalizar pedido pelo Vitrio.
- Mercado Pago permanece preparado, mas a configuração final fica para a etapa de fechamento do projeto.


## Vitrio 1.0
- Cupons validados no backend e aplicados ao checkout.
- Áreas/bairros de entrega com taxa calculada pelo backend.
- Cotação do carrinho (`getCheckoutQuote`) antes de criar o pedido.
- Ofertas relâmpago com data/hora de início e fim.
- Histórico de movimentações de estoque, inclusive saídas originadas por pedidos.
- Dashboard com faturamento dos últimos 7 dias.
- Relatórios filtráveis por 7, 30, 90 dias ou período completo.
- Indicadores de descontos, entrega, formas de pagamento e produtos mais vendidos.
- Banner, horário e opção de ocultar quantidade de estoque na vitrine.


## Vitrio 1.1
- Edição de produtos já cadastrados.
- Pedidos com busca, filtro por status, observações internas e impressão de comprovante.
- Notificações do navegador para novos pedidos, mediante autorização do usuário.
- Funcionários por loja com login próprio e permissões por módulo.
- Responsável principal da loja com acesso total e gestão da equipe.
- Regras do Firestore impedem funcionários de elevar o próprio acesso.
- Interface refinada para formulários, modais, pedidos e permissões em celular/tablet.


## Vitrio 1.2
- Cancelamento de pedidos feito no backend com devolução automática dos itens ao estoque.
- Pedidos já pagos não podem ser simplesmente cancelados; devem seguir o fluxo de devolução.
- Confirmação manual de pagamento em dinheiro, com lançamento no caixa aberto.
- Trocas e devoluções parciais/totais com proteção contra devolver quantidade maior que a vendida.
- Histórico de devoluções.
- Auditoria de ações críticas: criação de acessos, atualizações de pedido, confirmação de pagamento, cancelamentos, trocas e devoluções.
- Exportação de relatórios em CSV.
- Configurações comerciais: pedido mínimo, prazo de preparo, telefone de suporte, prefixo de pedidos e política de trocas/devoluções.
- Permissões por módulo também aplicadas nas Firestore Rules, não apenas na interface.
- `totalSpent` dos clientes passa a representar vendas confirmadas, e não apenas pedidos criados.


## Vitrio 1.3
- Nova homepage pública em `/`, com apresentação comercial do Vitrio.
- Botões separados para `Entrar` e `Criar minha loja`.
- Novo fluxo público de cadastro em `/cadastro`.
- Cadastro cria usuário responsável, loja, slug exclusivo e período inicial de teste.
- Login continua em `/login`; usuários autenticados podem acessar seus respectivos painéis.
- Tela de login ganhou retorno para a homepage e link para cadastro.
- Setup seguro do usuário master documentado em `MASTER_SETUP.md`.
- Script administrativo `functions/scripts/create-master.mjs` para criar/atualizar o master sem armazenar senha no código.


## Atualizações
Consulte `VITRIO_1.7.md` para as melhorias mais recentes do catálogo e da vitrine.


## Vitrio 2.6
Correções de status de assinatura no Master, e-mails do Firebase Auth em português e contraste/legibilidade dos campos no tema escuro.
