# API Response Comparator Safari Web Extension Source

This folder contains the browser-extension source that can be converted into a
Safari Web Extension with Xcode on macOS.

Safari distribution requires an Apple app wrapper. Use this source folder as the
input for Apple's Safari Web Extension Converter.

## Local Conversion On macOS

```bash
xcrun safari-web-extension-converter browser-extension/safari/web-extension \
  --project-location browser-extension/safari/xcode
```

Then open the generated Xcode project, configure signing, run the containing app,
and enable the extension in Safari.

## Current Scope

- Safari Web Extension popup source
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

## Notes

- This source fetches HTTPS API URLs directly using browser extension host
  permissions instead of the Next.js app server proxy.
- cURL imports are parsed into structured requests. Shell operators and
  file-based request bodies are rejected; browser-restricted headers are
  filtered before fetch.
- The popup script uses `browser` when available and falls back to `chrome` so
  the code stays portable across browser extension runtimes.
- The final Safari app/extension bundle must be created, signed, and archived
  with Xcode on macOS.
