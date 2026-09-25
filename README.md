# Deck Clipboard Images

Paste images from the clipboard directly into an open [Nextcloud Deck](https://github.com/nextcloud/deck) card. The image is uploaded as an ordinary Deck file attachment, so it can also be used as the card thumbnail.

This is a small standalone Nextcloud app. It does not patch or replace Deck core files.

## Features

- Paste one or several clipboard images with `Ctrl+V` or `Cmd+V` while a Deck card is open.
- Leaves normal text pasting unchanged when the clipboard contains no image.
- Uses the signed-in user's existing Nextcloud session, CSRF token, and Deck permissions.
- Gives each upload a unique millisecond-based filename.
- Avoids reloading the card automatically while a text field is being edited.
- Adds no database tables and sends no data to external services.

## Compatibility

Version `0.1.1` is limited to the tested Nextcloud versions 34 and 35.

| Component | Tested version |
|---|---:|
| Nextcloud | 34.0.4, 35.0.0 |
| Deck | 1.18.4, 1.19.0 |

## Installation

1. Download `deckclipboard-0.1.1.zip` from the [v0.1.1 release](https://github.com/HjortCreations/nextcloud-deck-clipboard/releases/tag/v0.1.1), or build it from source.
2. Extract it in your Nextcloud `custom_apps` directory. The final directory must be named `deckclipboard`.
3. Enable the app:

   ```console
   sudo -u www-data php occ app:enable deckclipboard
   ```

4. Open a Deck card, copy an image, and paste it. The new attachment becomes visible after the card reloads.

The exact `occ` command and filesystem path vary between Docker, appliance, and package-based installations. Use the equivalent command for your deployment.

## How it works

The app loads a small JavaScript listener only on authenticated Deck pages. When the current route identifies an open card and the clipboard contains image files, it uploads them through Deck's existing attachment endpoint. Authorization and file handling remain with Nextcloud and Deck.

If a text editor is active, the app uploads the image but offers a manual reload button so unsaved text is not discarded. Otherwise it reloads the card automatically after a successful upload.

## Limitations

- Images are stored as attachments, not inserted inline into the card description or a comment.
- Browser clipboard support varies. The app requires the browser to expose the copied image as a clipboard file.
- Version `0.1.1` has only been verified on the versions listed above.
- User-interface messages are currently in English only.

## Validation and packaging

On Windows with Node.js and PowerShell available:

```powershell
.\scripts\Test-Package.ps1
.\scripts\Build-Package.ps1
```

`Test-Package.ps1` checks the manifest, required files, JavaScript syntax, route handling, image selection, filename generation, upload URL, request token, and form data. If you have a local Nextcloud `app-info.xsd`, pass it explicitly with `-NextcloudSchema`.

## Upstream context

The long-running feature request is [nextcloud/deck#533](https://github.com/nextcloud/deck/issues/533), and an upstream implementation is under review in [nextcloud/deck#8042](https://github.com/nextcloud/deck/pull/8042). This app is an immediately usable bridge for current Nextcloud 34 installations; native upstream support remains preferable in the long term.

## Contributing and security

Bug reports and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Please report security issues through GitHub's private vulnerability reporting instead of a public issue; see [SECURITY.md](SECURITY.md).

## License

Copyright © 2026 Hjort Creations AB. Licensed under the [GNU Affero General Public License v3.0 or later](LICENSE).

Nextcloud and Deck are trademarks of their respective owners. This community app is not affiliated with or endorsed by Nextcloud GmbH.
