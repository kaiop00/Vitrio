# Vitrio 4.7.8

- Permissões de funcionários agora são **deny-by-default**.
- Funcionário só vê módulos explicitamente gravados em `permissions`.
- `permissions` ausente não concede mais acesso total.
- Atalhos da busca global também respeitam as permissões.
- Itens públicos/administrativos da loja ficam restritos ao responsável principal quando o usuário é funcionário.
- Rotas protegidas validam permissões explicitamente.
