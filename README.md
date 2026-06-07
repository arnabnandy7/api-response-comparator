[![Test Status](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/test.yml/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/arnabnandy7/api-response-comparator/blob/main/LICENSE)
[![CodeQL Advanced](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/codeql.yml/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/codeql.yml)
[![Dependabot Updates](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/dependabot/dependabot-updates)
[![Remove Stale Branches](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/stale-branches.yml/badge.svg)](https://github.com/arnabnandy7/api-response-comparator/actions/workflows/stale-branches.yml)

# API Response Comparator

A Next.js application for comparing JSON API responses across Dev, QA, and Prod.
Use any two or all three environments, then inspect value and contract differences
in a table or color-coded JSON tree.

```text
Paste, upload, fetch, or import cURL
-> Parse JSON
-> Flatten nested paths
-> Compare active environments against the first populated environment
-> Filter, inspect, copy, or export DiffEntry[]
```

## Features

- Dev, QA, and Prod inputs with any two environments required
- Manual JSON paste, formatting, file upload, and per-input clear controls
- Direct HTTPS API fetching through the server-side proxy
- Safe cURL import for common methods, headers, authentication, cookies, and bodies
- Exclusive URL and cURL execution modes
- `ADDED`, `REMOVED`, `CHANGED`, and `TYPE_CHANGE` detection
- Separate result rows when one path has different outcomes across environments
- API contract warning for added, removed, or type-changed fields
- Scoring-based volatile-field detection and generated ignore rules
- Difference counts that act as type filters
- Case-insensitive path search
- Table and collapsible JSON tree views
- Color-coded tree highlights for each difference type
- Copy result JSON to the clipboard
- Download results as JSON or a styled Excel workbook
- Full-page reset, including inputs, uploads, filters, results, and pending requests
- Light and dark themes
- Accessible labels, controls, result table, and status messages
- Vitest, React Testing Library, route, utility, and type-contract tests

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Undici
- ExcelJS
- Vitest
- React Testing Library

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No environment variables or hostname allowlist are required. Remote requests are
validated dynamically by the proxy.

## Usage

### Manual JSON or Files

1. Paste or upload JSON for at least two of Dev, QA, and Prod.
2. Optionally format the populated inputs.
3. Optionally enter comma-separated ignore field names or generate suggestions.
4. Click **Compare**.

### Direct API URLs

1. Enter HTTPS URLs for at least two environments.
2. Click **Fetch & Compare**.

This mode reads only the API URL fields.

### cURL Import

1. Paste cURL commands for at least two environments.
2. Click **Import cURL & Compare**.

This mode reads only the cURL fields. Commands are parsed as structured request
data and sent through `/api/proxy`; the application never invokes a shell.

Example:

```bash
curl --location 'https://jsonplaceholder.typicode.com/todos/1' \
  --header 'Accept: application/json'
```

Supported cURL behavior includes:

- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `HEAD`
- `-X` / `--request`
- `-H` / `--header`
- `-d`, `--data`, `--data-raw`, `--data-binary`, and `--data-ascii`
- `-G` / `--get`
- `-u` / `--user`
- `-b` / `--cookie`
- `-A` / `--user-agent`
- `-e` / `--referer`
- `-L` / `--location`, `--compressed`, and silent flags

Shell operators, file-based request bodies such as `@payload.json`, unsupported
options, and multiple URLs in one command are rejected.

## Comparison Model

The first populated environment in Dev, QA, Prod order is the baseline:

- Dev is the baseline when Dev is populated.
- QA becomes the baseline when Dev is blank.
- Prod can be omitted without creating false removals.

Each active downstream environment is compared with the baseline. Differences
with the same path and type are combined into one row. Different outcomes remain
separate rows.

For example:

```text
Dev:  100
QA:   "100"
Prod: 200
```

produces:

```text
amount | TYPE_CHANGE | 100 | "100" | -
amount | CHANGED     | 100 | -     | 200
```

## Diff Format

```ts
export interface DiffEntry {
  path: string;
  type: 'ADDED' | 'REMOVED' | 'CHANGED' | 'TYPE_CHANGE';
  devValue?: unknown;
  qaValue?: unknown;
  prodValue?: unknown;
}
```

- `ADDED`: the path is absent from the baseline and present downstream.
- `REMOVED`: the path is present in the baseline and absent downstream.
- `CHANGED`: the path exists in both with the same JSON type but different values.
- `TYPE_CHANGE`: the path exists in both with different JSON types.

Nested objects use dot paths such as `user.name`. Arrays use indexed paths such
as `orders[0].amount`.

## Ignore Rules

Ignore fields are comma-separated leaf field names. Matching path segments are
excluded from comparison.

**Generate Ignore Rules** scores only `CHANGED` entries using:

- volatile field-name patterns
- UUID, date/time, epoch, identifier, and token-like value patterns
- noisy path categories such as metadata, headers, audit, debug, and links
- repeated normalized paths across arrays

Fields crossing the threshold are suggested with a score, confidence, and reason.
Changing any source JSON clears generated suggestions and stale results.

## Results

- Count buttons filter by result type.
- **Show all** removes the type filter.
- Path search combines with the active type filter.
- Table view displays Path, Type, Dev, QA, and Prod.
- Tree view displays one collapsible tree per environment.
- Added values are green, removed values red, changed values amber, and type
  changes purple.
- Copy, JSON download, and Excel download export the full unfiltered result set.
- **Reset** returns the whole page to its initial state and invalidates pending
  URL or cURL responses.

## Proxy Security

`/api/proxy` supports:

- `GET /api/proxy?url=...` for direct URL fetches
- `POST /api/proxy` with a structured request for cURL imports

The proxy:

- permits HTTPS only
- rejects URL credentials, custom ports, direct IPs, localhost, and non-public IPs
- resolves DNS server-side and pins connections through a custom Undici agent
- validates every redirect and removes authorization/cookies across origins
- follows at most five redirects
- allows only common API methods
- strips unsafe hop-by-hop request headers
- limits request bodies to 1 MB and responses to 50 MB
- applies a 30-second timeout
- returns actionable upstream status and network error details

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
```

`npm run build` also runs Next.js TypeScript validation.

## Project Structure

```text
src/
  app/
    page.tsx                 Main UI and interaction state
    api/proxy/route.ts       Secured URL and structured-request proxy
  components/
    theme-provider.tsx
    theme-toggle.tsx
  lib/
    compare.ts               Three-environment comparison logic
    curl.ts                  Safe cURL tokenizer and parser
    flatten.ts               JSON path flattening
    ignore-rules.ts          Volatility scoring and suggestions
  types/
    diff.ts                  Shared DiffEntry contract

test/
  app/                       UI tests
  app/api/proxy/             Proxy route tests
  lib/                       Comparison, cURL, flatten, and ignore tests
  types/                     Type-contract tests
```

## Notes

- Arrays are compared by index.
- Object key order does not affect flattened path comparison.

<!-- GitAds-Verify: 9C2Q9OU3CBG3347B8TSLS61O4NQBT9KA -->
- Empty objects and arrays remain comparable values.
- Invalid JSON and non-JSON remote responses are reported without comparison.
- `package.json` pins patched `postcss` and `uuid` versions through npm overrides.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for repository conventions and required
verification.

## GitAds Sponsored
[![Sponsored by GitAds](https://gitads.dev/v1/ad-serve?source=arnabnandy7/api-response-comparator@github)](https://gitads.dev/v1/ad-track?source=arnabnandy7/api-response-comparator@github)

