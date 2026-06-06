# Claude Instructions

This repository is API Response Comparator, a small Next.js and TypeScript app for comparing two JSON API responses.

## What To Know First

The app takes two JSON inputs:

- `JSON A`: original response
- `JSON B`: new response

It also supports two remote JSON URLs:

- `API URL A`
- `API URL B`

Then it:

```text
parse JSON or fetch remote JSON
-> flatten nested paths
-> compare flattened values
-> display DiffEntry[] in a table
```

The core data shape is:

```ts
export interface DiffEntry {
  path: string;
  type: 'ADDED' | 'REMOVED' | 'CHANGED';
  oldValue?: unknown;
  newValue?: unknown;
}
```

## Repository Layout

```text
src/
  app/
    page.tsx
    layout.tsx
    globals.css
    api/
      proxy/route.ts
  components/
    theme-provider.tsx
    theme-toggle.tsx
  lib/
    compare.ts
    flatten.ts
  types/
    diff.ts

test/
  app/
    api/
      proxy/route.test.ts
    page.test.tsx
  lib/
  types/
```

Tests should stay under `test/` and mirror the `src/` hierarchy.

## Coding Guidance

- Keep `flatten` behavior in `src/lib/flatten.ts`.
- Keep comparison behavior in `src/lib/compare.ts`.
- Keep UI behavior in `src/app/page.tsx` unless it becomes large enough to split.
- Keep shared type changes in `src/types`.
- Avoid changing public behavior without updating tests.
- Prefer clear, direct TypeScript over extra abstraction.
- Do not move tests back into `src`.
- For route handlers, keep tests in a node-compatible environment and stub `fetch`.

## UI Guidance

- Preserve accessible labels for inputs and controls.
- Test UI behavior with React Testing Library using labels, roles, and visible text.
- Keep the results table focused on `Path`, `Type`, `JSON A`, and `JSON B`.
- Show parse errors rather than attempting a comparison on invalid JSON.
- Support file uploads, URL fetch comparison, ignore-field filtering, copy diff, and Excel export.

## Verification

Use these commands before completing changes:

```bash
npm test
npm run lint
npm run build
```

## Security Note

The project uses an npm `overrides` entry for `postcss` to ensure a patched version is installed. Keep this unless dependency updates make it unnecessary and verification still passes.
