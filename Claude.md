# Claude Instructions

This repository is API Response Comparator, a small Next.js and TypeScript app for comparing two JSON API responses.

## What To Know First

The app takes two text inputs:

- `JSON A`: original response
- `JSON B`: new response

Then it:

```text
parses JSON -> flattens paths -> compares values -> renders DiffEntry[] in a table
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
  lib/
    compare.ts
    flatten.ts
  types/
    diff.ts

test/
  app/
  lib/
  types/
```

Tests should stay under `test/` and mirror the `src/` hierarchy.

## Coding Guidance

- Keep `flatten` behavior in `src/lib/flatten.ts`.
- Keep comparison behavior in `src/lib/compare.ts`.
- Keep UI behavior in `src/app/page.tsx` unless the UI becomes large enough to split.
- Keep shared type changes in `src/types`.
- Avoid changing public behavior without updating tests.
- Prefer clear, direct TypeScript over extra abstraction.
- Do not move tests back into `src`.

## UI Guidance

- Preserve accessible labels for the JSON textareas.
- Test UI behavior with React Testing Library using labels, roles, and visible text.
- Keep the results table focused on `Path`, `Type`, `JSON A`, and `JSON B`.
- Show parse errors instead of trying to compare invalid JSON.

## Verification

Use these commands before completing changes:

```bash
npm test
npm run lint
npm run build
```

## Security Note

The project uses an npm `overrides` entry for `postcss` to ensure a patched version is installed. Keep this unless dependency updates make it unnecessary and verification still passes.
