# Claude Instructions

This repository is API Response Comparator, a Next.js and TypeScript app for
comparing JSON responses across Dev, QA, and Prod.

## Core Behavior

Any two environments are enough. The first populated environment in Dev, QA,
Prod order is the baseline.

```text
input JSON, files, URLs, or cURL
-> parse JSON
-> flatten nested paths
-> compare each active downstream environment with the baseline
-> render DiffEntry[] in table or tree form
```

```ts
export interface DiffEntry {
  path: string;
  type: 'ADDED' | 'REMOVED' | 'CHANGED' | 'TYPE_CHANGE';
  devValue?: unknown;
  qaValue?: unknown;
  prodValue?: unknown;
}
```

A path may appear more than once when environments have different outcomes. For
example, QA can produce `TYPE_CHANGE` while Prod produces `CHANGED`.

## Repository Layout

```text
src/
  app/
    page.tsx
    api/proxy/route.ts
  components/
    theme-provider.tsx
    theme-toggle.tsx
  lib/
    compare.ts
    curl.ts
    flatten.ts
    ignore-rules.ts
  types/
    diff.ts

test/
  app/
  app/api/proxy/
  lib/
  types/
```

Tests stay under `test/` and mirror `src`.

## Coding Guidance

- Keep comparison, flattening, cURL parsing, and ignore scoring in `src/lib`.
- Keep shared contracts in `src/types`.
- Keep route security in `src/app/api/proxy/route.ts`.
- Keep UI behavior in `src/app/page.tsx` unless splitting clearly helps.
- Preserve optional environments and mixed-outcome rows.
- Avoid public behavior changes without tests and documentation.
- Prefer direct, strict TypeScript over unnecessary abstraction.

## UI Guidance

- Preserve accessible labels and keyboard behavior.
- Keep Dev, QA, and Prod result columns.
- Keep URL fetch and cURL import transport-exclusive.
- Keep type filters, path search, contract warning, and table/tree views.
- Keep copy, JSON export, Excel export, generated ignore rules, themes, uploads,
  clear controls, and full reset.
- Reset must prevent pending requests from repopulating cleared state.

## cURL and Proxy Guidance

cURL commands are parsed as data; never execute a shell. The structured proxy
supports common API methods, headers, and bodies while enforcing:

- HTTPS and public-network destinations only
- no direct IPs, localhost, URL credentials, or custom ports
- DNS validation and redirect revalidation
- credential removal on cross-origin redirects
- request/response size and timeout limits
- unsafe header filtering

Error messages should preserve useful upstream status or network details.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Dependency Note

`package.json` pins patched `postcss` and `uuid` versions through npm overrides.
Keep them unless updates make them unnecessary and verification remains clean.
