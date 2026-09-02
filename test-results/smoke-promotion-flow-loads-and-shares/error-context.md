# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> promotion flow loads and shares
- Location: tests/smoke.spec.ts:39:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Leve sua loja para onde seus clientes estão' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Leve sua loja para onde seus clientes estão' })

```

```yaml
- link "← Voltar para o início":
  - /url: /
- text: V
- strong: Vitrio
- text: Seu comércio em um link.
- heading "Bem-vindo" [level=1]
- paragraph: Um único acesso. O Vitrio direciona você automaticamente para o painel correto.
- text: E-mail
- textbox "E-mail"
- text: Senha
- textbox "Senha"
- link "Esqueci minha senha":
  - /url: /recuperar-senha
- button "Entrar"
- paragraph:
  - text: Quer abrir uma loja?
  - link "Criar minha loja":
    - /url: /cadastro
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const baseURL = 'http://127.0.0.1:5173';
  4  | 
  5  | test('home and login flow are reachable', async ({ page }) => {
  6  |   await page.goto(baseURL);
  7  |   await expect(page.getByRole('heading', { name: /Seu comércio em um link/i })).toBeVisible();
  8  | 
  9  |   await page.getByRole('link', { name: 'Entrar' }).click();
  10 |   await expect(page).toHaveURL(/\/login$/);
  11 |   await expect(page.getByRole('heading', { name: 'Bem-vindo' })).toBeVisible();
  12 | });
  13 | 
  14 | test('protected routes load after login', async ({ page }) => {
  15 |   await page.goto(`${baseURL}/login`);
  16 |   await page.getByLabel('E-mail').fill('kaioportela@alu.ufc.br');
  17 |   await page.getByLabel('Senha').fill('123456');
  18 |   await page.getByRole('button', { name: 'Entrar' }).click();
  19 | 
  20 |   await expect(page).toHaveURL(/\/painel$/);
  21 |   await expect(page.getByText('Faturamento hoje')).toBeVisible();
  22 | 
  23 |   await page.goto(`${baseURL}/painel/estoque`);
  24 |   await expect(page.locator('main h1').filter({ hasText: 'Estoque' })).toBeVisible();
  25 | 
  26 |   await page.goto(`${baseURL}/login`);
  27 |   await page.getByLabel('E-mail').fill('kaioportela10@gmail.com');
  28 |   await page.getByLabel('Senha').fill('61664254307');
  29 |   await page.getByRole('button', { name: 'Entrar' }).click();
  30 | 
  31 |   await expect(page).toHaveURL(/\/admin$/);
  32 |   await expect(page.getByRole('link', { name: 'Gerenciar lojas' })).toBeVisible();
  33 | 
  34 |   await page.goto(`${baseURL}/admin/suporte/nao-existe`);
  35 |   await expect(page.getByRole('heading', { name: 'Suporte indisponível' })).toBeVisible();
  36 |   await expect(page.getByText('Loja não encontrada.')).toBeVisible();
  37 | });
  38 | 
  39 | test('promotion flow loads and shares', async ({ page }) => {
  40 |   await page.goto(`${baseURL}/login`);
  41 |   await page.getByLabel('E-mail').fill('kaioportela@alu.ufc.br');
  42 |   await page.getByLabel('Senha').fill('123456');
  43 |   await page.getByRole('button', { name: 'Entrar' }).click();
  44 | 
  45 |   await page.goto(`${baseURL}/painel/divulgacao`);
> 46 |   await expect(page.getByRole('heading', { name: 'Leve sua loja para onde seus clientes estão' })).toBeVisible();
     |                                                                                                    ^ Error: expect(locator).toBeVisible() failed
  47 |   await expect(page.getByRole('img', { name: /QR Code da/i })).toBeVisible();
  48 | 
  49 |   await page.locator('.promotion-share-main').click();
  50 |   await expect(page.getByText('Escolha onde deseja enviar o link.')).toBeVisible();
  51 |   await page.getByRole('button', { name: /Copiar link/i }).last().click();
  52 |   await expect(page.getByText('Link copiado. Abra o Instagram para colar na conversa ou story.')).toBeVisible();
  53 | });
```