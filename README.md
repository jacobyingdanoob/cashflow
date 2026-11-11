# Cashflow — a little strategy, a different life

A complete local browser playtest inspired by the CASHFLOW board-game mechanics. The city illustration, board, professions, and dreams are original. Original cards can optionally be joined by a sourced adaptation of the [Cash Flow Lifestyle encyclopedia](https://cashflow.lifestyle/encyclopedia/). Built with React, TypeScript, Vite, and SVG, with no backend, accounts, AI API, or paid services. Fonts are bundled locally.

## What's new in 1.1.0

- **Living markets:** stock, property and business charts, round-by-round price changes, economic trends, market shocks, shared discount offers and depressions.
- **More ways to trade:** sell stocks anytime, list property and businesses for later closing, and preview fees, taxes and financing before committing.
- **Updated lending:** 2% monthly bank loans, 1% Type 1 purchase loans, rising down-payment tiers and a 55% debt-to-income limit for new borrowing in new games.
- **Larger, fairer tables:** one to eight NPCs with distinct investing personalities, equal starting finances and individual dreams.
- **Clearer guidance and records:** first-encounter tutorials, a rulebook, complete paginated transaction history, read-only player inspection and risk-focused end-game coaching.
- **Web and Windows together:** both downloads contain the same v1.1.0 game. Existing saves remain supported; legacy matches retain their earlier market rules.

See the [v1.1.0 release notes](docs/releases/v1.1.0.md) for the changes and upgrade details.

## Browser version

Download [Cashflow-1.1.0-web.zip](https://github.com/jacobyingdanoob/cashflow/releases/download/v1.1.0/Cashflow-1.1.0-web.zip), extract it and serve the extracted folder through a local HTTP server or a static web host. The archive includes the built game, bundled fonts, a launch guide and a dependency-free Node.js server. Run `node serve.cjs` in that folder, then open `http://127.0.0.1:4173`. Keep the same browser, host and port to retain access to existing browser saves.

See the [browser guide](docs/web.md) for setup, hosting and save behavior, or [Web development](#web-development) to run from source. This repository does not currently publish a GitHub Pages site.

## Windows desktop app (x86)

Download [Cashflow-1.1.0-windows-x86.exe](https://github.com/jacobyingdanoob/cashflow/releases/download/v1.1.0/Cashflow-1.1.0-windows-x86.exe) and double-click it. This is a portable 32-bit app for Windows 10 or later, including 64-bit Windows. It includes the game and its runtime, works offline, and requires no installation, Node.js, administrator access, or separate browser.

Each launch extracts the bundled runtime into a temporary folder. Saves remain in `%APPDATA%\Cashflow` when the app closes, moves, or updates. To upgrade from v1.0.0, close the old app and open the new executable; both use the same save folder. The desktop app has its own saves, separate from browser saves. The executable is unsigned. See the [Windows x86 guide](docs/windows-x86.md) for upgrade and verification details.

To build the same Windows executable from source:

```sh
npm ci
npm run desktop:build
npm run desktop:smoke
```

The executable is written to `release/`. The smoke test launches the actual portable executable, verifies both Windows binaries are x86, rolls the dice offline, and checks that saves survive reopening. Screenshots go to `test-results/desktop/`. `npm run desktop` runs the desktop app from source. The icon can be regenerated on Windows with `powershell -NoProfile -File desktop/generate-icon.ps1`.

The desktop wrapper uses Electron **43.8.7**. Electron 43 is the final series with Windows x86 binaries; its support ends in January 2027. Later Electron versions require a 64-bit desktop build.

## Web development

Requires Node.js 22.12+ or 24+ and npm.

```sh
npm install
npm run dev
```

Open the localhost URL printed in the terminal. Production build: `npm run build`; serve that build with `npm run preview`.

## Play

- A ready-to-play match opens with **four NPCs**, with **one to eight** selectable opponents. Choose **New game** to select your starting role difficulty, dream, accounting mode, opponents, victory mode, and sandbox settings.
- In **rounds 1–10**, the small-opportunity deck favors stocks and debt-free small businesses: each has **three copies per card**, compared with one per other card. A debt-free business has no included loan or financing payment; borrowing to fund the purchase is still the player's choice. At the first small draw from round 11, the deck resets to the regular one-copy mix. Everyone shares the same odds, including adapted cards when enabled.
- Roll, review investment opportunities, and collect monthly cash flow at Payday. Keep enough cash for life events. Use the financial statement to review investments or borrow and repay debt.
- Build passive income strictly greater than monthly expenses, then enter the Fast Track at the beginning of a turn. Choose financial-freedom victory for a shorter game, or continue to your dream/additional-income target.
- In **guided manual accounting**, enter the new totals for each affected field. Hints and revealed answers carry no penalty. Transactions commit once, only after validation. Pending worksheets and typed drafts survive refresh.
- Economic settings affect every participant equally and are fixed during a match. NPC difficulty, personality, and cash reserves affect decisions; opponents never receive better rolls or hidden deck information.
- Every completed NPC turn and human event produces a small bottom-right notification, including automatic expenses, family events, Payday, and market effects. Notifications dismiss after **30 seconds** or with their close button. Click to expand the roll, financial changes, and decision reasoning in a centered detail view. Phones show one card with earlier updates in an expandable list.
- **Clear all**, beside **Expand stack**, removes every pending notification, including hidden updates. **Only notifications involving you**, in the top-right game settings, keeps human events and summaries or market changes that actually change the human's finances. The preference persists in this browser. Filtering does not restart expiration timers, pause NPCs, or remove financial history. An NPC visit that raises your dream's price produces a personal notification.
- New games assign distinct dreams to every player, with nine dreams available for a full nine-player table. The 32-space Fast Track shows one dream per player; unused dream positions become opportunities. Twelve fixed businesses, Payday and special events remain available. The board stays fixed after eliminations. Existing saves with shared dreams retain one accessible space per distinct chosen dream.
- Unread notifications and expanded activity details **do not pause NPCs**. Required decisions and manual worksheets wait for input; finance/settings dialogs, the table’s Pause control, and a hidden browser tab pause NPC play.
- The game overview opens automatically when the match ends. Compare every player’s passive income, debt, cash, monthly cash flow, expenses, and net worth on interactive charts. Hover or tap to see the event behind a change; focus a chart and use arrow keys, Home, or End for keyboard exploration. Toggle players and measures, and expand the event table for exact figures.
- Human elimination first opens a personal game-over overview with the human's charts, exit finances, and coaching. Required manual accounting must commit before elimination is shown. NPCs continue while this overview is open; closing it acknowledges the review and survives refresh. Reopen it from **Review my game**. The final overview opens when the remaining match ends. Eliminated players' finances are frozen at exit so later market changes cannot rewrite their results.
- The end-game coach prioritizes risk management for the selected player. It separates cash from the 10% reserve against all debt (including investment mortgages), shows the remaining shock buffer, and stress-tests a $1,000 expense. Repayments can lower monthly costs while leaving an unsafe buffer; investing guidance considers only cash left after the debt reserve, any opted-in principal installment, and emergency savings. Coaching buffer targets are labeled separately from game requirements, and the reserve rule is respected when disabled. Suggestions cite recorded decisions and are generated locally from match data.

## Markets, wiki and rulebook

Open **Market** beside **The game** to inspect stocks, real estate and businesses. Charts connect recorded prices diagonally, with rounds along the bottom, percentages on the right, and markers ordered within each round. Hover, tap, or use arrow keys, Home and End to inspect the reason for each change. The dashboard shows current holdings, opportunity prices and all economic trends. The board's green/red **Market watch** ticker shows total percentage changes since the current round opened, including market-space shocks. Direction arrows and signs accompany the colors.

Purchase and sale calculations start collapsed. Click their summary to expand fees, financing, tax and income calculations. Critical cash requirements, sale proceeds and monthly income stay visible. Corner notifications use a compact title and one-line preview; click for complete details. Their 30-second expiry and stack controls are unchanged.

Open **Wiki** beside **How to play** to browse roles, opportunities, market cards, life expenses, dreams and special events. Search names, asset types, strategies and effects; filter original or adapted content. Entries explain baseline amounts, financing, eligible holdings, choices, timing and sources. Disabled adapted opportunities remain readable and are labeled. The catalogue does not reveal deck order or change the match. Legacy saves also show their original economic-cycle catalogue.

**Rulebook**, beside Wiki, explains turns, asset types, trading costs and examples, market repricing, NPC personalities, borrowing, liquidity, recovery, victory and accounting.

## Saves

Every action autosaves in this browser. There are also three named slots under **Save & resume**. Saving over a named slot replaces that slot; loading or starting a new game replaces the autosave. Clear browser data and those saves are gone. Saves are validated before use; a damaged autosave is kept intact until you explicitly start fresh or load a named slot. The seed, shuffled decks, market indices and event history, purchase rounds, acquisition-fee tax basis, installment markers, pending transaction, unread notifications, complete financial timeline, and random-generator state are stored for deterministic continuation. Retained notification timers restart when the page reloads.

Older saves remain compatible. Saves with persistent markets adopt round movements and enabled market trends from the next round, preserving current balances, holdings, prices, worksheets and RNG state at load. Their market deck resets so the next market draw uses the new weighted shock cards. Existing saved prices and older event multipliers remain readable. Saves predating persistent markets keep their original market and cycle rules. The stored market dynamics include the active trend's start/expiry, trend deck, last processed round and opening indices for the ticker, so resuming never applies a movement twice. Saves predating financial history start their timeline when loaded; earlier changes remain unavailable. Save validation rejects broken history, incorrect multipliers, invalid trend ranges and inconsistent worksheets.

## Economy and rule adaptations

All money is stored in integer cents. These are **simplified game values**, not real investment estimates.

- **New loans:** ordinary bank loans cost **2% monthly**; separate Type 1 purchase loans cost **1% monthly**, on outstanding principal. Borrow in $1,000 units, up to $1,000,000 per action. The cheaper loan is available only with a financed Type 1 acquisition, covers the purchase and optional reserves, and commits atomically with the asset (including in shared discount offers). It remains personal debt after the asset is sold. Older saved loans keep their original rate and pending worksheets; new borrowing is tracked separately. **Custom repayments accept any positive amount in cents**, up to available cash and the outstanding balance, for bank, household, and investment debt. Recurring payments decrease in proportion to remaining principal, using the original payment basis to avoid accumulated rounding drift.
- **Rising Type 1 down payments:** the first lifetime financed acquisition requires 10% of the current price, then 15%, 20%, 25%, and 35% for the fifth and later purchases, plus the separate 5% acquisition fee. The remainder is the included mortgage; financing scales proportionally to its principal while operating income stays fixed. Selling or repaying does not reset the tier; outright purchases do not advance it. Older saves infer the count from holdings and recorded financed acquisitions; completed new transactions persist it.
- **55% debt-to-income limit:** before any new loan/mortgage, `(investment mortgage payments + ordinary bank interest + purchase-loan interest) / (salary + passive income after operating costs and investment mortgage financing)` must be at most 55%, with positive qualifying income. Starting profession debt is excluded from DTI but remains part of expenses and liquidity reserves. Mortgage financing is deducted once from passive income, personal-loan interest once in expenses. Purchase previews include the incoming asset and optional loan together; ordinary borrowing uses current income. Cash-only acquisitions and existing debt are not retroactively denied after losses. Transfers, discount responders and all NPC personalities obey the same limit and tier schedule; NPCs consider loan interest and the higher debt reserve before borrowing.
- **Principal repayments are optional, with autopay off by default.** Custom repayments remain available in Loans & debt. At setup, players can opt into scheduled principal of 0.5%, 1%, or 2% of outstanding balances once at turn end. This reduces cash and liabilities separately from recurring expenses; Payday never charges it again. Manual accounting audits any opted-in payment before it commits, including after refresh, without duplicate charges. Chosen autopay remains due during recovery turns.
- Property/business cash flow is **net of financing and operating costs**. Their mortgage is included in liabilities but its payment is not deducted twice. A partial mortgage repayment raises net passive income by the financing saved. Paying it off removes the entire financing payment.
- With **liquidity risk** enabled, cash must cover **10% of total outstanding debt**, including investment mortgages, at the start and end of a turn. Below the threshold, forced sales recover **50% of current equity** (`max(0, current market value − remaining mortgage) / 2`, rounded down to cents), and associated financing and income are removed. This half-equity recovery is an explicit adaptation of the source rules. Continue selling until the reserve is restored or enter bankruptcy recovery. Once the crisis starts, borrowing and ordinary repayments cannot bypass it. Red notification hints and financial-statement warnings appear only in **automatic accounting**; recovery rules apply in both modes.
- There are **15 starting roles, five each in easy, standard and hard tiers**. A seeded random role is drawn from the chosen tier, and every participant starts with that same role and identical cash, debts, loan payments, salary, taxes, living expenses and child costs. An explicitly selected role also applies to everyone. NPC personalities and decision difficulty affect choices, never opening finances. Easy roles have larger monthly surpluses; hard roles face tighter budgets or heavier debt. A themed introduction explains starting finances, debt purposes and strategy. The six earlier role IDs retain their old balances for saved-game compatibility. New liquidity-enabled games add the required opening reserve to normal profession savings, equally for all players. Starting-cash multipliers apply to profession savings. Existing saves retain their roles and finances; start a new match for equal starting conditions. Successful bankruptcy recovery allows three recovery turns without another liquidity call; normal checks resume afterward.
- **Round movements and economic trends:** Stock, property and business prices each start at 100%. Every new round, including during cycles, real estate fluctuates within ±0.25%, businesses within ±1%, and stocks either −3% to −2% or +2% to +3%, with equal direction odds. Every five rounds from round 5, draw one three-round economic trend. Baselines are 3%–6.5% for property, 4.5%–8% for businesses, and 6.5%–9.5% for stocks, depending on the card. A stabilizing pull toward 100% can reverse nominal direction at extremes. Combined cycle/noise movement is at least 2%/3%/5% respectively and at most 14%, below the smallest 15% landing shock. Other markets retain ordinary fluctuations. The clickable badge explains the baseline and remaining rounds. Expiry does not reverse changes; sandbox settings can disable cycles.
- **Shared discount offers and depressions:** If a market-space landing leaves its category strictly below 50%, all sale responses finish first. The game then draws one seeded random small/large asset from that category and offers it to every eligible player at the same price. Each may buy once or pass; the human chooses in a central popup. Stock quantities, financing, fees, adapted-card settings and liquidity rules remain in force. Recovery and eliminated players cannot buy; unique Fast Track businesses remain board opportunities. Required worksheets commit once before advancing to the next responder. The chosen card and remaining queue persist on refresh, without rerolling. Market is a chart and reference page. Strictly below 35%, a seeded 5–10-round depression (including entry round) caps that market at 34.99%, retaining normal fluctuations and suspending its cycle force. Landing shocks respect the cap; other markets continue normally. At expiry the cap lifts without resetting prices or immediately relocking. A subsequent crossing from at least 35% starts a fresh depression. Timers, purchases and movements survive save/resume.
- **Market-space shocks:** A landing triggers an immediate ±15%, ±20%, ±30%, ±40% or ±50% change to one category, even during an economic trend. Larger shocks are rarer. Every eligible owner can sell or hold on either track. All changes compound and prices remain bounded at 10%–500% of opening levels. Revaluations post immediately for everyone; purchases and sales retain the selected accounting mode. Stock/business operating income equals baseline operating income × `1 + 0.25 × (index − 1)`; an 80% price index means 95% operating income. Property rent and financing payments remain unchanged. Declines reduce asset values without reducing debt.
- **Trading costs:** Type 1 is a property/business with an included mortgage; Type 2 has no included debt; Type 3 is stock. Buying Types 1/2 costs **5% of the full current price**, in addition to the down payment or outright price. Selling Types 1/2 costs **10% of gross sale price**. An included mortgage settled by a sale during its first 10 ownership rounds adds **two current monthly financing payments**; a round-1 purchase is exempt from round 11. Standalone partial repayments have no sale penalty. Positive market sale profits for all three types incur **20% tax**: `max(0, gross − sale fee − penalty − original full purchase cost − acquisition fee)`. Mortgage settlement is deducted from cash proceeds separately. A separate personal bank loan used to purchase an asset remains outstanding when it is sold. Negative sale proceeds must be covered from available cash. Distress liquidation uses the existing half-equity recovery rules instead of ordinary fees/tax.
- **Worked example:** Buy a $100,000 property with $20,000 down and a $5,000 acquisition fee. Sell early for $130,000 with an $80,000 mortgage and $600 monthly financing. The $13,000 sale fee, $1,200 penalty and $2,160 tax on $10,800 profit leave **$33,640 net cash**. A partial mortgage repayment proportionally lowers both recurring financing and any later early-sale penalty.
- The Fast Track retains salary, holdings, cash, liabilities, and income. There is no 100× windfall. Existing investments remain eligible for market events.
- Full-game victory is the selected dream or the configured additional monthly passive income above the income recorded at Fast Track entry. Dream visits by other players increase that dream’s price by one original price per visit.
- **Anytime sales:** Open Portfolio during any player's turn. Stocks sell immediately at current market value. Businesses list with a 5% quick-sale discount and property with a 15% discount; both close at the start of the owner's turn after a seeded random 1–3 rounds. Gross proceeds lock at listing; income and financing continue until closing. Cancellation is free. Fees, tax, early-payoff penalties and the remaining included mortgage settle at closing, so partial repayments and ownership age can change net cash. An unaffordable closing shortfall cancels the listing without fees. Matching market-space offers sell even listed assets immediately without the quick-sale discount. Distress sales retain their own recovery rules. Save/resume preserves listings and worksheets without repeating a sale. Only marked opportunity cards can be transferred; the receiving NPC must accept and purchase immediately. No pooled purchases or direct player-to-player asset sales.
- Click any player in Around the table to inspect their statement, portfolio, debt and transaction receipts. Other players' financial views are read-only.
- **Transaction pages:** The Transactions tab reads the complete financial timeline from round 1, with 10 entries per page, round labels, newest/oldest ordering, and expandable before/after totals. The 60-item recent-receipt cache no longer limits what can be displayed. Saved matches with a financial timeline recover their earlier transactions automatically; saves that predate timeline tracking disclose the missing interval and retain older cached receipts where available.
- **First-encounter guide:** With tutorials enabled, human landings trigger separate introductions for Opportunity, Market, Life happens, Payday and purple special events. Crossing Payday also triggers its lesson. The first three opportunity visits teach Type 1 financed assets, Type 2 debt-free purchases, and Type 3 stocks, one lesson per visit. Pending lessons queue in trigger order, pause play immediately, survive refresh, and never repeat after acknowledgement. Disabling tutorials clears pending lessons without changing finances or unfinished worksheets.
- Mandatory bills can be covered by cash, borrowing, or bankruptcy recovery. Distress sales recover half current equity and remove associated investment financing. Bankruptcy attempts asset liquidation/debt repayment, then one-time 50% car/card/retail debt relief if needed. Recovery loses three turns and blocks new loans during those recovery turns; unrecoverable players are eliminated.
- A round gives every remaining player a turn. A round cap ranks non-eliminated players by passive income / expenses, then net worth; exact ties share victory. Investment valuations use current market prices; original cost basis is retained separately. Starting home/car liabilities follow the profession sheet; personal-use property is not counted as an income-producing asset.

With adapted cards enabled, new games contain 15 starting roles, **44 small deals, 33 large deals, 30 market-shock definitions, 12 economic trends and 39 life-expense cards**, nine dreams, 12 Fast Track businesses, and original 24/32-space tracks. The weighted market deck has 132 cards. Original-only games have 24 small, 18 large and 24 expense cards; market-shock odds and economic trends are the same either way. Six earlier profession IDs remain available for saved-game compatibility. Source mechanics: [provided rulebook](https://www.boardgameswizard.com/wp-content/uploads/2020/03/Cashflow-Rules-PDF.pdf). This implementation is intended for the agreed personal playtest.

## Adapted encyclopedia cards

The in-game **Wiki** lists the adapted opportunities and expenses with baseline amounts and sources. Investment and expense detail views also show their source and adaptations. Descriptions are rewritten for this playtest; no source artwork or runtime feeds are used. The local definitions are versioned in `src/game/encyclopedia.ts`. The twelve adapted buyer-offer cards remain available only in legacy saves; new games use persistent markets regardless of the adapted-card switch.

| Source deck                                                         | Added content                               | Adaptation to this game                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Small deals](https://cashflow.lifestyle/encyclopedia/small-deals/) | 10 stocks/funds, 6 properties, 4 businesses | Retain source prices, down payments, and operating income. These stocks pay no recurring dividend. Investment financing uses a 0.6% monthly payment basis and displayed income is net of that financing.                                |
| [Big deals](https://cashflow.lifestyle/encyclopedia/big-deals/)     | 9 properties, 6 businesses                  | Same net-income conversion. Some properties have negative cash flow; financed businesses support proportional partial repayment and exposure to persistent market prices.                                                               |
| [Market events](https://cashflow.lifestyle/encyclopedia/market/)    | 12 legacy buyer offers                      | Preserved in existing saves only. New matches replace buyer offers with the shared weighted 132-card market-shock deck.                                                                                                                 |
| [Doodads](https://cashflow.lifestyle/encyclopedia/doodads/)         | 15 expenses, $200–$2,000                    | Use fixed source baseline dollar costs equally for all professions, with existing manual audits and insolvency recovery. No salary multiplier.                                                                                          |
| [Special events](https://cashflow.lifestyle/encyclopedia/special/)  | 3 existing board events                     | Retain profession-specific child costs and three-child cap; downsizing charges one month’s expenses and skips two turns; charity is optional, costs 10% of total income, and offers extra dice. No extra layoff bills on skipped turns. |

**Enable adapted cards** in the new-game sandbox to add the sourced opportunity and expense packs; the switch defaults off. The early small deck has 56 shuffled copies (104 with adapted cards), favoring stocks and debt-free small businesses 3:1 per card through round 10. From round 11 the small deck resets to 24 copies, or 44 with adaptations. Draws remove one copy at a time; refills use the current round's mix. Older saves adopt the opening mix on their next small draw if still in rounds 1–10; older boosted decks in rounds 11–20 switch to the regular mix on their next small draw. Already-revealed opportunities and pending worksheets are preserved. Both initial shuffles and refills respect the switch. Older saves retain their combined decks and existing holdings. All added cards use the existing seeded draw-and-refill decks. Property opportunities may be transferred under the existing rules; stock and business opportunities in this set are not transferable. Original card IDs and saved holdings remain valid.

## Persistent-market events and NPCs

Each market has positive and negative 15%, 20%, 30%, 40% and 50% shock cards, with 10, 6, 3, 2 and 1 copies per sign, respectively. The three markets share the shuffled 132-card deck. Percentages are game assumptions, not historical measurements. The 12 economic cards are listed in Market and Wiki, with affected markets and their per-round ranges:

| Trend                                               | Market relationship                                                |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| Stock boom / Stock correction                       | Sustained earnings optimism or risk aversion changes equity prices |
| Housing demand boom / Housing credit crunch         | Demand and lending conditions change property prices               |
| Main Street expansion / Main Street recession       | Consumer spending changes business values and operating income     |
| Credit confidence returns / Broad risk-off downturn | Correlated moves across all three markets                          |
| Productivity wave / Inflation squeeze               | Earnings and margins affect stocks and businesses                  |
| Neighborhood renewal / Demand slowdown              | Local conditions affect real estate and businesses                 |

Personality reserve targets combine a proportion of **all debt** with a household-expense buffer and any opted-in principal installment. Liquidity-enabled matches enforce at least the legal 10% debt floor for every personality. Hard difficulty increases the expense buffer by 10%; mistakes vary with difficulty, while absolute Conservative no-Type-1/no-investment-borrowing preferences remain intact.

| Personality             | Preferences                                                                                                                                        | Cash target before principal                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Conservative saver      | Debt-free assets, then cheap stocks; never financed assets or investment borrowing                                                                 | 25% of debt + 3 months of expenses                 |
| Aggressive leverager    | Financed assets, then debt-free assets; borrows even when interest consumes their income                                                           | 2% of debt (10% if liquidity enabled) + 0.25 month |
| Speculator / day trader | Stocks even without dividends; sells rallies, usually holds crashes; after $20,000 realized stock gains may buy property/business outright         | 2% of debt (10% if enabled) + 0.1 month            |
| Balanced investor       | Stocks with low cash, financed assets with medium cash, outright assets with high cash; uses profitable stock sales to reduce investment financing | 15% of debt + 1 month                              |

## Tests

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

To test with an installed Chrome instead of downloading Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:browser
```

Engine tests cover persistent valuation/income, acquisition fees, tax, early-sale boundaries and proportional penalties, sale shortfalls, transferred opportunities, manual purchase/sale refresh, market-history corruption, deterministic continuation, equal nine-player starts, distinct NPC behaviors, and both natural victory modes. Eight-NPC common-seed simulations compare all difficulties. Separate legacy-save regressions cover the earlier markets, cycle expiry, dividends/splits, financing, principal, hardship, liquidity, notifications, coaching and reports. Browser tests cover market charts and touch/keyboard markers, rulebook, fee breakdowns, manual purchase/sale refresh, eight-NPC setup, and all earlier accounting, save, notification, responsive and accessibility flows. Screenshots are generated in `test-results/`.

Anytime-sale regressions additionally cover delayed and immediate closings, locked listing prices, cancellation, partial mortgage repayment, manual accounting through refresh, seeded continuation, and duplicate-sale prevention. Browser checks cover read-only player inspection, listing controls, keyboard focus, and phone contrast/layout.

## Structure

- `src/game/`: typed domain model, versioned original/adapted content, persistent markets and trading quotes, personality policies, legacy economic events, repayment helpers, pure reducer, seeded randomness, filtered NPC decision views, and save validation.
- `src/components/`: illustrated SVG city/board, decisions, accounting worksheet, statements, setup, and accessible dialogs.
- `src/App.tsx`: game orchestration, browser persistence, NPC scheduling, and preferences.
- `tests/`: Playwright browser tests. Game tests sit beside the rules engine.
- `desktop/`: Windows wrapper, icon and portable executable smoke test.
- `web/` and `scripts/package-web.ps1`: local server and web-release packaging.
- `docs/`: browser and Windows guides, upgrade notes and release summaries.

The project does not include online multiplayer, cloud saves, live economic feeds, or conversational NPC services. Balance values live in the content module so later playtesting can tune them without changing the financial engine.

## Starting roles

All figures below are baseline USD per month, before sandbox multipliers. Career debt can support earning power but produces no passive income by itself. Personal housing is not a rental investment. Every role begins with zero investment income.

| Starting tier | Role              |  Salary | Expenses | Cash flow | Total opening debt | Main challenge or advantage                  |
| ------------- | ----------------- | ------: | -------: | --------: | -----------------: | -------------------------------------------- |
| Easy          | Software engineer |  $9,200 |   $5,116 |    $4,084 |           $130,000 | High salary; moderate payments               |
| Easy          | Family physician  | $12,000 |   $6,179 |    $5,821 |           $130,000 | Very high salary; high living costs          |
| Easy          | Tax accountant    |  $7,500 |   $2,790 |    $4,710 |            $18,000 | Low fixed costs; qualification debt          |
| Easy          | Data analyst      |  $8,500 |   $3,570 |    $4,930 |            $40,000 | Strong savings; training and transport loans |
| Easy          | Solar technician  |  $6,200 |   $2,330 |    $3,870 |             $9,000 | Low debt; work equipment financing           |
| Standard      | Product designer  |  $6,400 |   $3,780 |    $2,620 |           $130,000 | Balanced budget; mixed household debt        |
| Standard      | Registered nurse  |  $5,900 |   $3,385 |    $2,515 |           $130,000 | Steady income; education debt                |
| Standard      | Electrician       |  $5,400 |   $3,270 |    $2,130 |           $130,000 | Work van and equipment payments              |
| Standard      | Head chef         |  $5,600 |   $3,640 |    $1,960 |           $117,000 | Equipment and card balances                  |
| Standard      | Urban planner     |  $6,100 |   $3,970 |    $2,130 |           $163,000 | Housing and education commitments            |
| Hard          | School teacher    |  $4,300 |   $2,760 |    $1,540 |           $128,000 | Modest income; housing-heavy debt            |
| Hard          | Delivery courier  |  $3,300 |   $2,690 |      $610 |            $40,000 | Low income; heavy transport payments         |
| Hard          | Session musician  |  $4,200 |   $4,120 |       $80 |           $204,000 | Very thin monthly surplus                    |
| Hard          | Junior attorney   | $10,500 |   $9,220 |    $1,280 |           $450,000 | High income; very high fixed costs           |
| Hard          | Retail manager    |  $8,200 |   $7,280 |      $920 |           $258,000 | High lifestyle and consumer payments         |

Role introductions persist until acknowledged, then stay dismissed after refresh. Notifications show at most two cards on desktop and one on phones, with earlier updates in an expandable stack; all retain their 30-second expiry. Each dream has a distinct board icon and short name. The chosen dream has a double border, a “YOUR DREAM” badge and a board locator with outer-space numbers.
