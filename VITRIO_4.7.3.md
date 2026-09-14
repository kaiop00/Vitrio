# Vitrio 4.7.3

Correções de estabilização:

- Cobrança Pix do Master agora carrega e salva via Cloud Functions, evitando bloqueio por regras do Firestore.
- Nova função `getBillingSettings` para leitura segura dos dados de cobrança por usuários autenticados.
- Nova função `adminSaveBillingSettings` para gravação administrativa da chave Pix, WhatsApp e mensalidade.
- A tela de assinatura do lojista passa a carregar os dados de cobrança pelo backend.
- Auditoria Master deixa de contar automações (`system` / Checkout WhatsApp) como responsáveis humanos.
- Automação de checkout passa a aparecer como "Automação do sistema" na tabela de auditoria.
- Ações comuns da auditoria ganharam rótulos mais legíveis em português.
- A tela administrativa de Acessos carrega lojas por uma Cloud Function (`adminListStores`) com estado de carregamento.
- `createStoreUser` ganhou validação e tratamento de erros de e-mail já cadastrado, e-mail inválido e senha inválida, evitando erro genérico INTERNAL.
- Textos da assinatura do lojista foram simplificados, substituindo referências técnicas a "Master" e API por "responsável pela plataforma".
