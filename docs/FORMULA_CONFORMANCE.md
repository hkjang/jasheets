# Formula Conformance Suite

The web formula engine is checked against workbook-like fixtures in
`apps/web/src/utils/__fixtures__/formula-conformance.json`. Each case defines
input cells, optional named ranges and locale, a formula, and its expected
computed value or spreadsheet error.

Run the suite with:

```bash
pnpm --filter web test -- --runInBand src/utils/formula-conformance.test.ts
```

Add a fixture for every formula compatibility regression. Keep volatile
functions such as `NOW` under fake-clock unit tests rather than static
fixtures.
