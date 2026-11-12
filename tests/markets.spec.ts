import { test, expect, type Page } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import {
  createGame,
  assetFromDeal,
  reduceGame,
  preciseMoney,
  playerFinancials,
  marketSaleQuote,
} from "../src/game/engine";
import { deals, smallDeals } from "../src/game/content";
import { purchaseQuote } from "../src/game/market";
import { roundMarketChange } from "../src/game/trends";
import { effectiveDeal } from "../src/game/economy";
import type { GameState, AssetCategory } from "../src/game/types";
const business = smallDeals.find(
  (c) => c.category === "business" && !c.mortgage,
)!;
const property = smallDeals.find((c) => c.category === "property")!;
const stock = smallDeals.find((c) => c.category === "stock")!;
function game() {
  return {
    ...createGame({
      profession: "designer",
      seed: 123,
      speed: "instant",
      liquidityRisk: false,
      tutorials: false,
    }),
    roleRevealed: true,
    tutorialDone: true,
  };
}
async function seed(page: Page, state: GameState) {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("cashflow.v1.auto"))
      localStorage.setItem(
        "cashflow.v1.auto",
        JSON.stringify({
          name: "Persistent market test",
          savedAt: new Date().toISOString(),
          state: s,
        }),
      );
  }, state);
  await page.goto("/");
}
async function state(page: Page): Promise<GameState> {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("cashflow.v1.auto")!).state,
  );
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
    ).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
}
function pulse(s: GameState, category: AssetCategory, index: number) {
  s.phase = "roll";
  s.decision = null;
  s.effects = [];
  s.players[0].position = 1;
  s.rng = 1;
  s.decks.market = [`pulse-${category}-${index}`];
  return reduceGame(s, { type: "ROLL" });
}

test("switching market tabs repeatedly replaces the chart without duplicate keys", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    )
      errors.push(message.text());
  });
  await seed(page, game());
  await page.getByRole("button", { name: "Market", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "The city markets" });
  for (const name of [
    "Real estate",
    "Businesses",
    "Stocks",
    "Real estate",
    "Stocks",
    "Businesses",
  ]) {
    await dialog.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
    await expect(dialog.locator(".market-chart")).toHaveCount(1);
    await expect(
      dialog.getByRole("group", { name: new RegExp(`^${name} market chart`) }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("market navigation, persistent percentage charts, markers and rulebook fit desktop and phone", async ({
  page,
}) => {
  let s = game();
  s = pulse(s, "stock", 0);
  s.round = 4;
  s = pulse(s, "stock", 6);
  s.round = 9;
  s = pulse(s, "business", 0);
  await seed(page, s);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button"),
  ).toHaveText(["The game", "Market", "How to play", "Wiki", "Rulebook"]);
  await expect(
    page.getByRole("heading", { name: "Latest market changes", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("YOUR REASON WHY", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Market", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "The city markets" });
  await expect(dialog).toBeVisible();
  const chart = dialog.getByRole("group", { name: /Stocks market chart/ });
  await expect(chart.locator("circle")).toHaveCount(
    s.marketState!.history.filter((t) => t.category === "stock").length + 1,
  );
  await expect(chart).toContainText("Round 9");
  await chart.focus();
  await page.keyboard.press("End");
  const latestStock = s
    .marketState!.history.filter((t) => t.category === "stock")
    .at(-1)!;
  await expect(dialog.getByRole("status")).toContainText(latestStock.title);
  await expect(dialog.getByRole("status")).toContainText(
    `${(latestStock.before / 100).toFixed(2)}% → ${(latestStock.after / 100).toFixed(2)}%`,
  );
  await page.keyboard.press("Home");
  await expect(dialog.getByRole("status")).toContainText("Opening market");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await chart
    .locator("circle")
    .nth(1)
    .dispatchEvent("pointerdown", {
      pointerType: "touch",
      ...(await chart
        .locator("circle")
        .nth(1)
        .evaluate((e) => {
          const b = e.getBoundingClientRect();
          return { clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 };
        })),
    });
  await expect(dialog.getByRole("status")).toContainText("Credit tightens");
  await accessible(page);
  await page.screenshot({
    path: "test-results/persistent-market-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: /^Businesses/ }).click();
  await expect(
    dialog.getByRole("group", { name: /Businesses market chart/ }),
  ).toBeVisible();
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await accessible(page);
  await page.screenshot({
    path: "test-results/persistent-market-phone.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Rulebook", exact: true }).click();
  const rules = page.getByRole("dialog", { name: "Rulebook", exact: true });
  await expect(rules).toContainText("$33,640 cash");
  await expect(rules).toContainText("Speculator / day trader");
  await expect(rules).toContainText("5% of the full current purchase price");
  await accessible(page);
  expect((await state(page)).marketState).toEqual(s.marketState);
});

test("acquisition fees and the outright option reconcile with the financial statement", async ({
  page,
}) => {
  const s = game();
  s.players[0].cash = 100000000;
  s.phase = "decision";
  s.decision = {
    kind: "opportunity",
    owner: 0,
    transferred: false,
    card: property.id,
  };
  await seed(page, s);
  const quote = purchaseQuote(s, property);
  await expect(page.locator(".deal-details")).toBeHidden();
  await page.getByText("Purchase calculation", { exact: true }).click();
  await expect(page.locator(".deal-details")).toBeVisible();
  await expect(page.locator(".deal-details")).toContainText(
    preciseMoney(quote.fee),
  );
  await expect(page.locator(".deal-details")).toContainText(
    "Acquisition fee · 5% of full price",
  );
  await page
    .getByRole("checkbox", { name: "Buy outright without financing" })
    .check();
  const outright = purchaseQuote(s, property, 1, true);
  await expect(page.locator(".deal-details")).toContainText(
    preciseMoney(outright.cash),
  );
  await accessible(page);
  await page.screenshot({
    path: "test-results/market-acquisition-fee.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Make the investment" }).click();
  const after = await state(page);
  expect(after.players[0].cash).toBe(s.players[0].cash - outright.cash);
  expect(after.players[0].assets[0].mortgage).toBe(0);
  expect(playerFinancials(after).passive).toBe(
    property.income + property.financing,
  );
  await page.reload();
  expect((await state(page)).players).toEqual(after.players);
});

test("market sales show every deduction and every eligible owner may respond", async ({
  page,
}) => {
  let s = game();
  s.players[0].assets = [
    {
      ...assetFromDeal(property, "rental"),
      boughtRound: 1,
      acquisitionFee: Math.round(property.cost * 0.05),
    },
  ];
  s.players[0].cash = 10000000;
  s = pulse(s, "property", 6);
  const a = s.players[0].assets[0],
    q = marketSaleQuote(s, a);
  await seed(page, s);
  await expect(page.locator(".trade-breakdown")).toBeHidden();
  await page
    .getByText("Sale calculation · fees & tax", { exact: true })
    .click();
  await expect(page.locator(".trade-breakdown")).toBeVisible();
  await expect(page.locator(".trade-breakdown")).toContainText(
    "Capital gains tax · 20%",
  );
  await expect(page.locator(".trade-breakdown")).toContainText(
    preciseMoney(q.penalty),
  );
  await expect(page.locator(".trade-total")).toContainText(preciseMoney(q.net));
  await accessible(page);
  await page.screenshot({
    path: "test-results/market-sale-breakdown.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sell", exact: true }).click();
  expect((await state(page)).players[0].cash).toBe(s.players[0].cash + q.net);
  expect((await state(page)).players[0].assets).toHaveLength(0);
  await page.getByRole("button", { name: "Finish market response" }).click();
  await expect(page.getByRole("button", { name: "End my turn" })).toBeVisible();
  expect((await state(page)).marketState).toEqual(s.marketState);
});

test("economic trend badge, round ticker, diagonal chart and wiki work on desktop and phone", async ({
  page,
}) => {
  let s = game();
  s.players[0].assets = [assetFromDeal(stock, "trend-shares", 100)];
  s.marketState!.dynamics!.deck = ["trend-stock-boom"];
  for (let i = 0; i < 4; i++) {
    s.current = s.players.length - 1;
    s.phase = "end";
    s.decision = null;
    s.effects = [];
    s = reduceGame(s, { type: "END" });
  }
  await seed(page, s);
  const ticker = page.getByRole("button", {
    name: `Stocks +${roundMarketChange(s, "stock").toFixed(2)}% this round`,
    exact: true,
  });
  await expect(ticker).toBeVisible();
  expect(
    await page
      .locator(".game-notification")
      .last()
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeLessThan(95);
  const badge = page.getByRole("button", { name: /Market trend: Stock boom/ });
  await expect(badge).toBeVisible();
  await badge.click();
  const detail = page.getByRole("dialog", { name: "Stock boom", exact: true });
  await expect(detail).toContainText("Rounds 5–7");
  await expect(detail).toContainText("+6.50% to +8.00% per round");
  await accessible(page);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await ticker.click();
  const chart = page.getByRole("group", { name: /Stocks market chart/ });
  const line = await chart.locator("path").getAttribute("d");
  expect(line).toContain("L");
  expect(line).not.toContain("V");
  const positions = await chart
    .locator("circle")
    .evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute("cx"))));
  expect(positions.every((x, i) => i === 0 || x > positions[i - 1])).toBe(true);
  await chart.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("status")).toContainText("Stock boom");
  await accessible(page);
  await page.screenshot({
    path: "test-results/market-trend-round5.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await accessible(page);
  await page.screenshot({
    path: "test-results/market-trend-phone.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Wiki", exact: true }).click();
  await page.getByRole("button", { name: /Economic trends/ }).click();
  await page
    .getByRole("button", { name: "Read entry: Stock boom", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Game wiki" })).toContainText(
    "+6.50% to +8.00% per round",
  );
  await accessible(page);
  expect((await state(page)).marketState).toEqual(s.marketState);
});

test("fee-bearing manual purchases survive refresh and reject wrong entries", async ({
  page,
}) => {
  const s = game();
  s.config.accounting = "manual";
  s.players[0].cash = 10000000;
  s.phase = "decision";
  s.decision = {
    kind: "opportunity",
    owner: 0,
    transferred: false,
    card: business.id,
  };
  await seed(page, s);
  await page.getByRole("button", { name: "Make the investment" }).click();
  const pending = (await state(page)).pending!;
  await page.getByLabel("Cash on hand", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Check my worksheet" }).click();
  await expect(
    page.getByText("Check this total and try again.").first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Cash on hand", { exact: true })).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "Reveal values" }).click();
  await page.getByRole("button", { name: "Check my worksheet" }).click();
  const complete = await state(page);
  expect(complete.pending).toBeNull();
  expect(complete.players[0].cash).toBe(pending.receipt.after.cash);
  expect(complete.players[0].assets).toHaveLength(1);
  expect(
    complete.history.filter((h) => h.title === `Bought ${business.name}`),
  ).toHaveLength(1);
});

test("manual market sales preserve the fee and tax worksheet after refresh", async ({
  page,
}) => {
  let s = game();
  s.players[0].cash = 10000000;
  s.players[0].assets = [
    {
      ...assetFromDeal(property, "rental"),
      boughtRound: 1,
      acquisitionFee: Math.round(property.cost * 0.05),
    },
  ];
  s = pulse(s, "property", 6);
  s.config.accounting = "manual";
  const q = marketSaleQuote(s, s.players[0].assets[0]);
  await seed(page, s);
  await page.getByRole("button", { name: "Sell", exact: true }).click();
  expect((await state(page)).players[0].assets).toHaveLength(1);
  await page.getByLabel("Cash on hand", { exact: true }).fill("0");
  await page.reload();
  await expect(page.getByLabel("Cash on hand", { exact: true })).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "Reveal values" }).click();
  await page.getByRole("button", { name: "Check my worksheet" }).click();
  const complete = await state(page);
  expect(complete.pending).toBeNull();
  expect(complete.players[0].cash).toBe(s.players[0].cash + q.net);
  expect(complete.players[0].assets).toHaveLength(0);
  expect(
    complete.receipts.filter((r) => r.title === `Sold ${property.name}`),
  ).toHaveLength(1);
  await page.reload();
  expect((await state(page)).players).toEqual(complete.players);
});

test("setup defaults to four NPCs and supports an eight-NPC table with all personalities", async ({
  page,
}) => {
  await seed(page, game());
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await expect(page.getByLabel("NPC opponents")).toHaveValue("4");
  await page.getByLabel("NPC opponents").selectOption("8");
  await page.getByRole("switch", { name: /Interactive tutorial/ }).uncheck();
  await page.getByText("Sandbox settings", { exact: true }).click();
  await expect(
    page.getByRole("switch", { name: /Economic market trends/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  await page.getByRole("button", { name: "Start my story" }).click();
  const start = await state(page);
  expect(start.players).toHaveLength(9);
  expect(start.marketState).toBeDefined();
  for (const p of start.players)
    expect(playerFinancials(start, p)).toEqual(
      playerFinancials(start, start.players[0]),
    );
  await expect(page.locator(".board-token")).toHaveCount(9);
  await expect(page.locator(".player-card")).toHaveCount(9);
  await expect(page.locator(".your-dream-space")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/nine-player-board.png",
    fullPage: true,
  });
  await accessible(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await accessible(page);
});

test("Around the table stays anchored below the board as decisions expand", async ({
  page,
}) => {
  let s = game();
  s.players[0].cash = 100000000;
  s.players[0].assets = Array.from({ length: 8 }, (_, i) =>
    assetFromDeal(property, `rental-${i}`),
  );
  s = pulse(s, "property", 6);
  await seed(page, s);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1100 });
    const table = page.locator(".players-section"),
      board = page.locator(".board-panel");
    const documentTop = () =>
      table.evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
    const before = await documentTop();
    expect(before).toBeGreaterThan(
      await board.evaluate(
        (e) => e.getBoundingClientRect().top + window.scrollY,
      ),
    );
    await page
      .getByText("Sale calculation · fees & tax", { exact: true })
      .first()
      .click();
    expect(Math.abs((await documentTop()) - before)).toBeLessThan(2);
    await page
      .getByText("Sale calculation · fees & tax", { exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Sell", exact: true })
      .first()
      .click();
    expect(Math.abs((await documentTop()) - before)).toBeLessThan(2);
  }
  await page.screenshot({
    path: "test-results/anchored-tablet-table.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "The board", exact: true }).click();
  await expect(page.locator(".board-panel")).toBeVisible();
  await expect(page.locator(".players-section")).toBeVisible();
  await page.getByRole("tab", { name: "Your move", exact: true }).click();
  await expect(page.locator(".decision-panel")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const accounting of ["auto", "manual"] as const)
  test(`${accounting} shared discount event follows sale responses and survives refresh`, async ({
    page,
  }) => {
    let s = game();
    for (const p of s.players) p.cash = 10000000000;
    for (let i = 0; i < 2; i++) {
      s.phase = "roll";
      s.decision = null;
      s.effects = [];
      s.players[0].position = 1;
      s.rng = 1;
      s.decks.market = ["shock-property-down-50"];
      s = reduceGame(s, { type: "ROLL" });
    }
    s.config.accounting = accounting;
    let forecast = structuredClone(s);
    while (forecast.decision?.kind === "market")
      forecast = reduceGame(forecast, { type: "PASS" });
    const card = deals.find(
      (c) => c.id === (forecast.decision as { card: string }).card,
    )!;
    const q = purchaseQuote(forecast, effectiveDeal(forecast, card), 1, true);
    await seed(page, s);
    await expect(
      page.getByRole("dialog", {
        name: "Discounted market offer",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Browse discounted assets",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Finish market response", exact: true })
      .click();
    const offer = page.getByRole("dialog", {
      name: "Discounted market offer",
      exact: true,
    });
    await expect(offer).toBeVisible();
    await expect(
      offer.getByRole("heading", { name: card.name, exact: true }),
    ).toBeVisible();
    await expect(
      offer.getByRole("button", { name: "Buy discounted asset", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(offer).toBeVisible();
    await page.reload();
    await expect(offer).toBeVisible();
    expect((await state(page)).decision).toEqual(forecast.decision);
    if (card.mortgage > 0)
      await offer
        .getByRole("checkbox", { name: "Buy outright without financing" })
        .check();
    await expect(offer.locator(".deal-details")).toBeHidden();
    await offer.getByText("Purchase calculation", { exact: true }).click();
    await expect(offer.locator(".deal-details")).toContainText(
      preciseMoney(q.cash),
    );
    await accessible(page);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await offer.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await accessible(page);
    await page.screenshot({
      path: `test-results/shared-discount-${accounting}.png`,
      fullPage: true,
    });
    await offer
      .getByRole("button", { name: "Buy discounted asset", exact: true })
      .click();
    if (accounting === "manual") {
      const worksheet = page.getByRole("dialog", {
        name: "Record your discount purchase",
        exact: true,
      });
      await expect(worksheet).toBeVisible();
      expect((await state(page)).players[0].assets).toHaveLength(0);
      await worksheet.getByLabel("Cash on hand", { exact: true }).fill("123");
      await worksheet
        .getByRole("button", { name: "Check my worksheet" })
        .click();
      await expect(
        worksheet.getByText("Check this total and try again.").first(),
      ).toBeVisible();
      await page.reload();
      await expect(
        worksheet.getByLabel("Cash on hand", { exact: true }),
      ).toHaveValue("123");
      expect((await state(page)).decision).toMatchObject({
        kind: "discount",
        responder: 0,
        card: card.id,
      });
      await worksheet.getByRole("button", { name: "Reveal values" }).click();
      await worksheet
        .getByRole("button", { name: "Check my worksheet" })
        .click();
    }
    await expect.poll(async () => (await state(page)).phase).toBe("end");
    const after = await state(page);
    expect(after.players[0].assets).toHaveLength(1);
    expect(after.players[0].cash).toBe(s.players[0].cash - q.cash);
    expect(after.players[0].assets[0]).toMatchObject({
      cardId: card.id,
      mortgage: 0,
    });
    for (const p of after.players)
      expect(
        after.history.some(
          (h) =>
            h.player === p.id &&
            (h.title.startsWith(`Discount purchase: ${card.name}`) ||
              h.title === `Passed on discounted ${card.name}`),
        ),
      ).toBe(true);
    await page.reload();
    expect((await state(page)).marketState).toEqual(s.marketState);
    await page.getByRole("tab", { name: "Your move", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "End my turn", exact: true }),
    ).toBeVisible();
  });

test("passing a shared discount offer leaves cash unchanged and lets every NPC respond", async ({
  page,
}) => {
  let s = game();
  for (let i = 0; i < 2; i++) {
    s.phase = "roll";
    s.decision = null;
    s.effects = [];
    s.players[0].position = 1;
    s.rng = 1;
    s.decks.market = ["shock-stock-down-50"];
    s = reduceGame(s, { type: "ROLL" });
  }
  const cash = s.players[0].cash;
  await seed(page, s);
  await page
    .getByRole("button", { name: "Finish market response", exact: true })
    .click();
  const offer = page.getByRole("dialog", {
    name: "Discounted market offer",
    exact: true,
  });
  await expect(offer).toBeVisible();
  await expect(
    offer.getByLabel("Number of shares", { exact: true }),
  ).toBeVisible();
  const saved = (await state(page)).decision;
  await page.reload();
  expect((await state(page)).decision).toEqual(saved);
  await offer
    .getByRole("button", { name: "Keep my cash · pass", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).phase).toBe("end");
  const after = await state(page);
  expect(after.players[0].cash).toBe(cash);
  expect(after.players[0].assets).toHaveLength(0);
  await expect(offer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "End my turn", exact: true }),
  ).toBeVisible();
});
