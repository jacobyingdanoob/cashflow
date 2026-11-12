# Cashflow 1.2.0 — browser guide

The browser, Mac and Windows x86 downloads run the same v1.2.0 game. The browser package is a static website with bundled fonts; playing does not require an account, backend, API key or external feed.

## Run the web download

1. Download [Cashflow-1.2.0-web.zip](https://github.com/jacobyingdanoob/cashflow/releases/download/v1.2.0/Cashflow-1.2.0-web.zip) and extract it.
2. With Node.js 22.12+ or 24+ installed, run `node serve.cjs` in the extracted folder.
3. Open `http://127.0.0.1:4173` in a modern browser. Keep the server running while playing; stop it with Ctrl+C when finished.

The included server needs no npm install and listens only on this computer. You can also use any static HTTP server. Serve `index.html` and `assets/` from the same site root; opening `index.html` directly from the filesystem does not reliably support the game's JavaScript modules.

## Run or build from source

```sh
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173`. For a production build, run `npm run build` and `npm run preview`. To host your own website, upload the contents of `dist/` to the site root. The default build expects `/assets/`; configure Vite's `base` before building for a subdirectory such as `/cashflow/`.

The GitHub repository contains source and release downloads. A GitHub Pages site is not currently configured.

To reproduce the downloadable archive on Windows, run `npm run build`, then `powershell -NoProfile -File scripts/package-web.ps1`. It creates `release/Cashflow-1.2.0-web.zip` with the build, local server and documentation.

## What's new

Version 1.2.0 adds a first-launch introduction explaining Cashflow's goal and this edition's additions to the original board game. It appears once per browser profile and site origin, before the role reveal and tutorials. Reopen it from **How to play → About Cashflow & this edition**. Reading it pauses play without resetting the match. This release also adds a [Mac application](macos.md).

The game retains v1.1.0's persistent markets and charts, economic trends, anytime sales and listings, purchase loans and debt limits, up to eight NPCs with equal starts, first-encounter tutorials, and complete transaction pages. See the [v1.2.0 notes](releases/v1.2.0.md), [v1.1.0 notes](releases/v1.1.0.md) and [README](../README.md#play) for details.

## Saves and upgrades

The game autosaves after every action and offers three named slots under **Save & resume**. Saves belong to the browser's site origin: changing the scheme, hostname or port creates a separate save area. Keep the same URL when replacing the web build. Clearing site data or using a temporary browsing session can remove saves.

Browser saves and desktop saves are separate. Version 1.2.0 reads earlier saves without resetting their finances or random state. Matches created before persistent markets retain their original market and economic-cycle rules; start a new game to use the complete new rules. Pending worksheets still require completion. Browser data is not uploaded to GitHub or synchronized between devices.
