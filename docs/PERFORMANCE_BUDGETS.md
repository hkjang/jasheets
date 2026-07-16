# Large-sheet performance budgets

JaSheets treats large-sheet responsiveness as a release gate. The automated
scenario uses 100,000 rows, 1,000 columns, and 2,000 formula cells.

| Operation | Budget | Guarantee |
| --- | ---: | --- |
| Build viewport indexes and locate a visible window | 500 ms | Rendering work remains proportional to visible cells |
| Recalculate the dependency closure after one cell changes | 1,500 ms | Unrelated formula values are not evaluated |

Run the gate locally with `pnpm test:performance`. Budgets measure only the
operation under test, excluding Jest startup and TypeScript transformation.
GitHub Actions runs the same command on Linux with Node.js 20.

When a budget needs to change, include benchmark evidence and the affected
sheet shape in the pull request. Do not raise a threshold solely to make a
regression pass.
