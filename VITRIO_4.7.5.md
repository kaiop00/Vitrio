# Vitrio 4.7.5

Correções de estabilização:
- Configuração Pix/Mensalidade no Master agora lê e grava diretamente em `platformSettings/billing` no Firestore.
- Tela Plano e assinatura do lojista lê a mesma configuração diretamente do Firestore, permitindo gerar QR Code e Pix copia e cola sem depender de callable para leitura.
- Tela Acessos do Master carrega lojas diretamente da coleção `stores`, eliminando a dependência de `adminListStores` para preencher o select.
- Mensagens de erro mais claras para regras do Firestore e criação de acesso.
- Mantida `createStoreUser` no backend para criar conta no Firebase Authentication sem derrubar a sessão do Master.

## Deploy obrigatório desta versão
`firebase deploy --only firestore:rules,functions:createStoreUser`
