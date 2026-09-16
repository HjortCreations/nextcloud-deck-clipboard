# Contributing

Thank you for helping improve Deck Clipboard Images.

## Before opening a change

- Search existing issues first.
- Keep changes focused on clipboard image uploads for Nextcloud Deck.
- Do not include credentials, customer data, server addresses, or deployment-specific paths.
- Preserve normal text paste behavior and existing Deck permissions.

## Validate a change

Run the local checks from PowerShell:

```powershell
.\scripts\Test-Package.ps1
.\scripts\Build-Package.ps1
```

Also test the packaged app on a non-production Nextcloud instance before proposing a wider compatibility range.

## Pull requests

Explain the behavior being changed, the Nextcloud and Deck versions used for testing, and any security or compatibility implications. By contributing, you agree that your contribution is licensed under AGPL-3.0-or-later.
