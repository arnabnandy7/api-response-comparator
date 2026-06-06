# Contributor Guide

Thanks for improving API Response Comparator. This project is intentionally small, so contributions should keep the code clear, tested, and easy to reason about.

## Local Setup

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

The app supports:

- manual paste for `JSON A` and `JSON B`
- JSON file uploads for each response
- remote JSON fetch comparison using `API URL A` and `API URL B`
- ignore-field filtering during comparison
- copying diffs to the clipboard
- downloading diffs as an Excel spreadsheet
- light/dark theme toggling

## Verification

Run checks before opening a pull request:

```bash
npm test
npm run lint
npm run build
```

## Development Workflow

1. Create a branch for your change.
2. Keep changes focused on one feature or fix.
3. Add or update tests under `test/`, mirroring the `src/` hierarchy.
4. Run tests, lint, and build locally.
5. Open a pull request with a short summary and verification notes.

## Test Conventions

Tests live outside `src` under the `test` directory:

```text
test/app/             UI tests for src/app
test/app/api/proxy/    API route tests for src/app/api/proxy
test/lib/             Utility tests for src/lib
test/types/           Type contract tests for src/types
```

Use Vitest for all tests. Use React Testing Library for UI behavior and prefer user-visible queries such as labels, roles, and text. For route tests, use the node test environment and stub `fetch` as needed.

## Code Conventions

- Keep TypeScript strict and explicit where it helps readability.
- Keep comparison logic in `src/lib`.
- Keep shared data shapes in `src/types`.
- Keep UI state and rendering in `src/app/page.tsx` unless the UI grows enough to justify splitting into components.
- Keep proxy or route-specific logic in `src/app/api/proxy/route.ts`.
- Avoid unrelated refactors in feature or bug-fix changes.
- Preserve accessibility in the UI; labels should be connected to inputs and controls.

## Comparator Behavior

The current comparison model is:

```text
JSON A = original value
JSON B = new value
```

The app parses both inputs or fetches remote JSON, flattens nested values, compares flattened paths, and renders `DiffEntry[]`.

Supported diff types:

- `ADDED`: present only in `JSON B`
- `REMOVED`: present only in `JSON A`
- `CHANGED`: present in both, but values differ

## Pull Request Checklist

- Tests added or updated for behavior changes
- `npm test` passes
- `npm run lint` passes
- `npm run build` passes
- README, Agents, or Claude docs updated when behavior or workflow changes
