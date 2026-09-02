import { test, expect } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5173';

test('home and login flow are reachable', async ({ page }) => {
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: /Seu comércio em um link/i })).toBeVisible();

  await page.getByRole('link', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bem-vindo' })).toBeVisible();
});

test('protected routes load after login', async ({ page }) => {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel('E-mail').fill('kaioportela@alu.ufc.br');
  await page.getByLabel('Senha').fill('123456');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByText('Faturamento hoje')).toBeVisible();

  await page.goto(`${baseURL}/painel/estoque`);
  await expect(page.locator('main h1').filter({ hasText: 'Estoque' })).toBeVisible();

  await page.goto(`${baseURL}/login`);
  await page.getByLabel('E-mail').fill('kaioportela10@gmail.com');
  await page.getByLabel('Senha').fill('61664254307');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('link', { name: 'Gerenciar lojas' })).toBeVisible();

  await page.goto(`${baseURL}/admin/suporte/nao-existe`);
  await expect(page.getByRole('heading', { name: 'Suporte indisponível' })).toBeVisible();
  await expect(page.getByText('Loja não encontrada.')).toBeVisible();
});

test('promotion flow loads and shares', async ({ page }) => {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel('E-mail').fill('kaioportela@alu.ufc.br');
  await page.getByLabel('Senha').fill('123456');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.goto(`${baseURL}/painel/divulgacao`);
  await expect(page.getByRole('heading', { name: 'Leve sua loja para onde seus clientes estão' })).toBeVisible();
  await expect(page.getByRole('img', { name: /QR Code da/i })).toBeVisible();

  await page.locator('.promotion-share-main').click();
  await expect(page.getByText('Escolha onde deseja enviar o link.')).toBeVisible();
  await page.getByRole('button', { name: /Copiar link/i }).last().click();
  await expect(page.getByText('Link copiado. Abra o Instagram para colar na conversa ou story.')).toBeVisible();
});