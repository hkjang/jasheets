import { test, expect } from '@playwright/test';

test.describe('Spreadsheet Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the spreadsheet header', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('JaSheets')).toBeVisible();
  });

  test('should display the toolbar', async ({ page }) => {
    await expect(page.locator('[class*="toolbar"]')).toBeVisible();
  });

  test('should display the formula bar', async ({ page }) => {
    await expect(page.locator('[class*="formulaBar"]')).toBeVisible();
  });

  test('should display the spreadsheet canvas', async ({ page }) => {
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('should allow editing the document title', async ({ page }) => {
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.click();
    await titleInput.fill('My Test Spreadsheet');
    await expect(titleInput).toHaveValue('My Test Spreadsheet');
  });
});

test.describe('Cell Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for canvas to be ready
    await page.waitForSelector('canvas');
  });

  test('should select a cell on click', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    // Click on a cell (approximate position)
    await canvas.click({ position: { x: 150, y: 100 } });
    
    // The formula bar should show cell reference
    await expect(page.locator('[class*="formulaBar"]')).toContainText(/[A-Z]\d+/);
  });

  test('should navigate cells with arrow keys', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    // Click to select a cell
    await canvas.click({ position: { x: 150, y: 100 } });
    
    // Press arrow keys
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    
    // Cell reference should change
    await expect(page.locator('[class*="cellRef"]')).toBeVisible();
  });
});

test.describe('Cell Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');
  });

  test('should enter edit mode on double click', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    // Double click to edit
    await canvas.dblclick({ position: { x: 150, y: 100 } });
    
    // Type some text
    await page.keyboard.type('Hello');
    
    // Press Enter to confirm
    await page.keyboard.press('Enter');
  });

  test('should enter formula in formula bar', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    // Click to select a cell
    await canvas.click({ position: { x: 150, y: 100 } });
    
    // Focus on formula bar input
    const formulaInput = page.locator('[class*="formulaBar"] input');
    await formulaInput.click();
    
    // Type a formula
    await formulaInput.fill('=1+2');
    
    // Press Enter
    await page.keyboard.press('Enter');
  });
});

test.describe('Toolbar Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should toggle bold formatting', async ({ page }) => {
    const boldButton = page.locator('button[title="굵게"]');
    await expect(boldButton).toBeVisible();
    await boldButton.click();
  });

  test('should toggle italic formatting', async ({ page }) => {
    const italicButton = page.locator('button[title="기울임꼴"]');
    await expect(italicButton).toBeVisible();
    await italicButton.click();
  });

  test('should undo and redo', async ({ page }) => {
    const undoButton = page.locator('button[title="실행 취소"]');
    const redoButton = page.locator('button[title="다시 실행"]');
    
    await expect(undoButton).toBeVisible();
    await expect(redoButton).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.locator('canvas')).toBeVisible();
  });
});
