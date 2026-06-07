# Contributor Guide

Thanks for improving API Response Comparator. Keep changes focused, tested, and
consistent with the existing interaction model.

## Local Setup

```bash
npm install
npm run dev
```

The application compares any two or all three Dev, QA, and Prod responses using:

- manual JSON paste and formatting
- JSON file uploads
- direct HTTPS API URLs
- safely parsed cURL commands

Results support ignore rules, generated volatility suggestions, type filters,
path search, table/tree views, contract warnings, clipboard copy, JSON/Excel
downloads, themes, and full-page reset.

## Required Verification

Run all checks before opening a pull request:

```bash
npm test
npm run lint
npm run build
```

## Development Workflow

1. Create a branch for one focused change.
2. Read the affected source and existing tests first.
3. Keep comparison and parsing logic in `src/lib`.
4. Add or update tests under `test/`, mirroring `src`.
5. Preserve accessibility and visible UI behavior.
6. Run tests, lint, and the production build.
7. Update README, Agents, Claude, or contributor docs when behavior changes.

## Repository Layout

```text
src/app/page.tsx                 Main UI and interaction state
src/app/api/proxy/route.ts       Secured direct URL and cURL request proxy
src/lib/compare.ts               Dev/QA/Prod comparison
src/lib/curl.ts                  Safe cURL parsing
src/lib/flatten.ts               JSON path flattening
src/lib/ignore-rules.ts          Ignore suggestion scoring
src/types/diff.ts                Shared result contract

test/app/page.test.tsx
test/app/api/proxy/route.test.ts
test/lib/compare.test.ts
test/lib/curl.test.ts
test/lib/flatten.test.ts
test/lib/ignore-rules.test.ts
test/types/diff.test.ts
```

## Test Conventions

- Use Vitest for all tests.
- Use React Testing Library for UI behavior.
- Prefer labels, roles, and visible text over implementation details.
- Test route handlers in a node-compatible environment.
- Stub Undici or browser `fetch` at the transport boundary.
- Cover optional environments: any two sources must remain sufficient.
- Cover mixed outcomes where one path produces both `CHANGED` and `TYPE_CHANGE`.
- When adding an input mode, prove it does not trigger another transport mode.

## Comparator Contract

The first populated environment in Dev, QA, Prod order is the baseline. Inactive
environments must not create differences.

```ts
compareJson(
  devJson,
  qaJson,
  prodJson,
  ignoreFields?,
  comparedEnvironments?,
): DiffEntry[]
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

Each active downstream environment is compared to the baseline:

- `ADDED`: absent in baseline, present downstream
- `REMOVED`: present in baseline, absent downstream
- `CHANGED`: same JSON type, different value
- `TYPE_CHANGE`: different JSON type

Entries with the same path and type may combine environment values. Different
types for the same path must remain separate rows.

## Proxy and cURL Rules

- Never execute imported cURL commands in a shell.
- Parse cURL into URL, method, headers, and optional body.
- Keep URL fetch and cURL import actions exclusive.
- Preserve HTTPS-only and public-network SSRF checks.
- Revalidate redirects and strip credentials on cross-origin redirects.
- Do not weaken method, body-size, response-size, or timeout limits without tests.
- Surface useful upstream errors without exposing secrets.

## Code Conventions

- Keep TypeScript strict.
- Keep shared shapes in `src/types`.
- Keep UI state in `src/app/page.tsx` unless splitting clearly reduces complexity.
- Avoid unrelated refactors.
- Keep labels associated with controls.
- Preserve existing light/dark styling and keyboard behavior.
- Use `apply_patch` for focused manual edits.

## Dependency Overrides

`package.json` currently pins patched `postcss` and `uuid` versions through npm
overrides. Do not remove them unless dependency updates make them unnecessary and
the audit, tests, lint, and build remain clean.

## Pull Request Checklist

- Tests added or updated
- Optional two-source flow preserved
- URL and cURL transports remain exclusive
- Accessibility preserved
- `npm test` passes
- `npm run lint` passes
- `npm run build` passes
- Documentation updated for behavioral changes
