# Agent Instructions

Use this file as project guidance for automated coding agents working on API
Response Comparator.

## Project Summary

This Next.js application compares JSON API responses across Dev, QA, and Prod.
Any two environments are sufficient.

```text
Paste, upload, fetch, or import cURL
-> Parse JSON
-> Flatten nested paths
-> Compare active environments against the first populated baseline
-> Display and export DiffEntry[]
```

Current features:

- manual JSON entry, formatting, upload, and clear controls
- direct HTTPS URL fetch comparison
- safe cURL parsing and structured proxy execution
- optional third environment
- ignore fields and scoring-based volatility suggestions
- `ADDED`, `REMOVED`, `CHANGED`, and `TYPE_CHANGE`
- separate rows for different outcomes on the same path
- contract-change alert
- count filters and path search
- table and color-coded JSON tree views
- copy, JSON download, and Excel download
- complete page reset with in-flight request invalidation
- light/dark themes

## Important Files

- `src/app/page.tsx`: UI, state, actions, exports, and result rendering
- `src/app/api/proxy/route.ts`: secured URL and structured-request proxy
- `src/components/theme-toggle.tsx`: theme control
- `src/components/theme-provider.tsx`: theme provider
- `src/lib/compare.ts`: three-environment comparison
- `src/lib/curl.ts`: safe cURL tokenizer and parser
- `src/lib/flatten.ts`: nested JSON path flattening
- `src/lib/ignore-rules.ts`: volatility scoring
- `src/types/diff.ts`: shared `DiffEntry`
- `test/`: mirrored test hierarchy

## Development Rules

- Keep comparison and parsing logic in `src/lib`.
- Keep shared types in `src/types`.
- Keep tests under `test/`, mirroring source paths.
- Prefer small, focused changes.
- Preserve accessibility and visible UI behavior.
- Use React Testing Library queries by label, role, and text.
- Use node-compatible route tests and stub Undici/browser fetch appropriately.
- Run tests, lint, and build for meaningful changes.

```bash
npm test
npm run lint
npm run build
```

## Comparator Contract

The first active environment in Dev, QA, Prod order is the baseline. Blank
environments are inactive and must not create false `REMOVED` entries.

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
interface DiffEntry {
  path: string;
  type: 'ADDED' | 'REMOVED' | 'CHANGED' | 'TYPE_CHANGE';
  devValue?: unknown;
  qaValue?: unknown;
  prodValue?: unknown;
}
```

- Compare each active downstream environment against the baseline.
- Combine entries only when path and type match.
- Preserve separate rows when one path has different outcome types.
- Arrays compare by index; paths look like `items[0].price`.
- Ignore rules match path segments by leaf field name.

## Input Modes

- **Compare** reads only populated JSON fields.
- **Fetch & Compare** reads only API URL fields.
- **Import cURL & Compare** reads only cURL fields.
- URL and cURL actions must remain exclusive and use independent loading state.
- Any two inputs in the selected mode are sufficient.
- Reset clears every mode and invalidates pending responses.

## Proxy Security

- HTTPS only
- no direct IP, localhost, URL credentials, or custom ports
- public DNS validation and pinned Undici connections
- redirect revalidation with credential stripping across origins
- method allowlist and unsafe header filtering
- 1 MB request-body and 50 MB response limits
- 30-second timeout
- no shell execution for cURL imports

## Dependency Note

Keep the patched `postcss` and `uuid` npm overrides unless dependency updates
make them unnecessary and all verification remains clean.
