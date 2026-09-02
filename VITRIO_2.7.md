# Vitrio 2.7

## Varredura completa dos campos

Correção global do tema escuro dos formulários administrativos. A versão 2.6 usava seletores `.app-shell`, mas a interface atual utiliza `.app-shell-v2`, por isso diversas telas continuavam recebendo regras claras de versões anteriores.

### Corrigido
- inputs de texto, e-mail, senha, telefone, URL e busca;
- campos numéricos, data, hora e datetime;
- selects e opções;
- textareas;
- campos de upload de arquivos e botão nativo do Safari;
- autofill do Safari/Chromium;
- placeholders, cursor, hover e foco;
- labels dos formulários no painel;
- campos do Master e do lojista;
- preservação do tema claro na vitrine pública, checkout, acompanhamento e diálogos claros.

### Causa raiz
O shell atual do painel é `.app-shell-v2`. A regra de correção da 2.6 estava direcionada principalmente a `.app-shell`, então não alcançava a árvore DOM atual. Além disso, uma regra de polimento anterior (`.form-grid input`, `.inline-form input`) forçava fundo branco.
