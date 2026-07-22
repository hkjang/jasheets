import { expect, test } from '@playwright/test';

const apiUrl = 'http://localhost:4000/api';

test('real API persists a cell edit across a full page reload', async ({ page, request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `e2e-${suffix}@example.com`;
  const register = await request.post(`${apiUrl}/auth/register`, {
    data: { email, password: 'E2e-password-123!', name: 'E2E User' },
  });
  expect(register.ok()).toBe(true);
  const session = (await register.json()) as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string | null };
  };

  const create = await request.post(`${apiUrl}/sheets`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { name: `Persistence ${suffix}` },
  });
  expect(create.ok()).toBe(true);
  const workbook = (await create.json()) as { id: string };

  await page.addInitScript((auth) => {
    localStorage.setItem('auth_token', auth.accessToken);
    localStorage.setItem('refresh_token', auth.refreshToken);
    localStorage.setItem('user', JSON.stringify(auth.user));
  }, session);

  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`/spreadsheet/${workbook.id}`);
  const canvas = page.getByRole('grid', { name: 'Spreadsheet grid' });
  await expect(canvas).toBeVisible();

  const value = `persisted-${suffix}`;
  const saveResponse = page.waitForResponse((response) =>
    response.request().method() === 'PUT' &&
    response.url().includes('/api/sheets/sheet/') &&
    response.url().endsWith('/cells'),
  );
  await canvas.dblclick({ position: { x: 120, y: 60 } });
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
  expect((await saveResponse).ok()).toBe(true);

  await page.reload();
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 120, y: 60 } });
  await expect(page.getByPlaceholder('Enter value or formula')).toHaveValue(value);
  expect(pageErrors).toEqual([]);
  expect(serverErrors).toEqual([]);
});
