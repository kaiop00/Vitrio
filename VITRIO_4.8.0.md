# Vitrio 4.8.0 — candidato de deploy

Revisão de backend antes da publicação:
- runtime das Cloud Functions atualizado para Node.js 22;
- permissões operacionais reforçadas nas callable Functions;
- Firestore deixa de conceder acesso total a perfis sem `permissions`;
- expiração da assinatura mensal passa a bloquear painel e operações;
- checkout público passa a rejeitar loja com teste/assinatura vencidos ou status financeiro bloqueado;
- Mercado Pago continua desativado no backend.
