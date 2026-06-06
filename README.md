![Website Deploy](https://deploy-badge.vercel.app/?url=http://www.nextjs.org/&name=api-response-comparator)
[![Test Status](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/test.yml/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/arnabnandy7/api-response-comparator/blob/main/LICENSE)[![CodeQL Advanced](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/codeql.yml/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/codeql.yml)[![Dependabot Updates](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/dependabot/dependabot-updates)[![Remove Stale Branches](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/stale-branches.yml/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/stale-branches.yml)

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
- Fetch and compare two remote JSON API URLs directly
- Upload JSON files for Response A and Response B
- Detect added, removed, and changed values
- Optionally ignore specific fields during comparison
- Copy diff output as JSON to clipboard
- Download diff results as a styled Excel spreadsheet
- Light/dark theme toggle
- Flatten nested objects and arrays into readable paths
- Display results in an accessible diff table
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

Create `.env.local` from `.env.example` and list each remote API hostname the
server may contact:

```bash
ALLOWED_PROXY_HOSTS=www.elevation-api.eu,api.example.com
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. Paste JSON into `JSON A` and `JSON B`, or upload files using the upload buttons.
2. Optionally enter `API URL A` and `API URL B` to fetch remote JSON responses.
3. Use `Ignore fields` to exclude sensitive or irrelevant keys from the diff.
4. Click `Compare` or `Fetch & Compare`.
5. Copy the diff JSON or download an Excel report.

Remote URLs are fetched server-side through `/api/proxy`, which helps avoid
browser CORS restrictions for external JSON endpoints. For SSRF protection,
only HTTPS URLs on hosts listed in `ALLOWED_PROXY_HOSTS` are accepted.

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

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local workflow, testing expectations, and project conventions.
