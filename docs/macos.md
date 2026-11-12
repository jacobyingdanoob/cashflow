# Cashflow 1.2.0 — Mac guide

Download [Cashflow-1.2.0-macos-universal.zip](https://github.com/jacobyingdanoob/cashflow/releases/download/v1.2.0/Cashflow-1.2.0-macos-universal.zip) from the [v1.2.0 release](https://github.com/jacobyingdanoob/cashflow/releases/tag/v1.2.0). The universal application contains both Apple Silicon and Intel binaries.

## Install and open

1. Extract the ZIP in Finder.
2. Move **Cashflow.app** into **Applications**.
3. Open Cashflow. It includes the game, runtime and fonts, and plays offline without Node.js or a separate browser.

The application has an ad-hoc signature for local execution. It is not signed with an Apple Developer ID or notarized, so macOS may require you to review and approve opening it. The release includes `SHA256SUMS-macos.txt` to verify the download with `shasum -a 256 Cashflow-1.2.0-macos-universal.zip`.

On first launch, **Welcome to Cashflow** explains the goal and this edition's adaptations. Choose **Get started** to continue to your role and optional tutorials. It appears once per local profile; reopen it from **How to play → About Cashflow & this edition**. Reading the introduction pauses play and does not reset a saved match.

## Saves and updates

Saves are stored in `~/Library/Application Support/Cashflow`, independently of the app bundle. Quit Cashflow before replacing the application or backing up that folder. Browser and Windows saves are separate and do not transfer automatically. Older save formats remain supported; legacy matches keep their earlier rules.

The Mac menu supports standard application, editing and window commands. Closing the game window leaves the application in the Dock; clicking its Dock icon reopens the game. Use **Cashflow → Quit Cashflow** or **Command+Q** to quit.

## Build and verification

On a Mac with Node.js 22.12+ or 24+:

```sh
npm ci
npm run desktop:build:mac
npm run desktop:smoke:mac
```

The build creates `release/Cashflow-1.2.0-macos-universal.zip`. The Mac smoke test extracts that actual archive, checks both binary architectures and the signature, launches the application with a disposable save profile, verifies the first-launch introduction, plays a turn offline, and reopens the saved game. It also loads Market, Wiki and Rulebook. The GitHub Actions workflow repeats these steps on a hosted Mac before attaching the download to a draft release.
