import { expect, test } from '@playwright/test';

const apiUrl = 'http://localhost:4000/api';

test('large sparse sheet scrolls without canvas resets or loading flashes', async ({ page, request }) => {
  test.setTimeout(90_000);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const register = await request.post(`${apiUrl}/auth/register`, {
    data: {
      email: `large-${suffix}@example.com`,
      password: 'E2e-password-123!',
      name: 'Large Sheet E2E',
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
    data: { name: `Large sparse ${suffix}` },
  });
  expect(create.ok()).toBe(true);
  const workbook = (await create.json()) as {
    id: string;
    sheets: Array<{ id: string; version: number }>;
  };
  const sheet = workbook.sheets[0];
  let version = sheet.version ?? 0;
  const cellCount = 8_000;
  for (let offset = 0; offset < cellCount; offset += 1_000) {
    const updates = Array.from({ length: 1_000 }, (_, index) => {
      const cellIndex = offset + index;
      return {
        row: Math.floor(cellIndex / 10),
        col: cellIndex % 10,
        value: `R${Math.floor(cellIndex / 10) + 1}C${(cellIndex % 10) + 1}`,
      };
    });
    const saved = await request.put(`${apiUrl}/sheets/sheet/${sheet.id}/cells`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: {
        updates,
        expectedVersion: version,
        idempotencyKey: `large-${suffix}-${offset}`,
      },
    });
    expect(saved.ok()).toBe(true);
    version = ((await saved.json()) as { version: number }).version;
  }

  await page.addInitScript((auth) => {
    localStorage.setItem('auth_token', auth.accessToken);
    localStorage.setItem('refresh_token', auth.refreshToken);
    localStorage.setItem('user', JSON.stringify(auth.user));
  }, session);

  await page.goto(`/spreadsheet/${workbook.id}`);
  const canvas = page.getByRole('grid', { name: 'Spreadsheet grid' });
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  // The first visit includes Next.js development compilation. A full reload
  // still exercises the real DB query, JSON transfer, deserialization and
  // canvas render while isolating application performance from compilation.
  const reloadStartedAt = Date.now();
  await page.reload();
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - reloadStartedAt).toBeLessThan(10_000);

  await page.evaluate(() => {
    const grid = document.querySelector('canvas[role="grid"]');
    if (!grid) throw new Error('Spreadsheet canvas was not rendered');
    const state = window as typeof window & {
      __largeSheetCanvasResets?: number;
      __largeSheetLoadingSeen?: boolean;
    };
    state.__largeSheetCanvasResets = 0;
    state.__largeSheetLoadingSeen = false;
    new MutationObserver((records) => {
      state.__largeSheetCanvasResets! += records.filter(({ attributeName }) =>
        attributeName === 'width' || attributeName === 'height',
      ).length;
    }).observe(grid, { attributes: true, attributeFilter: ['width', 'height'] });
    new MutationObserver(() => {
      if ([...document.body.querySelectorAll('div')].some((element) =>
        element.textContent?.trim() === 'Loading...',
      )) state.__largeSheetLoadingSeen = true;
    }).observe(document.body, { childList: true, subtree: true });
  });

  const scrollStartedAt = Date.now();
  await canvas.hover();
  for (let index = 0; index < 60; index += 1) {
    await page.mouse.wheel(0, 240);
  }
  expect(Date.now() - scrollStartedAt).toBeLessThan(10_000);
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  ));

  const measurements = await page.evaluate(() => {
    const state = window as typeof window & {
      __largeSheetCanvasResets?: number;
      __largeSheetLoadingSeen?: boolean;
    };
    return {
      resets: state.__largeSheetCanvasResets ?? -1,
      loadingSeen: state.__largeSheetLoadingSeen ?? true,
    };
  });
  expect(measurements.resets).toBe(0);
  expect(measurements.loadingSeen).toBe(false);

  await canvas.click({ position: { x: 100, y: 60 } });
  await expect(page.getByPlaceholder('Enter value or formula')).not.toHaveValue('');
});
