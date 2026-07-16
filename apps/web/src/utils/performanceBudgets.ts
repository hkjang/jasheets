export const LARGE_SHEET_SCENARIO = {
  rows: 100_000,
  columns: 1_000,
  formulaCells: 2_000,
} as const;

export const PERFORMANCE_BUDGET_MS = {
  viewportIndex: 500,
  incrementalRecalculation: 1_500,
} as const;
