# Deck Clipboard Images

Paste images from the clipboard directly into an open [Nextcloud Deck](https://github.com/nextcloud/deck) card. The image is uploaded as an ordinary Deck file attachment, so it can also be used as the card thumbnail. An image pasted into the card description or the comment field is also inserted at the cursor.

This is a small standalone Nextcloud app. It does not patch or replace Deck core files.

## Features

- Paste one or several clipboard images with `Ctrl+V` or `Cmd+V` while a Deck card is open.
- Inserts the image at the cursor when it is pasted into the card description or the comment field.
- Updates the attachment list, the attachment count and the card cover without reloading the page.
- Leaves normal text pasting unchanged when the clipboard contains no image.
- Uses the signed-in user's existing Nextcloud session, CSRF token, and Deck permissions.
- Gives each upload a unique millisecond-based filename.
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

4. Open a Deck card, copy an image, and paste it. The new attachment appears in the attachment list of the card.

The exact `occ` command and filesystem path vary between Docker, appliance, and package-based installations. Use the equivalent command for your deployment.

## How it works

The app loads a small JavaScript listener only on authenticated Deck pages. When the current route identifies an open card and the clipboard contains image files, it uploads them through Deck's existing attachment endpoint. Authorization and file handling remain with Nextcloud and Deck.

When the image is pasted into the card description or the comment field, the app waits for the upload and then inserts a link to the attachment preview at the cursor:

- The description editor (Nextcloud Text) receives a synthetic paste event carrying an HTML image link. It becomes a linked image in the description, and the editor saves it together with the text typed so far.
- The comment field receives the Markdown image syntax as typed text. Deck renders it as an image once the comment is posted.

In any other text field, or if the editor lost focus during the upload, the image is uploaded as an attachment only.

After every upload the app runs the `fetchAttachments` action of Deck's own store. Deck then loads the attachments of the card again and updates the attachment list, the attachment count and the cover image on the board, so the page is not reloaded.

If the Deck store cannot be reached, the app logs a warning to the browser console and falls back to a reload: automatically when no text field is being edited, otherwise through a manual reload button so unsaved text is not discarded.

## Limitations

- Inserted images use an absolute URL of the attachment preview, because the Text editor resolves a relative image source as a file path. The links stop working if the address of the Nextcloud instance changes.
- On Nextcloud 34 (tested with Text 8.0.1) the Text editor does not display images in the Deck description and shows a loading placeholder instead. The same happens with images added through Deck's own "Add attachment" action. The image link is still saved and the attachment is listed. On Nextcloud 35 the image is displayed.
- Deck has no public API for refreshing attachments, so the app reaches Deck's store through Vue internals (Vuex in Deck 1.18, Pinia in Deck 1.19). If a Deck update changes that, the app falls back to reloading the page.
- Browser clipboard support varies. The app requires the browser to expose the copied image as a clipboard file.
- Version `0.1.1` has only been verified on the versions listed above.
- User-interface messages are currently in English only.

## Validation and packaging

On Windows with Node.js and PowerShell available:

```powershell
.\scripts\Test-Package.ps1
.\scripts\Build-Package.ps1
```

`Test-Package.ps1` checks the manifest, required files, JavaScript syntax, route handling, image selection, filename generation, upload URL, preview URL, editor insertion, attachment refresh, request token, and form data. If you have a local Nextcloud `app-info.xsd`, pass it explicitly with `-NextcloudSchema`.

## Upstream context

The long-running feature request is [nextcloud/deck#533](https://github.com/nextcloud/deck/issues/533), and an upstream implementation is under review in [nextcloud/deck#8042](https://github.com/nextcloud/deck/pull/8042). This app is an immediately usable bridge for current Nextcloud 34 installations; native upstream support remains preferable in the long term.

## Contributing and security

Bug reports and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Please report security issues through GitHub's private vulnerability reporting instead of a public issue; see [SECURITY.md](SECURITY.md).

## License

Copyright © 2026 Hjort Creations AB. Licensed under the [GNU Affero General Public License v3.0 or later](LICENSE).

Nextcloud and Deck are trademarks of their respective owners. This community app is not affiliated with or endorsed by Nextcloud GmbH.
