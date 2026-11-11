import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createGame, playerFinancials, preciseMoney } from "../src/game/engine";
import { smallDeals } from "../src/game/content";
import { purchaseQuote } from "../src/game/market";
import type { GameState } from "../src/game/types";
const property = smallDeals.find(
  (c) => c.category === "property" && c.mortgage > 0,
)!;
function game(manual = false) {
  const s = createGame({
    profession: "designer",
    seed: 123,
    tutorials: false,
    liquidityRisk: false,
    accounting: manual ? "manual" : "auto",
  });
  s.roleRevealed = s.tutorialDone = true;
  s.players[0].cash = 200000;
  s.phase = "decision";
  s.decision = {
    kind: "opportunity",
    card: property.id,
    owner: 0,
    transferred: false,
  };
  return s;
}
async function seed(page: Page, s: GameState) {
  await page.addInitScript((initial) => {
    if (!localStorage.getItem("cashflow.v1.auto"))
      localStorage.setItem(
        "cashflow.v1.auto",
        JSON.stringify({
          name: "Lending test",
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
test("purchase loan shows recalculated mortgage, both loan rates and proportional repayment", async ({
  page,
}) => {
  const s = game(),
    q = purchaseQuote(s, property),
    start = playerFinancials(s);
  await seed(page, s);
  await expect(
    page.getByText("Financed purchase #1: 10% down", { exact: true }),
  ).toBeVisible();
  const buy = page.getByRole("button", { name: "Make the investment" });
  await expect(buy).toBeDisabled();
  await page.getByRole("checkbox", { name: "Add a purchase loan" }).check();
  await page
    .getByRole("spinbutton", { name: "Purchase loan amount" })
    .fill("10000");
  await expect(buy).toBeEnabled();
  await page.getByText("Purchase calculation", { exact: true }).click();
  await expect(page.locator(".asset-cash-flow")).toContainText(
    preciseMoney(q.deal.financing),
  );
  await expect(page.locator(".lending-breakdown")).toContainText(
    preciseMoney(q.deal.income - 10000),
  );
  await expect(page.locator(".deal-details")).toContainText(
    preciseMoney(s.players[0].cash + 1000000 - q.cash),
  );
  const violations = (
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
  ).violations;
  expect(
    violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/lending-purchase-desktop.png",
    fullPage: true,
  });
  await buy.click();
  let after = await saved(page);
  expect(after.players[0].type1Purchases).toBe(1);
  expect(playerFinancials(after).flow).toBe(start.flow + q.deal.income - 10000);
  await page.getByRole("button", { name: "Open financial statement" }).click();
  const dialog = page.getByRole("dialog", {
    name: "A clearer financial picture",
  });
  await dialog.getByRole("tab", { name: "Loans & debt", exact: true }).click();
  await expect(dialog).toContainText("Type 1 purchase loan · 1% monthly");
  await dialog
    .getByRole("spinbutton", { name: "Loan amount", exact: true })
    .fill("1000");
  await dialog.getByRole("button", { name: "Borrow", exact: true }).click();
  after = await saved(page);
  expect(
    after.players[0].debts.find((d) => d.kind === "bank")?.monthlyRateBps,
  ).toBe(200);
  const card = dialog
    .locator(".repayment-card")
    .filter({ hasText: "Type 1 purchase loan · 1% monthly" });
  await card.getByRole("spinbutton").fill("2500");
  await expect(card).toContainText("$75.00");
  await card.getByRole("button", { name: /Repay/ }).click();
  after = await saved(page);
  expect(
    after.players[0].debts.find((d) => d.kind === "purchase")?.principal,
  ).toBe(750000);
  await page.reload();
  expect((await saved(page)).players).toEqual(after.players);
});

test("manual purchase loan survives refresh, audits once, and fits a compact phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const s = game(true);
  await seed(page, s);
  await page.getByRole("tab", { name: "Your move", exact: true }).click();
  await page.getByRole("checkbox", { name: "Add a purchase loan" }).check();
  await page
    .getByRole("spinbutton", { name: "Purchase loan amount" })
    .fill("10000");
  await page.getByText("Purchase calculation", { exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/lending-purchase-phone.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Make the investment" }).click();
  let state = await saved(page);
  expect(state.pending!.next.debts.some((d) => d.kind === "purchase")).toBe(
    true,
  );
  expect(state.players[0].assets).toHaveLength(0);
  await page.reload();
  await page.getByRole("tab", { name: "Worksheet", exact: true }).click();
  await expect(
    page.getByText("Let’s balance the books.", { exact: true }),
  ).toBeVisible();
  const inputs = page.locator(".worksheet-field input");
  for (let i = 0; i < (await inputs.count()); i++)
    await inputs.nth(i).fill("0");
  await page.getByRole("button", { name: /Check my/ }).click();
  await expect(page.locator(".field-error").first()).toBeVisible();
  state = await saved(page);
  for (const [i, field] of state.pending!.fields.entries())
    await inputs.nth(i).fill(String(state.pending!.receipt.after[field] / 100));
  await page.getByRole("button", { name: /Check my/ }).click();
  state = await saved(page);
  expect(state.pending).toBeNull();
  expect(state.players[0].type1Purchases).toBe(1);
  expect(state.players[0].assets).toHaveLength(1);
  expect(
    state.players[0].debts.filter((d) => d.kind === "purchase"),
  ).toHaveLength(1);
  expect(state.receipts[0].after).toEqual(playerFinancials(state));
});

test("55% lending refusal explains affordability and still permits an outright purchase", async ({
  page,
}) => {
  const s = game();
  s.players[0].salary = 1;
  s.players[0].cash = 100000000;
  s.players[0].type1Purchases = 4;
  await seed(page, s);
  await expect(
    page.getByText("Financed purchase #5: 35% down", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Projected debt-to-income" }),
  ).toContainText("declined");
  await expect(
    page.getByRole("button", { name: "Make the investment" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Buy outright without financing" })
    .check();
  await expect(
    page.getByRole("button", { name: "Make the investment" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Make the investment" }).click();
  expect((await saved(page)).players[0].assets[0].mortgage).toBe(0);
  expect((await saved(page)).players[0].type1Purchases).toBe(4);
});
