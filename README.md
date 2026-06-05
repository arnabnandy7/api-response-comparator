![Website Deploy](https://deploy-badge.vercel.app/?url=http://www.nextjs.org/&name=api-response-comparator)
[![Tests Status](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/test.yml/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://github.com/arnabnandy7/api-response-comparator/blob/main/LICENSE)

# API Response Comparator

A Next.js app for comparing two JSON API responses. Paste `JSON A` and `JSON B`, run the comparison, and review the differences in a table.

The comparison flow is:

```text
Parse JSON
-> Flatten nested paths
-> Compare flattened values
-> Display DiffEntry[] in the UI
```

## Features

- Paste two JSON responses side by side
- Detect added, removed, and changed values
- Flatten nested objects and arrays into readable paths
- Display differences in a table with old and new values
- Show parse errors for invalid JSON
- Unit and UI tests with Vitest and Testing Library

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Vitest
- React Testing Library

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

```bash
npm run dev
```

Runs the app locally with Next.js.

```bash
npm run build
```

Creates a production build and runs TypeScript checks.

```bash
npm run start
```

Starts the production server after a successful build.

```bash
npm run lint
```

Runs ESLint.

```bash
npm test
```

Runs the Vitest test suite.

## Project Structure

```text
src/
  app/
    page.tsx       Main comparator UI
    layout.tsx     Root layout and metadata
    globals.css    Global styles
  lib/
    flatten.ts     Converts JSON into path-value pairs
    compare.ts     Produces DiffEntry[] from two JSON values
  types/
    diff.ts        DiffEntry type definition

test/
  app/             UI tests
  lib/             compare and flatten tests
  types/           type contract tests
```

## Diff Format

The comparator returns an array of `DiffEntry` objects:

```ts
export interface DiffEntry {
  path: string;
  type: 'ADDED' | 'REMOVED' | 'CHANGED';
  oldValue?: unknown;
  newValue?: unknown;
}
```

Examples:

- `ADDED`: path exists in `JSON B` but not in `JSON A`
- `REMOVED`: path exists in `JSON A` but not in `JSON B`
- `CHANGED`: path exists in both, but the values differ

## FAQ

### What counts as JSON A and JSON B?

`JSON A` is treated as the original response. `JSON B` is treated as the new response.

### How are nested values compared?

Nested objects are flattened into dot paths, and arrays use bracket paths. For example:

```json
{
  "user": {
    "roles": ["admin"]
  }
}
```

becomes:

```text
user.roles[0] = "admin"
```

### Why do I see `ADDED` or `REMOVED` for array items?

Arrays are compared by index. If `JSON B` has an extra item at `roles[1]`, that path is reported as `ADDED`.

### Does this ignore key order?

Yes for object structure, because values are compared by flattened paths. The current implementation compares leaf values with `JSON.stringify`, which is fine for JSON values coming from `JSON.parse`.

### What happens with invalid JSON?

The UI catches parse errors and displays the parser message instead of running the comparison.

### Why is there a PostCSS override?

`package.json` includes a `postcss` override so npm resolves a patched PostCSS version while using the current Next.js release.

## Contributing

See [contributor.md](./contributor.md) for local workflow, testing expectations, and project conventions.
