# Vitrio 1.6

Versão focada em clareza operacional, navegação e experiência de uso.

## Interface e navegação
- Novo shell do painel com sidebar organizada por grupos: Visão geral, Operação, Relacionamento, Gestão e Loja.
- Topbar fixa com contexto da tela, perfil e acesso rápido a avisos.
- Busca global/atalhos com `Cmd/Ctrl + K` para abrir páginas rapidamente.
- Menu mobile em drawer, mantendo o painel utilizável em celular e tablet.
- Identidade da loja e status da assinatura visíveis na sidebar do lojista.
- Atalho permanente para abrir a vitrine pública.

## Painel do lojista
- Dashboard reorganizado com ações rápidas, faturamento do dia, receita da semana, ticket médio, pedidos em andamento e estoque baixo.
- Resumo inteligente indicando prioridades operacionais.
- Ranking de produtos por quantidade vendida nos últimos 7 dias.
- Nova Central de Atividade com pedidos recentes, estoque crítico e logs de auditoria.

## Painel Master
- Visão de plataforma mais limpa e orientada a ação.
- Fila de clientes que exigem atenção por teste vencido, pagamento pendente ou bloqueio.
- Indicadores de saúde da base e progresso de onboarding.
- Cards das lojas cadastradas recentemente com acesso direto ao suporte.

## Vitrine pública
- Carrinho persistente no navegador: uma atualização da página não apaga os itens.
- Modal de detalhes do produto antes de adicionar ao carrinho.
- Estado vazio de busca/categoria com opção de limpar filtros.
- Melhorias visuais e responsivas para catálogo e detalhes.

## Observações
- Mercado Pago continua temporariamente fora do deploy das Functions, conforme decisão anterior.
- Antes de publicar, executar `npm install`, `npm run build` e a bateria de testes combinada.
