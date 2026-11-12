import { test, expect, type Page } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import {
  assetFromDeal,
  createGame,
  money,
  preciseMoney,
  reduceGame,
} from "../src/game/engine";
import { smallDeals } from "../src/game/content";
import { voluntarySaleQuote } from "../src/game/sales";
import type { GameState } from "../src/game/types";

const property = smallDeals.find((c) => c.category === "property")!;
const business = smallDeals.find(
  (c) => c.category === "business" && !c.mortgage,
)!;
const stock = smallDeals.find((c) => c.category === "stock")!;
function game() {
  const s = createGame({
    profession: "designer",
    seed: 123,
    tutorials: false,
    liquidityRisk: false,
    economicCycles: false,
  });
  s.roleRevealed = true;
  s.players[0].cash = 100000000;
  return s;
}
async function seed(page: Page, s: GameState) {
  await page.addInitScript((initial) => {
    if (!localStorage.getItem("cashflow.v1.auto"))
      localStorage.setItem(
        "cashflow.v1.auto",
        JSON.stringify({
          name: "Asset sale test",
          savedAt: new Date().toISOString(),
          state: initial,
        }),
      );
  }, s);
  await page.goto("/");
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("cashflow.v1.auto")!).state,
  );
}
async function portfolio(page: Page) {
  await page
    .getByRole("button", { name: "Open financial statement", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "A clearer financial picture",
  });
  await dialog.getByRole("tab", { name: "Portfolio", exact: true }).click();
  return dialog;
}

test("player cards open each player's read-only statement, holdings, debt and own transactions", async ({
  page,
}) => {
  let s = game();
  s.current = 1;
  s.players[1].cash = 10000000;
  s.phase = "decision";
  s.decision = {
    kind: "opportunity",
    owner: 1,
    card: property.id,
    transferred: false,
  };
  s = reduceGame(s, { type: "BUY" });
  s.current = 0;
  s.phase = "roll";
  s = reduceGame(s, { type: "BORROW", amount: 100000 });
  await seed(page, s);
  const player = page.getByRole("button", {
    name: `View ${s.players[1].name}’s finances`,
    exact: true,
  });
  await player.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: `${s.players[1].name}’s financial statement`,
  });
  await expect(dialog).toContainText("read only");
  await expect(dialog.locator(".finance-overview")).toContainText(
    money(s.players[1].cash),
  );
  await dialog.getByRole("tab", { name: "Portfolio", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: property.name, exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /sell|listing/i }),
  ).toHaveCount(0);
  await dialog.getByRole("tab", { name: "Loans & debt", exact: true }).click();
  await expect(dialog).toContainText(`${property.name} mortgage`);
  await expect(dialog.locator("input")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: /repay|borrow|pay off/i }),
  ).toHaveCount(0);
  await dialog.getByRole("tab", { name: "Transactions", exact: true }).click();
  await expect(dialog.locator(".ledger-item")).toHaveCount(1);
  await expect(dialog.locator(".ledger-item")).toContainText(
    `Bought ${property.name}`,
  );
  await expect(dialog).not.toContainText("Bank loan");
  await page.screenshot({
    path: "test-results/player-finances.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(player).toBeFocused();
  const own = await portfolio(page);
  await expect(own).not.toContainText("read only");
  await own.getByRole("tab", { name: "Transactions", exact: true }).click();
  await expect(own.locator(".ledger-item")).toContainText("Bank loan");
  expect((await saved(page)).players).toEqual(s.players);
});

test("stocks sell immediately from Portfolio and the net cash and receipt survive refresh", async ({
  page,
}) => {
  const s = game(),
    a = { ...assetFromDeal(stock, "shares", 100), boughtRound: 1 };
  s.players[0].assets = [a];
  const quote = voluntarySaleQuote(s, a);
  await seed(page, s);
  const dialog = await portfolio(page);
  await dialog
    .locator("summary")
    .filter({ hasText: "Sell stocks now" })
    .click();
  await expect(dialog.locator(".asset-sale-quote")).toContainText(
    preciseMoney(quote.net),
  );
  await dialog
    .getByRole("button", { name: "Sell all shares", exact: true })
    .click();
  await expect(dialog.locator(".portfolio-item")).toHaveCount(0);
  expect((await saved(page)).players[0].cash).toBe(
    s.players[0].cash + quote.net,
  );
  await page.reload();
  const refreshed = await portfolio(page);
  await expect(refreshed.locator(".portfolio-item")).toHaveCount(0);
  await refreshed
    .getByRole("tab", { name: "Transactions", exact: true })
    .click();
  await expect(refreshed.locator(".ledger-item")).toHaveCount(1);
  await expect(refreshed.locator(".ledger-item")).toContainText(
    `Sold ${stock.name}`,
  );
});

test("business and property listings show discounts, persist, cancel, and fit the phone layout", async ({
  page,
}) => {
  const s = game();
  s.players[0].assets = [
    assetFromDeal(business, "shop"),
    assetFromDeal(property, "home"),
  ];
  await seed(page, s);
  const dialog = await portfolio(page);
  for (const [name, discount] of [
    [business.name, "5%"],
    [property.name, "15%"],
  ]) {
    const item = dialog
      .locator(".portfolio-item")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await item.locator("summary").filter({ hasText: "List for sale" }).click();
    await expect(item.locator(".asset-sale-quote")).toContainText(discount);
    await item
      .getByRole("button", { name: "Confirm listing", exact: true })
      .click();
    await expect(item.locator(".asset-sale-status")).toContainText(
      "Income continues until closing",
    );
  }
  const listed = await saved(page);
  expect(listed.players[0].cash).toBe(s.players[0].cash);
  expect(
    listed.players[0].assets.every(
      (a) => a.listing!.closesRound >= 2 && a.listing!.closesRound <= 4,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/asset-listings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
  ).violations;
  expect(
    violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/asset-listings-phone.png",
    fullPage: true,
  });
  await dialog
    .locator(".portfolio-item")
    .filter({ hasText: property.name })
    .getByRole("button", { name: "Cancel listing" })
    .click();
  await page.reload();
  const refreshed = await portfolio(page);
  await expect(refreshed.locator(".asset-sale-status")).toHaveCount(1);
  expect(
    (await saved(page)).players[0].assets.find((a) => a.id === "home")!.listing,
  ).toBeUndefined();
  await refreshed.locator(".asset-sale-quote summary").click();
  expect(await refreshed.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: "test-results/asset-sale-quote-phone.png",
    fullPage: true,
  });
});

test("a scheduled manual closing pauses for a persisted worksheet and commits only once", async ({
  page,
}) => {
  let s = game();
  const a = assetFromDeal(business, "shop");
  s.players[0].assets = [a];
  s = reduceGame(s, { type: "SELL_ANYTIME", playerId: "p0", assetId: a.id });
  s.config.accounting = "manual";
  s.round = s.players[0].assets[0].listing!.closesRound;
  s.players[0].skip = 1;
  const expectedCash =
    s.players[0].cash + voluntarySaleQuote(s, s.players[0].assets[0]).net;
  await seed(page, s);
  await page.getByRole("button", { name: "Take recovery turn" }).click();
  await expect.poll(async () => !!(await saved(page)).pending).toBe(true);
  await page.reload();
  const pending = (await saved(page)).pending!;
  const labels = {
    cash: "Cash on hand",
    assets: "Investment assets (current value)",
    debt: "Total liabilities",
    income: "Total monthly income",
    expenses: "Total monthly expenses",
    passive: "Monthly passive income",
    flow: "Monthly cash flow",
  };
  for (const field of pending.fields) {
    await page
      .getByLabel(labels[field], { exact: true })
      .fill(String(pending.receipt.after[field] / 100));
  }
  await page.getByRole("button", { name: "Check my worksheet" }).click();
  await expect.poll(async () => (await saved(page)).pending).toBeNull();
  expect((await saved(page)).players[0].cash).toBe(expectedCash);
  await page.getByRole("button", { name: "Take recovery turn" }).click();
  expect(
    (await saved(page)).receipts.filter(
      (r) => r.title === `Sold ${business.name}`,
    ),
  ).toHaveLength(1);
});
