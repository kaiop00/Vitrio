# Vitrio 2.8

Rodada de correções de interface, divulgação e compartilhamento.

## Alterações

- Tela **Divulgação** redesenhada para o tema escuro do painel, com melhor hierarquia, alinhamento e cards consistentes.
- Link da vitrine deixou de usar superfície branca no painel administrativo.
- Ações rápidas de compartilhamento por **WhatsApp**, **Instagram**, menu nativo do dispositivo e cópia de link.
- Novo componente `ShareSheet` reutilizado na vitrine para compartilhar loja e produtos.
- Finalização via WhatsApp tenta primeiro abrir o aplicativo instalado usando `whatsapp://`; se o aplicativo não responder, usa a versão web como fallback.
- No Instagram, o Vitrio copia o link e tenta abrir o aplicativo. A plataforma Instagram não oferece um esquema web público para preencher automaticamente Story/Direct com um link, por isso o usuário cola o link no destino desejado.
- Campo de **cupom de desconto** do checkout corrigido para usar o mesmo fundo branco e texto escuro dos demais campos da vitrine.
- Revisão adicional das superfícies administrativas que ainda usavam branco: filtros de estoque/pedidos, resumos, estados vazios, upload, seleção em lote e algumas linhas auxiliares.

## Validação

Antes do deploy, executar:

```bash
npm install
npm run build
```
