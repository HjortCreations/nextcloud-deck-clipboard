# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- An image pasted into the card description or the comment field is inserted at the cursor after the upload.
- The attachment list is refreshed without a page reload after the image is inserted.

### Fixed

- Pasting an image into the comment field no longer reloads the card and discards the unsent comment.

## [0.1.1] - 2026-09-25

### Changed

- Added compatibility with Nextcloud 35 and Deck 1.19.0.
- Updated package validation to cover the tested Nextcloud 34–35 range.

## [0.1.0] - 2026-09-16

### Added

- Clipboard image upload for an open Nextcloud Deck card.
- Multiple-image paste support with unique millisecond-based filenames.
- Safe handling while a text field is being edited.
- Deck-only asset loading for authenticated users.
- Local validation, unit tests, and release packaging scripts.

[0.1.1]: https://github.com/HjortCreations/nextcloud-deck-clipboard/releases/tag/v0.1.1
[0.1.0]: https://github.com/HjortCreations/nextcloud-deck-clipboard/releases/tag/v0.1.0
