# Configuração do usuário Master

O Vitrio não grava a senha do administrador no código-fonte.

Usuário master definido para o projeto:

- E-mail: `kaioportela10@gmail.com`
- Perfil Firestore: `role: "admin"`
- Status: `active: true`

## Opção recomendada — Firebase Console

1. Abra Firebase Console > Authentication > Users.
2. Crie (ou atualize) o usuário `kaioportela10@gmail.com` usando a senha escolhida pelo administrador.
3. Copie o UID criado.
4. No Firestore, crie/atualize `users/{UID}` com:
   - `displayName`: `Kaio Portela`
   - `email`: `kaioportela10@gmail.com`
   - `role`: `admin`
   - `active`: `true`

## Script administrativo

Também existe `functions/scripts/create-master.mjs`.

Ele exige credenciais administrativas do Google/Firebase no ambiente e lê a senha de `MASTER_PASSWORD`, portanto a senha não fica salva no repositório.

Exemplo:

```bash
cd functions
npm install
MASTER_EMAIL="kaioportela10@gmail.com" MASTER_PASSWORD="<SUA_SENHA>" npm run create:master
```

Use `GOOGLE_APPLICATION_CREDENTIALS` apontando para uma conta de serviço autorizada quando executar o script.
