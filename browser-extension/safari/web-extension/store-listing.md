# Safari App Store Listing Draft

## Product Details

Name:
API Response Comparator

Subtitle:
Compare Dev, QA, and Prod JSON APIs.

Promotional text:
Compare JSON API responses from pasted JSON, uploaded files, HTTPS URLs, or safe cURL imports directly in Safari.

Description:
API Response Comparator helps developers and QA teams spot API response drift before it reaches users. Paste JSON, upload response files, fetch HTTPS API URLs, or import safe cURL commands, then compare Dev, QA, and Prod responses from a compact Safari Web Extension popup.

The first populated environment in Dev, QA, Prod order becomes the baseline. The extension flattens nested JSON paths and reports `ADDED`, `REMOVED`, `CHANGED`, and `TYPE_CHANGE` differences. Any two environments are enough, so you can compare Dev vs QA, QA vs Prod, or all three together.

Features:
- Manual JSON paste, format, upload, and clear controls
- Direct HTTPS URL fetch comparison
- Safe cURL parsing with structured browser fetch execution
- Optional third environment
- Ignore leaf fields and generate volatility-based ignore suggestions
- Separate rows when one path has different outcome types
- Contract-change alert for added, removed, or type-changed fields
- Count filters and path search
- Table and color-coded JSON tree views
- Copy, JSON download, and Excel-compatible export
- Full reset with in-flight request cancellation
- Light and dark themes

The extension runs locally in Safari. It does not use analytics, ads, tracking,
or a remote app backend.

Primary category:
Developer Tools

Language:
English

## Graphic Assets

Extension package icons:
- `assets/icons/icon-16.png`
- `assets/icons/icon-32.png`
- `assets/icons/icon-48.png`
- `assets/icons/icon-128.png`

Listing/source assets:
- `assets/store/store-icon-128.png`
- `assets/store/screenshot-1-json-compare-1280x800.png`
- `assets/store/screenshot-2-url-curl-1280x800.png`
- `assets/store/screenshot-3-tree-view-1280x800.png`
- `assets/store/small-promo-440x280.png`
- `assets/store/marquee-promo-1400x560.png`

App Store screenshots and app icons may need to be regenerated at Apple-specific
sizes from these source assets after the Xcode project is created.

## Privacy Practices

Single purpose:
Compare JSON API responses across Dev, QA, and Prod so developers can identify
response value changes and API contract changes.

Permission justification:

`storage`:
Stores draft inputs and UI preferences locally in Safari extension storage so
users do not lose in-progress comparisons when the popup closes.

`clipboardWrite`:
Lets the user copy generated diff JSON to the clipboard after clicking the Copy
button.

`https://*/*` host permission:
Allows the extension to fetch user-entered HTTPS API URLs and HTTPS cURL targets
for comparison. The extension only sends requests when the user clicks Fetch &
Compare or Import cURL & Compare.

Data collection disclosure:
The extension does not collect, sell, share, or transmit user data to the
developer or third-party analytics services. JSON payloads, URLs, cURL commands,
ignore fields, and UI preferences remain in the browser except when the user
explicitly fetches a user-entered HTTPS API endpoint.

Privacy policy summary:
API Response Comparator stores draft comparison inputs locally in the browser and
sends network requests only to HTTPS API endpoints the user provides. It does not
collect analytics, sell data, share data with the developer, or transmit
comparison data to a separate backend.

## Test Instructions

1. Convert this source folder with Xcode's Safari Web Extension Converter.
2. Run the containing app and enable the extension in Safari.
3. Open the extension popup.
4. In JSON mode, paste two JSON objects into Dev and QA, then click Compare.
5. Verify that the table reports changed paths and that Tree view highlights the
   changed values.
6. In URL mode, enter two HTTPS endpoints that return JSON and click Fetch &
   Compare.
7. In cURL mode, paste two HTTPS cURL commands and click Import cURL & Compare.
8. Verify Copy, JSON export, Excel export, ignore fields, path search, theme
   toggle, and Reset.
