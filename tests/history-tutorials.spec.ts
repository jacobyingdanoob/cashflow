import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createGame, reduceGame, preciseMoney } from "../src/game/engine";
import { innerBoard } from "../src/game/content";
import type { GameState } from "../src/game/types";

function game(tutorials = false) {
  const s = createGame({
    seed: 123,
    profession: "designer",
    tutorials,
    liquidityRisk: false,
    economicCycles: false,
  });
  s.roleRevealed = s.tutorialDone = true;
  s.tutorialSeen = ["intro", "space", "event"];
  return s;
}
async function seed(page: Page, s: GameState) {
  await page.addInitScript((initial) => {
    if (!localStorage.getItem("cashflow.v1.auto"))
      localStorage.setItem(
        "cashflow.v1.auto",
        JSON.stringify({
          name: "History and tutorials",
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
async function replace(page: Page, s: GameState) {
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        "cashflow.v1.auto",
        JSON.stringify({
          name: "History and tutorials",
          savedAt: new Date().toISOString(),
          state,
        }),
      ),
    s,
  );
  await page.reload();
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

test("transaction pages recover round-one entries beyond the 60-receipt cache, persist, and filter each player", async ({
  page,
}) => {
  let s = game();
  const initialCash = s.players[0].cash;
  for (let i = 0; i < 70; i++) {
    s.round = Math.floor(i / 5) + 1;
    s = reduceGame(s, { type: "BORROW", amount: 100000 });
  }
  s.current = 1;
  for (let i = 0; i < 3; i++)
    s = reduceGame(s, { type: "BORROW", amount: 200000 });
  s.current = 0;
  s.turnContext = null;
  expect(s.receipts).toHaveLength(60);
  await seed(page, s);
  await page.getByRole("button", { name: "Open financial statement" }).click();
  const dialog = page.getByRole("dialog", {
    name: "A clearer financial picture",
  });
  await dialog.getByRole("tab", { name: "Transactions", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "1–10 of 70 transactions",
  );
  await expect(dialog.locator(".ledger-item")).toHaveCount(10);
  await expect(dialog.locator(".ledger-round").first()).toHaveText("Round 14");
  await dialog
    .getByRole("button", { name: "Transaction page 7", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(
    "61–70 of 70 transactions",
  );
  await expect(
    dialog.getByRole("button", { name: "Next transaction page" }),
  ).toBeDisabled();
  await expect(dialog.locator(".ledger-round").last()).toHaveText("Round 1");
  await dialog
    .getByRole("combobox", { name: "Transaction order" })
    .selectOption("oldest");
  await expect(
    dialog.getByRole("button", { name: "Transaction page 1", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await dialog.locator(".ledger-item summary").first().click();
  await expect(dialog.locator(".ledger-totals").first()).toContainText(
    `${preciseMoney(initialCash)} → ${preciseMoney(initialCash + 100000)}`,
  );
  await accessible(page);
  await page.screenshot({
    path: "test-results/transaction-history-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog
    .getByRole("navigation", { name: "Transaction pages" })
    .scrollIntoViewIfNeeded();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await accessible(page);
  await page.screenshot({
    path: "test-results/transaction-history-phone.png",
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", {
      name: `View ${s.players[1].name}’s finances`,
      exact: true,
    })
    .click();
  const npc = page.getByRole("dialog", {
    name: `${s.players[1].name}’s financial statement`,
  });
  await npc.getByRole("tab", { name: "Transactions", exact: true }).click();
  await expect(npc.getByRole("status")).toHaveText("1–3 of 3 transactions");
  await expect(npc.locator(".ledger-item")).toHaveCount(3);
  expect((await saved(page)).history).toEqual(s.history);
});

for (const [kind, title, target] of [
  ["opportunity", "A chance to build your income.", ".decision-panel"],
  ["market", "The market just moved for everyone.", ".decision-panel"],
  ["expense", "Make room for unexpected costs.", ".decision-panel"],
  ["payday", "Collect what your monthly budget earns.", ".financial-strip"],
  ["charity", "Check which special event you reached.", ".decision-panel"],
] as const) {
  test(`first ${kind} trigger immediately opens the matching guide and pauses play`, async ({
    page,
  }) => {
    const s = game(true);
    s.players[0].position =
      (innerBoard.findIndex((space) => space.kind === kind) + 23) % 24;
    s.rng = 1;
    s.decks.market = ["shock-stock-up-15"];
    await seed(page, s);
    await page
      .getByRole("button", { name: "Roll the dice", exact: true })
      .click();
    const guide = page.getByRole("dialog", { name: "Cashflow tutorial" });
    await expect(
      guide.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".tutorial-card")).toHaveAttribute(
      "data-target",
      target,
    );
    const frozen = await saved(page);
    await page.waitForTimeout(150);
    expect((await saved(page)).rng).toBe(frozen.rng);
    await accessible(page);
    await guide.getByRole("button", { name: "Turn off tutorials" }).click();
    await expect(guide).toHaveCount(0);
    expect((await saved(page)).tutorialQueue).toEqual([]);
  });
}

test("the first three opportunity visits teach one asset type each; a pending lesson survives refresh", async ({
  page,
}) => {
  const s = game(true);
  s.players[0].position = 0;
  s.rng = 1;
  await seed(page, s);
  for (const index of [1, 2, 3]) {
    await page
      .getByRole("button", { name: "Roll the dice", exact: true })
      .click();
    const guide = page.getByRole("dialog", { name: "Cashflow tutorial" });
    if (index === 1) {
      await expect(guide).toContainText("OPPORTUNITY SPACE");
      await guide.getByRole("button", { name: "Got it", exact: true }).click();
      await page.reload();
    }
    await expect(
      guide.getByRole("heading", { name: new RegExp(`^Type ${index}:`) }),
    ).toBeVisible();
    await guide.getByRole("button", { name: "Got it", exact: true }).click();
    await expect(guide).toHaveCount(0);
    const next = await saved(page);
    expect(next.tutorialSeen).toContain(`asset-${index}`);
    next.phase = "roll";
    next.decision = null;
    next.effects = [];
    next.current = 0;
    next.players[0].position = 0;
    next.rng = 1;
    next.turnContext = null;
    await replace(page, next);
  }
  await page
    .getByRole("button", { name: "Roll the dice", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Cashflow tutorial" }),
  ).toHaveCount(0);
  expect((await saved(page)).tutorialQueue).toEqual([]);
});

test("a phone expense lesson appears before the required manual worksheet and can be dismissed safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const s = game(true);
  s.config.accounting = "manual";
  s.players[0].position = 3;
  s.rng = 1;
  await seed(page, s);
  await page.getByRole("tab", { name: "Your move", exact: true }).click();
  await page
    .getByRole("button", { name: "Roll the dice", exact: true })
    .click();
  const guide = page.getByRole("dialog", { name: "Cashflow tutorial" });
  await expect(guide).toContainText("LIFE HAPPENS");
  expect((await saved(page)).pending).toBeTruthy();
  await page.screenshot({
    path: "test-results/life-event-tutorial-phone.png",
    fullPage: true,
  });
  await guide.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check my worksheet" }),
  ).toBeVisible();
  expect((await saved(page)).players[0].cash).toBe(s.players[0].cash);
});
