# Cashflow — a little strategy, a different life

A complete local browser playtest inspired by the CASHFLOW board-game mechanics. The city illustration, board, professions, and dreams are original. Original cards can optionally be joined by a sourced adaptation of the [Cash Flow Lifestyle encyclopedia](https://cashflow.lifestyle/encyclopedia/). Built with React, TypeScript, Vite, and SVG, with no backend, accounts, AI API, or paid services. Fonts are bundled locally.

## Windows desktop app (x86)

Download **Cashflow-1.0.0-windows-x86.exe** from the [GitHub release](https://github.com/jacobyingdanoob/cashflow/releases/latest) and double-click it. This is a portable 32-bit app for Windows 10 or later, including 64-bit Windows. It includes the game and its runtime, works offline, and requires no installation, Node.js, administrator access, or separate browser.

The first launch extracts the bundled runtime into a temporary folder. Saves remain in `%APPDATA%\Cashflow` when the app closes, moves, or updates. The desktop app has its own saves, separate from browser saves. The executable is unsigned.

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

- A ready-to-play match opens with three NPCs. Choose **New game** to select your starting role difficulty, dream, accounting mode, opponents, victory mode, and sandbox settings.
- In **rounds 1–10**, the small-opportunity deck favors stocks and debt-free small businesses: each has **three copies per card**, compared with one per other card. A debt-free business has no included loan or financing payment; borrowing to fund the purchase is still the player's choice. At the first small draw from round 11, the deck resets to the regular one-copy mix. Everyone shares the same odds, including adapted cards when enabled.
- Roll, review investment opportunities, and collect monthly cash flow at Payday. Keep enough cash for life events. Use the financial statement to review investments or borrow and repay debt.
- Build passive income strictly greater than monthly expenses, then enter the Fast Track at the beginning of a turn. Choose financial-freedom victory for a shorter game, or continue to your dream/additional-income target.
- In **guided manual accounting**, enter the new totals for each affected field. Hints and revealed answers carry no penalty. Transactions commit once, only after validation. Pending worksheets and typed drafts survive refresh.
- Economic settings affect every participant equally and are fixed during a match. NPC difficulty, personality, and cash reserves affect decisions; opponents never receive better rolls or hidden deck information.
- Every completed NPC turn and human event produces a small bottom-right notification, including automatic expenses, family events, Payday, market effects, and economic cycles. Notifications dismiss after **30 seconds** or with their close button. Click to expand the roll, financial changes, and decision reasoning in a centered detail view. Phones show one card with earlier updates in an expandable list.
- **Clear all** removes every pending notification, including hidden updates. **Only involving me** keeps human events and summaries or economic cycles that actually change the human's finances. The preference also appears in settings and persists in this browser. Filtering does not restart expiration timers, pause NPCs, or remove financial history. An NPC visit that raises your dream's price produces a personal notification.
- New games assign distinct dreams to every player. The 32-space Fast Track shows one dream per player, spaced across the existing dream positions; unused positions become opportunities. Twelve fixed businesses, Payday and special events remain available. The board stays fixed after eliminations. Existing saves with shared dreams retain one accessible space per distinct chosen dream.
- Unread notifications and expanded activity details **do not pause NPCs**. Required decisions and manual worksheets wait for input; finance/settings dialogs, the table’s Pause control, and a hidden browser tab pause NPC play.
- The game overview opens automatically when the match ends. Compare every player’s passive income, debt, cash, monthly cash flow, expenses, and net worth on interactive charts. Hover or tap to see the event behind a change; focus a chart and use arrow keys, Home, or End for keyboard exploration. Toggle players and measures, and expand the event table for exact figures.
- Human elimination first opens a personal game-over overview with the human's charts, exit finances, and coaching. Required manual accounting must commit before elimination is shown. NPCs continue while this overview is open; closing it acknowledges the review and survives refresh. Reopen it from **Review my game**. The final overview opens when the remaining match ends. Eliminated players' finances are frozen at exit so later economic cycles cannot rewrite their results.
- The end-game coach reviews recorded decisions for the selected player. Suggestions cite actual borrowing, reserve shortfalls, repayments, income growth, investment sales, or passed opportunities. Coaching is generated locally from match data.

## Game wiki

Open **Wiki** beside **How to play** in the header (or the navigation menu on phones). Browse 212 entries across roles, opportunities, market cards, life expenses, sudden economic events, dreams and special events. Search names, asset types, strategies and effects; filter original or adapted content. Entries explain baseline amounts, financing, eligible holdings, choices, timing and real-life sources. Disabled adapted cards remain readable and are labeled with their current match status. The catalogue reads the local content definitions and does not reveal deck order or change the match.

## Saves

Every action autosaves in this browser. There are also three named slots under **Save & resume**. Saving over a named slot replaces that slot; loading or starting a new game replaces the autosave. Clear browser data and those saves are gone. Saves are validated before use; a damaged autosave is kept intact until you explicitly start fresh or load a named slot. The seed, shuffled decks (including economic cycles), active economic conditions, installment markers, pending transaction, unread notifications, complete financial timeline, and random-generator state are stored for deterministic continuation. Retained notification timers restart when the page reloads.

Older saves remain compatible. Saves predating financial history begin their timeline when loaded; the overview explains that earlier changes are unavailable. Charts retain all newly recorded financial events, independently of the shorter recent-transactions list. Saves predating these economy settings receive the new defaults without changing existing cash, holdings, or random-generator state. Existing pending worksheets remain available for completion. Saved loan balances, explicit autopay settings, and already-shuffled decks are retained; new cards join those matches when a deck refills. Start a new match for the lower opening debt and autopay-off defaults.

## Economy and rule adaptations

All money is stored in integer cents. These are **simplified game values**, not real investment estimates.

- Personal bank loans default to 12% annual simple interest, charged monthly on outstanding principal. Borrow in $1,000 units. **Custom repayments accept any positive amount in cents**, up to available cash and the outstanding balance, for bank, household, and investment debt. Recurring payments decrease in proportion to remaining principal, using the original payment basis to avoid accumulated rounding drift.
- **Principal repayments are optional, with autopay off by default.** Custom repayments remain available in Loans & debt. At setup, players can opt into scheduled principal of 0.5%, 1%, or 2% of outstanding balances once at turn end. This reduces cash and liabilities separately from recurring expenses; Payday never charges it again. Manual accounting audits any opted-in payment before it commits, including after refresh, without duplicate charges. Chosen autopay remains due during recovery turns.
- Property/business cash flow is **net of financing and operating costs**. Their mortgage is included in liabilities but its payment is not deducted twice. A partial mortgage repayment raises net passive income by the financing saved. Paying it off removes the entire financing payment.
- With **liquidity risk** enabled, cash must cover **10% of total outstanding debt**, including investment mortgages, at the start and end of a turn. Below the threshold, forced sales recover **50% of current equity** (`max(0, current market value − remaining mortgage) / 2`, rounded down to cents), and associated financing and income are removed. This half-equity recovery is an explicit adaptation of the source rules. Continue selling until the reserve is restored or enter bankruptcy recovery. Once the crisis starts, borrowing and ordinary repayments cannot bypass it. Red notification hints and financial-statement warnings appear only in **automatic accounting**; recovery rules apply in both modes.
- There are **15 starting roles, five each in easy, standard and hard tiers**. The human draws a seeded random role from the chosen tier; NPCs draw unique roles from the whole roster, independently of NPC decision difficulty. Easy roles have larger monthly surpluses; hard roles face tighter budgets or heavier debt. A themed introduction explains starting finances, debt purposes and strategy. The six earlier role IDs retain their old balances for saved-game compatibility. New liquidity-enabled games add the required opening reserve to normal profession savings, equally for all players. Starting-cash multipliers apply to profession savings. Existing saves keep their cash and debt. Successful bankruptcy recovery allows three recovery turns without another liquidity call; normal checks resume afterward.
- **Sudden economic cycles begin only after round 10**: round 11, then 14, 17, and every three rounds thereafter. Each lasts three rounds. Ordinary board events still occur during rounds 1–10. Expiring conditions normalize before the next draw. Temporary effects reprice current holdings, new deals, market sale offers, operating income, or financing costs without changing outstanding principal. Existing investments remain exposed on both tracks. Shared market repricing posts immediately for all players; cash transactions still use the chosen accounting mode.
- The Fast Track retains salary, holdings, cash, liabilities, and income. There is no 100× windfall. Existing investments remain eligible for market events.
- Full-game victory is the selected dream or the configured additional monthly passive income above the income recorded at Fast Track entry. Dream visits by other players increase that dream’s price by one original price per visit.
- Assets can be sold only on matching market offers or through distress recovery. Only marked opportunity cards can be transferred; the receiving NPC must accept and purchase immediately. No pooled purchases or direct player-to-player asset sales.
- Mandatory bills can be covered by cash, borrowing, or bankruptcy recovery. Distress sales recover half current equity and remove associated investment financing. Bankruptcy attempts asset liquidation/debt repayment, then one-time 50% car/card/retail debt relief if needed. Recovery loses three turns and blocks new loans during those recovery turns; unrecoverable players are eliminated.
- A round gives every remaining player a turn. A round cap ranks non-eliminated players by passive income / expenses, then net worth; exact ties share victory. Investment valuations include active economic-cycle effects; cost basis is retained separately. Starting home/car liabilities follow the profession sheet; personal-use property is not counted as an income-producing asset.

The combined content set contains 15 professions, **44 small deals, 33 large deals, 36 market cards, 39 life-expense cards**, eight dreams, 12 Fast Track businesses, and original 24/32-space tracks. Source mechanics: [provided rulebook](https://www.boardgameswizard.com/wp-content/uploads/2020/03/Cashflow-Rules-PDF.pdf). This implementation is intended for the agreed personal playtest.

## Adapted encyclopedia cards

The in-game **Economic events & rules → Adapted card catalogue** lists all 62 additions, with baseline amounts and sources. Investment cards, market decisions, and expense detail views also show their source and rule adaptations. Descriptions are rewritten for this playtest; no source artwork or runtime feeds are used. The local definitions are versioned in `src/game/encyclopedia.ts`.

| Source deck                                                         | Added content                               | Adaptation to this game                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Small deals](https://cashflow.lifestyle/encyclopedia/small-deals/) | 10 stocks/funds, 6 properties, 4 businesses | Retain source prices, down payments, and operating income. These stocks pay no recurring dividend. Investment financing uses a 0.6% monthly payment basis and displayed income is net of that financing.                                                                           |
| [Big deals](https://cashflow.lifestyle/encyclopedia/big-deals/)     | 9 properties, 6 businesses                  | Same net-income conversion. Some properties have negative cash flow; financed businesses support proportional partial repayment and exposure to economic cycles.                                                                                                                   |
| [Market events](https://cashflow.lifestyle/encyclopedia/market/)    | 12 buyer offers                             | Retain category multipliers and $50–$200 share quotes. Fixed share quotes apply to any stock/fund, including the original cards. Economic price factors apply once. Remaining mortgages are deducted from property/business sale proceeds. Every eligible player may sell or keep. |
| [Doodads](https://cashflow.lifestyle/encyclopedia/doodads/)         | 15 expenses, $200–$2,000                    | Use fixed source baseline dollar costs equally for all professions, with existing manual audits and insolvency recovery. No salary multiplier.                                                                                                                                     |
| [Special events](https://cashflow.lifestyle/encyclopedia/special/)  | 3 existing board events                     | Retain profession-specific child costs and three-child cap; downsizing charges one month’s expenses and skips two turns; charity is optional, costs 10% of total income, and offers extra dice. No extra layoff bills on skipped turns.                                            |

**Enable adapted cards** in the new-game sandbox to add the sourced packs; the switch defaults off. Original-only games have 24 unique small, 18 large, 24 market and 24 expense cards. The early small deck has 56 shuffled copies (104 with adapted cards), favoring stocks and debt-free small businesses 3:1 per card through round 10. From round 11 the small deck resets to 24 copies, or 44 with adaptations. Draws remove one copy at a time; refills use the current round’s mix. Older saves adopt the opening mix on their next small draw if still in rounds 1–10; older boosted decks in rounds 11–20 switch to the regular mix on their next small draw. Already-revealed opportunities and pending worksheets are preserved. Both initial shuffles and refills respect the switch. Older saves retain their combined decks and existing holdings. All added cards use the existing seeded draw-and-refill decks. Property opportunities may be transferred under the existing rules; stock and business opportunities in this set are not transferable. Original card IDs and saved holdings remain valid.

## Economic event list

The **Economic events & rules** button opens the full in-game catalogue with sources and asset relationships. The 16 original cards below are inspired by real conditions; percentages are game stress-test assumptions, not historical measurements or predictions. Rate changes model all loans as repricing; actual fixed-rate loans differ.

| Event                       | Game effect                                         | Real-life parallel / affected assets                                                                                                                          |
| --------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Housing credit crunch       | Property values and entry prices −20%               | [2007–2009 housing downturn](https://www.federalreservehistory.org/essays/great-recession-and-its-aftermath); property holdings, sale offers, distress equity |
| Emergency rate hike         | Recurring debt payments and investment financing ×2 | [Monetary tightening](https://www.federalreserve.gov/monetarypolicy/openmarket.htm), such as 2022–2023; all financed assets and personal debts                |
| Rental demand boom          | Property operating income +10%                      | [Housing demand](https://fred.stlouisfed.org/series/CSUSHPINSA); rental holdings and property opportunities                                                   |
| Credit becomes cheaper      | Debt payments and investment financing −25%         | [Monetary easing](https://www.federalreserve.gov/monetarypolicy/openmarket.htm); household and investment loans                                               |
| Main Street recession       | Business operating income −25%, values −15%         | [Weak consumer spending](https://fred.stlouisfed.org/series/MRTSSM44000USS); small and Fast Track businesses                                                  |
| Main Street reopening       | Business operating income +20%, values +10%         | [Reopening demand](https://fred.stlouisfed.org/series/MRTSSM44000USS); business holdings, purchases, and sales                                                |
| Equity market sell-off      | Stock values and entry prices −30%                  | [Dot-com bust](https://fred.stlouisfed.org/series/NASDAQCOM); stocks, sale offers, distress equity; dividends unchanged                                       |
| Broad market recovery       | Stock values and entry prices +20%                  | [Recovery after equity downturns](https://fred.stlouisfed.org/series/NASDAQCOM); stock holdings and opportunities                                             |
| Vacancy shock               | Property operating income −30%                      | [Rental stress during downturns](https://www.federalreservehistory.org/essays/great-recession-and-its-aftermath); rental holdings while financing continues   |
| Neighborhood renewal        | Property values and entry prices +15%               | [Housing appreciation](https://fred.stlouisfed.org/series/CSUSHPINSA); property holdings, sales, and distress equity                                          |
| Input cost squeeze          | Business operating income −15%                      | [Inflation](https://fred.stlouisfed.org/series/CPIAUCSL), such as 2021–2022; business margins                                                                 |
| Productivity dividend       | Business operating income +15%                      | [Improving business conditions](https://fred.stlouisfed.org/series/MRTSSM44000USS); small and Fast Track businesses                                           |
| Dividend conservation       | Recurring stock dividends −40%                      | [Recession cash preservation](https://www.federalreservehistory.org/essays/great-recession-and-its-aftermath); stock income, excluding special distributions  |
| Dividend growth season      | Recurring stock dividends +25%                      | [Earnings recovery](https://fred.stlouisfed.org/series/NASDAQCOM); stock income and new share opportunities                                                   |
| Credit risk premium         | Debt payments and investment financing +25%         | [Credit stress](https://www.federalreservehistory.org/essays/great-recession-and-its-aftermath); personal and investment loans                                |
| Consumer confidence returns | Business values +15%, operating income +10%         | [Spending recovery](https://fred.stlouisfed.org/series/MRTSSM44000USS); business holdings, purchases, and sales                                               |

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

Engine tests cover ledger reconciliation, financing, custom and scheduled principal, proportional payments, eligible trades, dividends/splits, hardship, liquidity crises, cycle repricing/expiry, manual-audit drafts, save corruption, deterministic continuation, victory, non-blocking notifications, timeline retention, legacy migration, and coaching evidence. Simulations compare common seeds across difficulties, including matches with all new rules and both natural victory modes without a round cap. Browser tests cover setup, debt previews, manual accounting and principal refresh, liquidity warning suppression in manual mode, event sources/catalogue, save slots, non-blocking NPC summaries, 30-second expiry, chart tooltips and controls, coaching, responsive layouts, keyboard dialogs, reduced motion, and automated accessibility checks. Screenshots are generated in `test-results/`.

## Structure

- `src/game/`: typed domain model, versioned original/adapted content, economic events and repayment helpers, pure reducer, seeded randomness, filtered NPC decision views, and save validation.
- `src/components/`: illustrated SVG city/board, decisions, accounting worksheet, statements, setup, and accessible dialogs.
- `src/App.tsx`: game orchestration, browser persistence, NPC scheduling, and preferences.
- `tests/`: Playwright browser tests. Game tests sit beside the rules engine.

The project does not include online multiplayer, cloud saves, live economic feeds, or conversational NPC services. Balance values live in the content module so later playtesting can tune them without changing the financial engine.

## Starting roles

All figures below are baseline USD per month, before sandbox multipliers or economic cycles. Career debt can support earning power but produces no passive income by itself. Personal housing is not a rental investment. Every role begins with zero investment income.

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
