import { expect, test } from "@playwright/test";

const workbook = {
  id: "stability-workbook",
  name: "Render stability",
  sheets: [
    {
      id: "sheet-a",
      name: "Sheet 1",
      index: 0,
      version: 0,
      rowCount: 100,
      colCount: 26,
      cells: [{ row: 0, col: 0, value: "alpha", formula: null, format: null }],
      charts: [],
      rowMeta: [],
      colMeta: [],
      conditionalRules: [],
      mergedRanges: [],
    },
    {
      id: "sheet-b",
      name: "Sheet 2",
      index: 1,
      version: 0,
      rowCount: 100,
      colCount: 26,
      cells: [{ row: 0, col: 0, value: "beta", formula: null, format: null }],
      charts: [],
      rowMeta: [],
      colMeta: [],
      conditionalRules: [],
      mergedRanges: [],
    },
  ],
};

test("sheet switching never replaces the editor with a loading frame", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "e2e-token");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: "e2e-user", email: "e2e@example.com", name: "E2E" }),
    );
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path.includes("/comments") || path.includes("/filter-profiles")
        ? []
        : { version: 1 };
    await route.fulfill({ contentType: "application/json", json });
  });
  await page.route("**/api/sheets/stability-workbook", async (route) => {
    await route.fulfill({ contentType: "application/json", json: workbook });
  });

  await page.goto("/spreadsheet/stability-workbook");
  const canvas = page.getByRole("grid", { name: "Spreadsheet grid" });
  await expect(canvas).toBeVisible();

  await page.evaluate(() => {
    const grid = document.querySelector('canvas[role="grid"]');
    if (!grid) throw new Error("Spreadsheet canvas was not rendered");
    (
      window as typeof window & { __canvasResizeMutations?: number }
    ).__canvasResizeMutations = 0;
    new MutationObserver((records) => {
      const resizeCount = records.filter(
        ({ attributeName }) =>
          attributeName === "width" || attributeName === "height",
      ).length;
      (
        window as typeof window & { __canvasResizeMutations?: number }
      ).__canvasResizeMutations! += resizeCount;
    }).observe(grid, {
      attributes: true,
      attributeFilter: ["width", "height"],
    });

    (
      window as typeof window & { __loadingFrameSeen?: boolean }
    ).__loadingFrameSeen = false;
    (
      window as typeof window & { __transitionSnapshotSeen?: boolean }
    ).__transitionSnapshotSeen = false;
    new MutationObserver(() => {
      if (
        [...document.body.querySelectorAll("div")].some(
          (element) => element.textContent?.trim() === "Loading...",
        )
      ) {
        (
          window as typeof window & { __loadingFrameSeen?: boolean }
        ).__loadingFrameSeen = true;
      }
      if (document.querySelector('[data-sheet-transition="canvas-snapshot"]')) {
        (
          window as typeof window & { __transitionSnapshotSeen?: boolean }
        ).__transitionSnapshotSeen = true;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  await canvas.click({ position: { x: 150, y: 100 } });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __canvasResizeMutations?: number })
          .__canvasResizeMutations,
    ),
  ).toBe(0);

  await page.getByRole("tab", { name: "Sheet 2" }).click();
  await expect(canvas).toBeVisible();
  await expect(page.getByText("Loading...", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __loadingFrameSeen?: boolean })
          .__loadingFrameSeen,
    ),
  ).toBe(false);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __transitionSnapshotSeen?: boolean })
          .__transitionSnapshotSeen,
    ),
  ).toBe(true);
});

test("Ctrl+F searches the workbook and selects a match on another sheet", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "e2e-token");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: "e2e-user", email: "e2e@example.com", name: "E2E" }),
    );
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: "application/json",
      json:
        path.includes("/comments") || path.includes("/filter-profiles")
          ? []
          : { version: 1 },
    });
  });
  await page.route("**/api/sheets/stability-workbook", async (route) => {
    await route.fulfill({ contentType: "application/json", json: workbook });
  });
  await page.route(
    "**/api/sheets/stability-workbook/search?**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          spreadsheetId: workbook.id,
          query: "beta",
          mode: "values",
          matchCase: false,
          matches: [
            {
              sheetId: "sheet-b",
              sheetName: "Sheet 2",
              row: 0,
              col: 0,
              cell: "A1",
              value: "beta",
              formula: null,
              matchIn: ["value"],
            },
          ],
          hasMore: false,
          nextCursor: null,
        },
      });
    },
  );

  await page.goto("/spreadsheet/stability-workbook");
  await expect(
    page.getByRole("grid", { name: "Spreadsheet grid" }),
  ).toBeVisible();
  await page.keyboard.press("Control+f");
  const dialog = page.getByRole("dialog", { name: "찾기" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("찾을 내용").fill("beta");
  await dialog.getByLabel("검색 범위").selectOption("workbook");
  await dialog.getByLabel("찾을 내용").press("Enter");

  await expect(page.getByRole("tab", { name: "Sheet 2" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByPlaceholder("Enter value or formula")).toHaveValue(
    "beta",
  );
  await expect(page.getByText("Sheet 2!A1 · 1/1")).toBeVisible();
});
