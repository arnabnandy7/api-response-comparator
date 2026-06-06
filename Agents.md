# Agent Instructions

Use this file as project guidance for automated coding agents working on API Response Comparator.

## Project Summary

This is a Next.js app that compares two JSON API responses.

Core flow:

```text
Parse JSON or fetch remote JSON
-> Flatten nested paths
-> Compare flattened values
-> Display DiffEntry[] in a table
```

The app supports:

- manual paste entry for `JSON A` and `JSON B`
- JSON file uploads for each response
- remote API URL fetching via `/api/proxy`
- ignore-field filtering during comparison
- copy diff output to clipboard
- download styled Excel reports
- light/dark theme toggling

## Important Files

- `src/app/page.tsx`: main UI and user interaction
- `src/app/api/proxy/route.ts`: server-side proxy route for fetching external JSON URLs
- `src/components/theme-toggle.tsx`: theme toggle button for light/dark mode
- `src/components/theme-provider.tsx`: theme provider wrapper
- `src/lib/flatten.ts`: converts JSON values into path-value pairs
- `src/lib/compare.ts`: compares flattened JSON values and supports ignore keys
- `src/types/diff.ts`: shared `DiffEntry` type
- `test/`: test suite mirroring the `src/` hierarchy

## Development Rules

- Keep comparison logic in `src/lib`.
- Keep shared types in `src/types`.
- Keep tests under `test/`, not colocated inside `src`.
- Mirror source hierarchy when adding tests:

```text
src/app/page.tsx              -> test/app/page.test.tsx
src/app/api/proxy/route.ts    -> test/app/api/proxy/route.test.ts
src/lib/compare.ts            -> test/lib/compare.test.ts
src/lib/flatten.ts            -> test/lib/flatten.test.ts
src/types/diff.ts             -> test/types/diff.test.ts
```

- Prefer small, focused changes.
- Avoid unrelated refactors.
- Preserve accessibility in the UI. Labels should be associated with controls.
- Use visible UI behavior in React Testing Library tests.
- For route handlers, prefer node-compatible test environments and stub `fetch` appropriately.

## Commands

Run tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

For meaningful code changes, run all three before finishing.

## Comparator Contract

`JSON A` is the original value. `JSON B` is the new value.

`compareJson(jsonA, jsonB, ignoreKeys?)` returns:

```ts
DiffEntry[]
```

Supported diff types:

- `ADDED`: path exists only in `JSON B`
- `REMOVED`: path exists only in `JSON A`
- `CHANGED`: path exists in both, but values differ

The app flattens nested objects and arrays so differences appear as paths like `user.name` or `items[0].price`.

## Dependency Note

`package.json` includes a PostCSS override so npm resolves a patched PostCSS version while using the current Next.js release. Do not remove it unless Next.js no longer needs it and `npm audit` stays clean.
