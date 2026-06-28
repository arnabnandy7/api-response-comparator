# API Response Comparator Chrome Extension

This is the Chrome-first browser extension version of API Response Comparator.
It is intentionally kept separate from the Next.js app and has no build step.

## Load Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `browser-extension/chrome`.

## Current Scope

- Manifest V3 Chrome extension popup
- Manual JSON paste, format, file upload, and per-input clear controls
- Direct HTTPS URL fetch comparison from the extension popup
- Safe cURL parsing and structured browser fetch execution
- Optional Dev, QA, and Prod comparison with any two inputs
- Ignore leaf fields and volatility-based ignore suggestions
- `ADDED`, `REMOVED`, `CHANGED`, and `TYPE_CHANGE` rows
- Separate rows when one path has different outcome types
- Contract-change alert
- Diff counts, type filters, and path search
- Table view and color-coded JSON tree view
- Copy, JSON download, and Excel-compatible `.xls` download
- Full reset with in-flight URL and cURL request invalidation
- Light and dark themes
- Local draft persistence with `chrome.storage.local`

## Notes

- This extension fetches HTTPS API URLs directly using Chrome extension host
  permissions instead of the Next.js app server proxy.
- cURL imports are parsed into structured requests. Shell operators and
  file-based request bodies are rejected; browser-restricted headers are
  filtered before fetch.
- The Excel export is an Excel-compatible `.xls` table so the extension can stay
  dependency-free and load unpacked without a build step.
- Firefox, Edge, and other browser variants can be added under sibling folders
  once the Chrome behavior is settled.
