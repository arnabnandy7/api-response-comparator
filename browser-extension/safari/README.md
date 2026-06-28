# API Response Comparator Safari Extension

Safari Web Extensions are distributed as part of a native macOS/iOS app wrapper.
This repo contains the web extension source under `web-extension/`; the final
Safari extension bundle must be generated with Xcode on macOS.

## What Is Included

- `web-extension/`: Safari-compatible web extension source copied from the
  Chromium package.
- `web-extension/assets/`: icons, screenshots, and promotional source images.
- `web-extension/store-listing.md`: App Store listing, privacy, and reviewer
  notes draft.

## Convert With Xcode On macOS

From the repo root on macOS:

```bash
xcrun safari-web-extension-converter browser-extension/safari/web-extension \
  --project-location browser-extension/safari/xcode
```

Then:

1. Open the generated Xcode project.
2. Set bundle identifiers and signing team.
3. Run the containing app.
4. Open Safari settings and enable the extension.
5. Archive the app in Xcode for App Store Connect or TestFlight.

## Important Limitations In This Workspace

This Windows workspace can prepare the source package and assets, but it cannot
create, sign, archive, notarize, or upload the final Safari app bundle. Those
steps require Xcode on macOS and an Apple Developer account.

## Source Package

The source can be zipped and moved to a Mac for conversion. Make sure the zip
contains the contents of `web-extension/`, not an extra parent folder, when using
it as converter input.
