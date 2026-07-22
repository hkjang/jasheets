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

test('formula, formatting, and row insertion survive a real server round trip', async ({ page, request }) => {
  const reactStateWarnings: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      message.text().includes('Cannot update a component')
    ) {
      reactStateWarnings.push(message.text());
    }
  });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const register = await request.post(`${apiUrl}/auth/register`, {
    data: {
      email: `structure-${suffix}@example.com`,
      password: 'E2e-password-123!',
      name: 'Structure E2E',
    },
  });
  expect(register.ok()).toBe(true);
  const session = (await register.json()) as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string | null };
  };
  const create = await request.post(`${apiUrl}/sheets`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { name: `Formula structure ${suffix}` },
  });
  expect(create.ok()).toBe(true);
  const workbook = (await create.json()) as { id: string };

  await page.addInitScript((auth) => {
    localStorage.setItem('auth_token', auth.accessToken);
    localStorage.setItem('refresh_token', auth.refreshToken);
    localStorage.setItem('user', JSON.stringify(auth.user));
  }, session);
  await page.goto(`/spreadsheet/${workbook.id}`);
  const canvas = page.getByRole('grid', { name: 'Spreadsheet grid' });
  await expect(canvas).toBeVisible();

  const saveCell = async (position: { x: number; y: number }, value: string) => {
    const response = page.waitForResponse((candidate) =>
      candidate.request().method() === 'PUT' && candidate.url().endsWith('/cells'),
    );
    await canvas.dblclick({ position });
    await page.keyboard.type(value);
    await page.keyboard.press('Enter');
    expect((await response).ok()).toBe(true);
  };

  await saveCell({ x: 100, y: 35 }, '21');
  await saveCell({ x: 100, y: 60 }, '=A1*2');

  await canvas.click({ position: { x: 100, y: 60 } });
  const formatSave = page.waitForResponse((response) =>
    response.request().method() === 'PUT' && response.url().endsWith('/cells'),
  );
  await page.getByTitle('Bold (Ctrl+B)').click();
  expect((await formatSave).ok()).toBe(true);

  const structureSave = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/structure'),
  );
  await canvas.click({ button: 'right', position: { x: 100, y: 60 } });
  await page.getByRole('button', { name: '위에 삽입' }).click();
  expect((await structureSave).ok()).toBe(true);

  await page.reload();
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 100, y: 85 } });
  await expect(page.getByPlaceholder('Enter value or formula')).toHaveValue('=A1*2');
  await expect(page.getByTitle('Bold (Ctrl+B)')).toHaveClass(/active/);

  const loaded = await request.get(`${apiUrl}/sheets/${workbook.id}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(loaded.ok()).toBe(true);
  const body = (await loaded.json()) as {
    sheets: Array<{
      rowCount: number;
      cells: Array<{ row: number; col: number; formula?: string | null; format?: unknown }>;
    }>;
  };
  expect(body.sheets[0].rowCount).toBe(1001);
  expect(body.sheets[0].cells).toEqual(expect.arrayContaining([
    expect.objectContaining({ row: 2, col: 0, formula: '=A1*2' }),
  ]));
  expect(reactStateWarnings).toEqual([]);
});
