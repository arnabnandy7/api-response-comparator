# API Response Comparator Firefox Extension

This is the Firefox browser extension version of API Response Comparator.
It is kept separate from the Next.js app and can be loaded without a build step.
The manifest is configured for Firefox desktop and Firefox for Android.

## Install

Install API Response Comparator from
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/api-response-comparator/).

## Load Temporarily

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `browser-extension/firefox/manifest.json`.

Temporary add-ons are removed when Firefox restarts.

## Current Scope

- Manifest V3 Firefox extension popup
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
- Local draft persistence with extension storage
- Firefox for Android metadata and responsive popup layout

## Notes

- This extension fetches HTTPS API URLs directly using browser extension host
  permissions instead of the Next.js app server proxy.
- cURL imports are parsed into structured requests. Shell operators and
  file-based request bodies are rejected; browser-restricted headers are
  filtered before fetch.
- The popup script uses `browser` when available and falls back to `chrome` so
  the code stays portable across Chromium and Firefox extension runtimes.
- The manifest declares no transmitted data collection with
  `browser_specific_settings.gecko.data_collection_permissions.required:
  ["none"]`.
- The Excel export is an Excel-compatible `.xls` table so the extension can stay
  dependency-free and load without a build step.
