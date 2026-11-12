# Cashflow 1.2.0 — Windows x86 guide

Download [Cashflow-1.2.0-windows-x86.exe](https://github.com/jacobyingdanoob/cashflow/releases/download/v1.2.0/Cashflow-1.2.0-windows-x86.exe) from the [v1.2.0 release](https://github.com/jacobyingdanoob/cashflow/releases/tag/v1.2.0) and double-click it. This portable 32-bit app supports Windows 10 and later, including 64-bit Windows. It includes the game, fonts and runtime; no installation, administrator access, Node.js, separate browser or internet connection is required to play.

## What's new

The executable contains the same game as the v1.2.0 browser and Mac builds. A first-launch introduction explains Cashflow's goal and this edition's additions to the original board game before the role reveal and optional tutorials. It appears once per local profile; reopen it from **How to play → About Cashflow & this edition**. Reading it pauses play and preserves saved matches.

Markets, trading, lending, NPCs and accounting retain their v1.1.0 rules. See the [v1.2.0 notes](releases/v1.2.0.md) and [v1.1.0 notes](releases/v1.1.0.md).

## Upgrade from an earlier release

Close the old app before opening v1.2.0. The executable extracts its runtime into a temporary folder on each launch and keeps saves separately in `%APPDATA%\Cashflow`. Moving or replacing the executable does not move that save folder. You can back up that folder while the app is closed.

Existing saves remain readable. Earlier matches keep their original market and cycle rules; start a new match for the complete current rules. Avoid opening newer saves in an older executable. Browser saves are separate and do not transfer automatically. Upgrading shows the introduction once without resetting your match.

## Verify the download

The release includes `SHA256SUMS.txt` for the Windows and browser downloads, plus `SHA256SUMS-macos.txt` for Mac. In PowerShell, run:

```powershell
Get-FileHash .\Cashflow-1.2.0-windows-x86.exe -Algorithm SHA256
```

Compare the hash with the matching line in `SHA256SUMS.txt`. The executable is unsigned, so Windows may display an unknown-publisher warning.

## Build and verify from source

On Windows with Node.js 22.12+ or 24+ installed:

```sh
npm ci
npm run desktop:build
npm run desktop:smoke
```

The build writes `release/Cashflow-1.2.0-windows-x86.exe`. The smoke test launches that executable with an isolated save profile, verifies x86 PE headers for the launcher and runtime, blocks network requests, plays a turn, and checks save restoration after reopening. It does not alter normal saves. Screenshots are written to `test-results/desktop/`.

To check migration from a downloaded v1.0.0 executable, set `CASHFLOW_UPGRADE_FROM` to its absolute path before running the smoke test. It creates a disposable save in v1.0.0, then opens it in v1.2.0 and verifies its player data and legacy market rules.

The app uses Electron 43.8.7, the final Electron series supporting Windows x86. Electron 43 support ends in January 2027; later Electron versions require a 64-bit build.
