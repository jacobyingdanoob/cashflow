import { createLegacyGame as baseCreateGame } from "./legacyGame";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  assetFromDeal,
  playerFinancials,
  reduceGame,
} from "../src/game/engine";
import {
  professions,
  dreams,
  fastTrackBoard,
  smallDeals,
} from "../src/game/content";
import { installment } from "../src/game/economy";
import { encyclopediaSmallDeals } from "../src/game/encyclopedia";
import type { GameAction, GameState, GameConfig } from "../src/game/types";
const createGame = (options: Partial<GameConfig> = {}) => ({
  ...baseCreateGame({
    liquidityRisk: false,
    principalRate: 0,
    economicCycles: false,
    tutorials: false,
    ...options,
  }),
  roleRevealed: true,
});
async function seed(page: Page, state: GameState) {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("cashflow.v1.auto"))
      localStorage.setItem(
        "cashflow.v1.auto",
        JSON.stringify({
          name: "Test playtest",
          savedAt: new Date().toISOString(),
          state: s,
        }),
      );
  }, state);
  await page.goto("/");
}
async function readState(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("cashflow.v1.auto")!).state as GameState,
  );
}
async function dismissEvents(page: Page) {
  while ((await readState(page)).notices.length) {
    const n = (await readState(page)).notices.at(-1)!;
    await page
      .getByRole("button", { name: `Dismiss: ${n.title}`, exact: true })
      .click();
  }
}
function acknowledge(state: GameState): GameState {
  while (state.notices.length)
    state = reduceGame(state, { type: "ACKNOWLEDGE", id: state.notices[0].id });
  return state;
}
function completedMatch() {
  let game = createGame({
    profession: "designer",
    roundLimit: 25,
    seed: 123,
    speed: "instant",
  });
  function act(action: GameAction) {
    game = acknowledge(reduceGame(game, action));
  }
  for (const round of [1, 5, 12]) {
    game.round = round;
    for (let i = 0; i < game.players.length; i++) {
      game.current = i;
      game.phase = "end";
      game.decision = null;
      if (round === 1) act({ type: "BORROW", amount: 1000000 });
      else if (round === 5) {
        game.phase = "decision";
        game.decision = {
          kind: "opportunity",
          owner: i,
          card: smallDeals[0].id,
          transferred: false,
        };
        act({ type: "BUY" });
      } else {
        const debt = game.players[i].debts.find((d) => d.kind === "credit");
        if (debt && game.players[i].cash >= debt.principal)
          act({ type: "REPAY", debtId: debt.id });
        else act({ type: "REPAY", debtId: "bank", amount: 100000 });
      }
    }
  }
  game.round = 25;
  game.current = game.players.length - 1;
  game.phase = "end";
  game.decision = null;
  act({ type: "END" });
  return game;
}
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
}
test("desktop board, setup settings, keyboard dialog, and saved games", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Start my story" }).click();
  await page.getByRole("button", { name: "Turn off tutorials" }).click();
  await expect(
    page.getByRole("heading", { name: "Small moves. Bigger possibilities." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Roll the dice" }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: /Game board/ })).toBeVisible();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByText("Sandbox settings", { exact: true }).click();
  await expect(
    page.getByLabel("Optional principal autopay per round"),
  ).toHaveValue("0");
  await page.getByLabel("NPC opponents").selectOption("1");
  await page.getByLabel("Your starting difficulty").selectOption("hard");
  await expect(
    page.getByRole("switch", { name: /Enable adapted cards/ }),
  ).not.toBeChecked();
  await page.getByLabel("Round limit").selectOption("25");
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Meet your new life" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start my story" }).click();
  await expect(page.getByText("Round 1 / 25")).toBeVisible();
  await page.getByRole("button", { name: "Turn off tutorials" }).click();
  const configured = await readState(page);
  expect(configured.config.principalRate).toBe(0);
  expect(
    professions.find((p) => p.id === configured.players[0].profession)!
      .difficulty,
  ).toBe("hard");
  expect(configured.config.adaptedCards).toBe(false);
  await expect(
    page.getByRole("button", { name: "Market", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save & resume" }).click();
  await page.getByLabel("Save name 1").fill("My first city");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("Saved to slot 1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect.poll(async () => (await readState(page)).phase).not.toBe("roll");
  const after = await readState(page);
  await page.reload();
  expect((await readState(page)).rng).toBe(after.rng);
  expect((await readState(page)).dice).toEqual(after.dice);
  expect(errors).toEqual([]);
});
test("manual auditing rejects errors, survives refresh, and commits once", async ({
  page,
}) => {
  const s = createGame({ profession: "designer", accounting: "manual" });
  s.players[0].position = 7;
  s.rng = 1;
  await seed(page, s);
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect(
    page.getByRole("button", { name: "View details: Payday", exact: true }),
  ).toBeVisible();
  await dismissEvents(page);
  await expect(
    page.getByRole("heading", { name: "Let’s balance the books." }),
  ).toBeVisible();
  await page.getByLabel("Cash on hand", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Check my worksheet" }).click();
  await expect(page.getByText("Check this total and try again.")).toBeVisible();
  const pending = (await readState(page)).pending;
  expect(pending).not.toBeNull();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Let’s balance the books." }),
  ).toBeVisible();
  await expect(page.getByLabel("Cash on hand", { exact: true })).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "Reveal values" }).click();
  await page.getByRole("button", { name: "Check my worksheet" }).click();
  await expect(page.getByRole("button", { name: "End my turn" })).toBeVisible();
  const saved = await readState(page);
  expect(saved.pending).toBeNull();
  expect(saved.receipts).toHaveLength(1);
  expect(saved.players[0].cash).toBe(pending!.next.cash);
});
test("investments, debt management, and both full-game victory routes", async ({
  page,
}) => {
  const s = createGame({ profession: "designer" });
  s.phase = "decision";
  s.decision = {
    kind: "opportunity",
    owner: 0,
    card: smallDeals[0].id,
    transferred: false,
  };
  await seed(page, s);
  await page.getByRole("button", { name: "Make the investment" }).click();
  await dismissEvents(page);
  await expect(page.getByRole("button", { name: "End my turn" })).toBeVisible();
  await page.getByRole("button", { name: "Manage my finances" }).click();
  await page.getByRole("tab", { name: "Portfolio", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Garden studio" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Loans & debt" }).click();
  await page.getByLabel("Loan amount", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Borrow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View details: Bank loan", exact: true }),
  ).toBeVisible();
  await dismissEvents(page);
  await expect(page.getByRole("tab", { name: "Loans & debt" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Bank loan", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const dream = createGame({ profession: "designer" });
  dream.players[0].stage = "fast";
  dream.players[0].cash = 50000000;
  dream.phase = "decision";
  dream.decision = { kind: "dream", id: dream.players[0].dream };
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        "cashflow.v1.auto",
        JSON.stringify({
          name: "Dream test",
          savedAt: new Date().toISOString(),
          state,
        }),
      ),
    dream,
  );
  await page.reload();
  await page.getByRole("button", { name: "Make your dream real" }).click();
  await dismissEvents(page);
  await expect(
    page.getByRole("dialog").getByText("GAME COMPLETE", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("YOUR STORY IN NUMBERS");
});
test("financial freedom mode and grounded Fast Track entry render correctly", async ({
  page,
}) => {
  const s = createGame({ victory: "freedom" });
  s.players[0].assets.push({
    ...assetFromDeal(smallDeals[0], "test"),
    income: playerFinancials(s).expenses + 1,
  });
  await seed(page, s);
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect(
    page.getByRole("dialog").getByText("GAME COMPLETE", { exact: true }),
  ).toBeVisible();
  expect((await readState(page)).winners).toEqual(["p0"]);
});
test("tablet and phone fit, phone navigation and reduced motion work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start my story" }).click();
  await page.getByRole("button", { name: "Turn off tutorials" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Roll the dice" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/tablet.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("tab", { name: "The board", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Your move", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Roll the dice" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Finances", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Statement", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Game settings" }).click();
  await page.getByRole("switch", { name: /Reduced motion/ }).check();
  expect(await page.locator("html").getAttribute("data-motion")).toBe(
    "reduced",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "The board", exact: true }).click();
  await page.screenshot({ path: "test-results/phone.png", fullPage: true });
});
test("corrupt autosave is explained and not overwritten", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("cashflow.v1.auto", "damaged"),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "previous autosave needs attention",
  );
  await page.getByRole("button", { name: "Roll the dice" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("cashflow.v1.auto")),
  ).toBe("damaged");
});
test("desktop screenshot", async ({ page }) => {
  await seed(page, createGame({ profession: "designer", seed: 20261103 }));
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});
test("essential text contrast and accessible controls", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});

test("NPC summaries do not block the next turn and expand on demand", async ({
  page,
}) => {
  const game = createGame({
    profession: "designer",
    seed: 123,
    speed: "instant",
  });
  game.current = 1;
  game.rng = 1;
  await seed(page, game);
  await expect.poll(async () => (await readState(page)).current).toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const state = await readState(page);
  expect(
    state.notices.filter((n) => n.kind === "npc-turn").map((n) => n.player),
  ).toEqual(["p1", "p2", "p3"]);
  await expect(page.locator(".game-notification")).toHaveCount(2);
  await expect(page.locator(".older-notifications")).toBeVisible();
  if (await page.locator(".older-notifications").count())
    await page.locator(".older-notifications summary").click();
  await page.getByRole("button", { name: /View details: Maya/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("What happened");
  await expect(dialog).toContainText("Their thinking");
  await expect(dialog).toContainText("Notifications do not pause NPC play");
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/npc-details.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Roll the dice" }),
  ).toBeVisible();
  await page.reload();
  expect((await readState(page)).rng).toBe(state.rng);
});
test("notifications expire after 30 seconds while normal controls stay usable", async ({
  page,
}) => {
  await page.clock.install();
  const game = reduceGame(createGame({ profession: "designer" }), {
    type: "BORROW",
    amount: 100000,
  });
  await seed(page, game);
  await expect(
    page.getByRole("button", { name: "View details: Bank loan", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Roll the dice" }),
  ).toBeVisible();
  await page.clock.fastForward(28000);
  await expect(
    page.getByRole("button", { name: "View details: Bank loan", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(2100);
  await expect(page.locator(".game-notification")).toHaveCount(0);
  expect((await readState(page)).players[0].cash).toBe(game.players[0].cash);
});
test("automatic human events use small notices with optional central details", async ({
  page,
}) => {
  const game = createGame({ profession: "designer", seed: 123 });
  game.players[0].position = 6;
  game.rng = 1;
  await seed(page, game);
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End my turn" })).toBeVisible();
  await page
    .getByRole("button", { name: "View details: A new arrival", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "A new arrival",
    exact: true,
  });
  await expect(dialog).toContainText("+$350.00");
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/human-event-details.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close details" }).click();
  expect((await readState(page)).players[0].children).toBe(1);
});
test("a winning NPC opens the overview without waiting for its notification", async ({
  page,
}) => {
  const game = createGame({
    profession: "designer",
    seed: 123,
    speed: "instant",
  });
  game.current = 1;
  game.phase = "decision";
  game.players[1].stage = "fast";
  game.players[1].cash = 100000000;
  game.decision = { kind: "dream", id: game.players[1].dream };
  await seed(page, game);
  const results = page.getByRole("dialog", { name: "Look at what you built" });
  await expect(results).toBeVisible();
  await expect(results).toContainText("Maya won the game.");
  expect(
    (await readState(page)).notices.some((n) => n.kind === "npc-turn"),
  ).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  if (await page.locator(".older-notifications").count())
    await page.locator(".older-notifications summary").click();
  await page.getByRole("button", { name: /View details: Maya/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "The final move is complete.",
  );
});

test("results charts show change reasons, player comparisons, and specific coaching", async ({
  page,
}) => {
  const game = completedMatch();
  await seed(page, game);
  const dialog = page.getByRole("dialog", { name: "Look at what you built" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Every turn left a trace." }),
  ).toBeVisible();
  await expect(page.locator(".history-chart")).toHaveCount(4);
  await expect(page.locator(".review-scoreboard tbody tr")).toHaveCount(
    game.players.length,
  );
  // Isolate the human's line so the pointer unambiguously inspects their loan.
  for (const npc of game.players.slice(1))
    await page.getByRole("button", { name: npc.name, exact: true }).click();
  const chart = page.getByRole("group", { name: /Total debt chart/ });
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  const point = game.history.find(
    (h) => h.player === "p0" && h.title === "Bank loan",
  )!;
  const allIds = game.history.map((h) => h.id),
    start = Math.min(...allIds),
    end = Math.max(...allIds);
  const values = game.history
      .filter((h) => h.player === "p0")
      .map((h) => h.values.debt),
    low = Math.min(0, ...values),
    high = Math.max(0, ...values) > low ? Math.max(0, ...values) : low + 100000;
  await page.mouse.move(
    box.x +
      ((70 + ((point.id - start) / (end - start)) * 510) / 600) * box.width,
    box.y +
      ((22 + ((high - point.values.debt) / (high - low)) * 211) / 270) *
        box.height,
  );
  const tooltip = page
    .locator(".history-chart")
    .filter({ has: chart })
    .getByRole("status");
  await expect(tooltip).toContainText("Bank loan");
  await expect(tooltip).toContainText("$10,000.00");
  await chart.focus();
  await page.keyboard.press("End");
  await expect(tooltip).toContainText("Final position");
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.getByRole("checkbox", { name: "Net worth", exact: true }).check();
  await expect(page.locator(".history-chart")).toHaveCount(5);
  await page
    .getByRole("checkbox", { name: "Monthly expenses", exact: true })
    .check();
  await expect(page.locator(".history-chart")).toHaveCount(6);
  await expect(
    page.getByRole("heading", {
      name: "Check what your borrowing really earns",
    }),
  ).toBeVisible();
  await expect(page.locator(".game-coach")).toContainText(
    "You took $10,000 in personal bank loans",
  );
  await page.getByLabel("Review player").selectOption("p1");
  await expect(page.getByLabel("Review player")).toHaveValue("p1");
  await page.getByText(/Explore .*recorded events/).click();
  await expect(page.locator(".review-event-history")).toContainText(
    "Bought Garden studio",
  );
  await expectAccessible(page);
  await page
    .getByRole("checkbox", { name: "Net worth", exact: true })
    .uncheck();
  await page
    .getByRole("checkbox", { name: "Monthly expenses", exact: true })
    .uncheck();
  for (const npc of game.players.slice(1))
    await page.getByRole("button", { name: npc.name, exact: true }).click();
  await page
    .locator(".modal.review-modal")
    .evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({
    path: "test-results/game-review-desktop.png",
    fullPage: true,
  });
  await page.locator(".game-coach").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/game-coach-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".modal.review-modal")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page
    .locator(".modal.review-modal")
    .evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({
    path: "test-results/game-review-phone.png",
    fullPage: true,
  });
  const phoneChart = page.getByRole("group", { name: /Total debt chart/ });
  await phoneChart.scrollIntoViewIfNeeded();
  await phoneChart.dispatchEvent("pointerdown", {
    clientX: 250,
    clientY: 300,
    pointerType: "touch",
  });
  await expect(page.locator(".chart-tooltip")).toBeVisible();
  expect(
    await page
      .locator(".modal.review-modal")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expectAccessible(page);
});

test("adapted investments and the sourced card catalogue work on desktop and phone", async ({
  page,
}) => {
  const game = createGame({ profession: "designer" });
  game.phase = "decision";
  game.decision = {
    kind: "opportunity",
    owner: 0,
    transferred: false,
    card: "enc-sb0",
  };
  await seed(page, game);
  await expect(
    page.getByRole("heading", { name: "Vending Machine Route", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".deal-yield")).toContainText("$120.00");
  await page.locator(".decision-column .card-source summary").click();
  await expect(page.locator(".decision-column .card-source")).toContainText(
    "0.6%",
  );
  await expect(page.locator(".decision-column .card-source a")).toHaveAttribute(
    "href",
    "https://cashflow.lifestyle/encyclopedia/small-deals/",
  );
  await expectAccessible(page);
  await page.getByRole("button", { name: "Make the investment" }).click();
  expect((await readState(page)).players[0].assets[0].cardId).toBe("enc-sb0");
  await page.getByRole("button", { name: "Economic events & rules →" }).click();
  await page
    .getByText("Adapted card catalogue · 62 cards + 3 board events", {
      exact: true,
    })
    .click();
  await page
    .getByText("Small opportunities · 20 cards", { exact: true })
    .click();
  const region = page.getByRole("region", {
    name: "Small opportunities card table",
    exact: true,
  });
  await expect(region.getByRole("row")).toHaveCount(21);
  await expect(region).toContainText("TechNova Corp");
  await expect(region).toContainText("-$58.00");
  await expectAccessible(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await region.scrollIntoViewIfNeeded();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/adapted-cards-phone.png",
    fullPage: true,
  });
});

test("adapted stock buyers display and pay the per-share quote", async ({
  page,
}) => {
  const game = createGame({ profession: "designer" });
  game.players[0].assets = [
    assetFromDeal(encyclopediaSmallDeals[0], "tech", 10),
  ];
  game.phase = "decision";
  game.decision = {
    kind: "market",
    card: "enc-m2",
    responder: 0,
    remaining: [],
  };
  await seed(page, game);
  await expect(page.locator(".decision-panel")).toContainText(
    "$80.00 per share",
  );
  await expect(page.locator(".market-asset")).toContainText(
    "$800.00 net proceeds",
  );
  await page.getByRole("button", { name: "Sell", exact: true }).click();
  expect((await readState(page)).players[0].cash).toBe(
    game.players[0].cash + 80000,
  );
  expect((await readState(page)).players[0].assets).toHaveLength(0);
});

test("sourced expenses retain references in expandable event details", async ({
  page,
}) => {
  const game = createGame({ profession: "designer" });
  game.rng = 1;
  game.players[0].position = 3;
  game.decks.expense = ["enc-e0"];
  await seed(page, game);
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "View details: Subscription Creep",
      exact: true,
    })
    .click();
  await page.getByRole("dialog").locator(".card-source summary").click();
  await expect(page.getByRole("dialog").locator(".card-source")).toContainText(
    "No salary multiplier",
  );
  await expect(
    page.getByRole("dialog").locator(".card-source a"),
  ).toHaveAttribute("href", "https://cashflow.lifestyle/encyclopedia/doodads/");
  await expectAccessible(page);
});

test("custom debt repayments preview and proportionally reduce monthly payments", async ({
  page,
}) => {
  const game = createGame({ profession: "designer" });
  game.phase = "end";
  await seed(page, game);
  await page.getByRole("button", { name: "Manage my finances" }).click();
  await page.getByRole("tab", { name: "Loans & debt", exact: true }).click();
  const card = page.locator(".repayment-card").filter({
    has: page.getByRole("heading", { name: "Credit card", exact: true }),
  });
  await page
    .getByLabel("Repayment amount for Credit card", { exact: true })
    .fill("1500.50");
  await expect(card).toContainText("Monthly payment: $90.00 → $44.99");
  await card.getByRole("button", { name: "Repay", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await readState(page)).players[0].debts.find((d) => d.id === "credit")
          ?.principal,
    )
    .toBe(149950);
  expect(
    (await readState(page)).players[0].debts.find((d) => d.id === "credit")!
      .payment,
  ).toBe(4499);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Loans & debt" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/custom-repayment.png",
    fullPage: true,
  });
});
test("scheduled manual principal survives refresh and commits once", async ({
  page,
}) => {
  const game = createGame({
    profession: "designer",
    principalRate: 1,
    accounting: "manual",
  });
  game.phase = "end";
  const due = installment(game.players[0], 1);
  await seed(page, game);
  await page.getByRole("button", { name: "End my turn" }).click();
  await expect(
    page.getByRole("heading", { name: "Let’s balance the books." }),
  ).toBeVisible();
  expect((await readState(page)).pending?.receipt.title).toBe(
    "Scheduled principal payment",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Let’s balance the books." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reveal values" }).click();
  await page.getByRole("button", { name: "Check my worksheet" }).click();
  expect((await readState(page)).players[0].cash).toBe(
    game.players[0].cash - due,
  );
  await page.getByRole("button", { name: "End my turn" }).click();
  const saved = await readState(page);
  expect(
    saved.history.filter(
      (h) => h.player === "p0" && h.title === "Scheduled principal payment",
    ),
  ).toHaveLength(1);
});
test("liquidity warnings and forced sales appear without an automatic modal", async ({
  page,
}) => {
  const game = createGame({ liquidityRisk: true, profession: "designer" });
  game.players[0].debts = [];
  game.players[0].assets = [assetFromDeal(smallDeals[0], "rental")];
  game.players[0].cash = 100000;
  await seed(page, game);
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect(
    page.getByRole("heading", { name: "Liquidity crisis", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".game-notification.risk")).toContainText(
    "Low cash reserve",
  );
  await page.getByRole("button", { name: "Open financial statement" }).click();
  await expect(
    page.getByRole("dialog").locator(".liquidity-warning"),
  ).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/liquidity-warning.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Forced sale", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Roll the dice" }),
  ).toBeVisible();
  expect((await readState(page)).players[0].assets).toHaveLength(0);
  expect((await readState(page)).players[0].cash).toBe(250000);
});
test("guided manual accounting hides liquidity warning hints", async ({
  page,
}) => {
  const game = createGame({
    liquidityRisk: true,
    accounting: "manual",
    profession: "designer",
  });
  game.players[0].cash = 100000;
  await seed(page, game);
  await page.getByRole("button", { name: "Open financial statement" }).click();
  await expect(page.locator(".liquidity-warning")).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect(
    page.getByRole("heading", { name: "Liquidity crisis", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".game-notification.risk")).toHaveCount(0);
});
test("Corner shop unit explains negative cash flow before purchase and in the portfolio", async ({
  page,
}) => {
  const game = createGame({ profession: "designer", economicCycles: true });
  game.round = 12;
  game.economy.lastRound = 12;
  game.economy.active = [{ card: "rate-hike", start: 11, expires: 14 }];
  game.players[0].cash = 10000000;
  game.phase = "decision";
  game.decision = {
    kind: "opportunity",
    owner: 0,
    card: "sp6",
    transferred: false,
  };
  await seed(page, game);
  const breakdown = page.locator(".decision-panel .asset-cash-flow");
  await expect(page.locator(".deal-yield")).toContainText("-$445.00");
  await expect(breakdown).toContainText("$943.00/mo");
  await expect(breakdown).toContainText("−$1,388.00/mo");
  await expect(breakdown).toContainText("Emergency rate hike: financing ×2");
  await expect(breakdown).toContainText("Active through round 13");
  await expect(breakdown).toContainText("Without temporary events: $249.00/mo");
  await expect(breakdown).toContainText("currently costs $445.00 each month");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Make the investment" }).click();
  expect(playerFinancials(await readState(page)).passive).toBe(-44500);
  await page.getByRole("button", { name: "Manage my finances" }).click();
  await page.getByRole("tab", { name: "Portfolio", exact: true }).click();
  const holding = page.locator(".portfolio-item");
  await expect(holding).toContainText("-$445.00");
  await holding.getByText("Monthly income breakdown", { exact: true }).click();
  await expect(holding.locator(".asset-cash-flow")).toBeVisible();
  await expect(holding).toContainText("Emergency rate hike: financing ×2");
  await expectAccessible(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/corner-shop-financing-phone.png",
    fullPage: true,
  });
});

test("economic shocks reprice finances and expose the complete event catalogue", async ({
  page,
}) => {
  const game = createGame({ profession: "designer", economicCycles: true });
  game.round = 11;
  game.economy.lastRound = 10;
  game.economy.deck = ["rate-hike"];
  game.players[0].assets = [assetFromDeal(smallDeals[0], "rental")];
  game.rng = 1;
  const before = playerFinancials(game);
  await seed(page, game);
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect(page.locator(".game-notification.cycle")).toContainText(
    "Emergency rate hike",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await readState(page);
  expect(playerFinancials(saved).expenses).toBeGreaterThan(before.expenses);
  expect(playerFinancials(saved).passive).toBeLessThan(before.passive);
  expect(playerFinancials(saved).debt).toBe(before.debt);
  await page
    .getByRole("button", {
      name: "View details: Emergency rate hike",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("In-game relationship");
  await expect(
    page.getByRole("link", { name: /Real-life reference/ }),
  ).toHaveAttribute(
    "href",
    "https://www.federalreserve.gov/monetarypolicy/openmarket.htm",
  );
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/economic-cycle-details.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Economic events & rules →" }).click();
  await expect(page.locator(".economic-card")).toHaveCount(16);
  await expect(page.locator(".economic-card.positive")).toHaveCount(8);
  await expect(page.locator(".economic-card.negative")).toHaveCount(8);
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/event-catalogue.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/event-catalogue-phone.png",
    fullPage: true,
  });
  await expectAccessible(page);
});

for (const profession of ["engineer", "designer", "musician"]) {
  test(`role reveal for ${profession} survives refresh and closes once`, async ({
    page,
  }) => {
    const game = baseCreateGame({ profession, seed: 99 });
    await seed(page, game);
    const role = professions.find((p) => p.id === profession)!;
    const dialog = page.getByRole("dialog", { name: "Meet your new life" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: role.name, exact: true }),
    ).toBeVisible();
    await expect(dialog).toContainText(role.pursue);
    await expect(dialog).toContainText(role.avoid);
    await expect(dialog).toContainText("What your debt does");
    await expect(page.locator(`.motif-${role.motif}`)).toBeVisible();
    await expectAccessible(page);
    await page.screenshot({
      path: `test-results/role-${profession}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(dialog).toBeVisible();
    expect((await readState(page)).rng).toBe(game.rng);
    await page.getByRole("button", { name: "Start my story" }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => (await readState(page)).roleRevealed)
      .toBe(true);
    await page.reload();
    await expect(dialog).toHaveCount(0);
    expect((await readState(page)).players).toEqual(game.players);
  });
}

test("setup previews five roles per tier and enables adapted cards only on request", async ({
  page,
}) => {
  await seed(page, createGame());
  await page.getByRole("button", { name: "New game", exact: true }).click();
  for (const tier of ["easy", "standard", "hard"] as const) {
    await page.getByLabel("Your starting difficulty").selectOption(tier);
    await expect(page.locator(".role-preview-grid > div")).toHaveCount(5);
    for (const role of professions.filter((p) => p.difficulty === tier))
      await expect(page.locator(".role-preview-grid")).toContainText(role.name);
  }
  await page.getByText("Sandbox settings", { exact: true }).click();
  const adapted = page.getByRole("switch", { name: /Enable adapted cards/ });
  await expect(adapted).not.toBeChecked();
  await adapted.check();
  await page.getByLabel("NPC difficulty").selectOption("easy");
  await page.getByLabel("NPC opponents").selectOption("5");
  await page.getByLabel("Starting cash multiplier").selectOption("2");
  await page.getByLabel("Living expense multiplier").selectOption("1.25");
  await expect(page.locator(".role-preview")).toContainText(
    "Every NPC starts with the same role, cash, debt, income and expenses as you.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/role-setup-phone.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Meet your new life" }),
  ).toBeVisible();
  await expectAccessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const state = await readState(page);
  expect(state.config.roleDifficulty).toBe("hard");
  expect(state.config.difficulty).toBe("easy");
  expect(state.config.adaptedCards).toBe(true);
  expect(state.decks.small).toHaveLength(104);
  expect(
    professions.find((p) => p.id === state.players[0].profession)!.difficulty,
  ).toBe("hard");
  expect(state.players).toHaveLength(6);
  for (const npc of state.players.slice(1)) {
    expect(npc.profession).toBe(state.players[0].profession);
    expect(npc.debts).toEqual(state.players[0].debts);
    expect(npc.childCost).toBe(state.players[0].childCost);
    expect(playerFinancials(state, npc)).toEqual(
      playerFinancials(state, state.players[0]),
    );
  }
  await expect(
    page.getByRole("dialog", { name: "Meet your new life" }),
  ).toContainText(
    "Every player starts with this role and identical cash, debt, income and expenses.",
  );
  await page.getByRole("button", { name: "Start my story" }).click();
  await page.reload();
  expect((await readState(page)).players).toEqual(state.players);
});

test("dreams have individual icons, labels and a persistent chosen marker", async ({
  page,
}) => {
  const game = createGame({ dream: "forest" });
  game.players[0].stage = "fast";
  const board = fastTrackBoard(game.players);
  game.players[0].position = board.findIndex((s) => s.content === "forest");
  await seed(page, game);
  const yours = page.locator(".your-dream-space");
  await expect(yours).toHaveCount(1);
  await expect(yours).toHaveAttribute(
    "aria-label",
    /A cabin in the forest. Your dream/,
  );
  await expect(yours).toContainText("YOUR DREAM");
  await expect(yours).toContainText("FOREST CABIN");
  const symbols = new Set<string>();
  for (const dream of dreams.filter((d) =>
    game.players.some((p) => p.dream === d.id),
  )) {
    const space = page
      .locator(".board-space")
      .filter({ has: page.locator("title", { hasText: dream.name }) });
    await expect(space).toHaveCount(1);
    symbols.add(await space.locator("svg").innerHTML());
    expect(board.some((s) => s.content === dream.id)).toBe(true);
  }
  expect(symbols.size).toBe(game.players.length);
  await page.locator(".dream-map-key summary").click();
  await expect(page.locator(".dream-map-key")).toContainText(
    "A cabin in the forest · Yours ★",
  );
  await expect(page.locator(".dream-map-key li")).toHaveCount(
    game.players.length,
  );
  await expectAccessible(page);
  await page.screenshot({ path: "test-results/dream-map.png", fullPage: true });
});

test("notification filtering persists and clear all removes visible and hidden updates", async ({
  page,
}) => {
  await page.clock.install();
  const game = reduceGame(createGame({ profession: "designer" }), {
      type: "BORROW",
      amount: 100000,
    }),
    own = game.notices[0],
    f = playerFinancials(game),
    shared = {
      ...own,
      id: ++game.sequence,
      kind: "npc-turn" as const,
      player: "p1",
      title: "Maya changed your finances",
      changes: [
        {
          player: "p0",
          before: f,
          after: { ...f, cash: f.cash + 100, netWorth: f.netWorth + 100 },
        },
      ],
    },
    unrelated = {
      ...own,
      id: ++game.sequence,
      kind: "npc-turn" as const,
      player: "p1",
      title: "Maya unrelated turn",
      changes: [{ player: "p0", before: f, after: f }],
    };
  game.notices = [own, shared, unrelated];
  await seed(page, game);
  const clear = page.getByRole("button", {
    name: "Clear all notifications",
    exact: true,
  });
  const expand = page.locator(".older-notifications summary > span");
  const clearBox = (await clear.boundingBox())!,
    expandBox = (await expand.boundingBox())!;
  expect(
    Math.abs(
      clearBox.y + clearBox.height / 2 - expandBox.y - expandBox.height / 2,
    ),
  ).toBeLessThan(8);
  expect(clearBox.x).toBeGreaterThan(expandBox.x + expandBox.width);
  await expect(
    page.getByRole("checkbox", { name: "Only involving me" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/notification-controls-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Game settings" }).click();
  await page
    .getByRole("switch", { name: /Only notifications involving you/ })
    .check();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("button", {
      name: "View details: Maya unrelated turn",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View details: Bank loan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "View details: Maya changed your finances",
      exact: true,
    }),
  ).toBeVisible();
  expect((await readState(page)).notices).toHaveLength(3);
  await expectAccessible(page);
  await page.reload();
  await page.getByRole("button", { name: "Game settings" }).click();
  await expect(
    page.getByRole("switch", { name: /Only notifications involving you/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".game-notification")).toHaveCount(1);
  const phoneClear = (await clear.boundingBox())!,
    phoneExpand = (await expand.boundingBox())!;
  expect(
    Math.abs(
      phoneClear.y +
        phoneClear.height / 2 -
        phoneExpand.y -
        phoneExpand.height / 2,
    ),
  ).toBeLessThan(8);
  expect(phoneClear.x).toBeGreaterThan(phoneExpand.x + phoneExpand.width);
  await page.screenshot({
    path: "test-results/notification-controls-phone.png",
    fullPage: true,
  });
  await expectAccessible(page);
  await page
    .getByRole("button", { name: "Clear all notifications", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Game notifications" }),
  ).toHaveCount(0);
  const cleared = await readState(page);
  expect(cleared.notices).toEqual([]);
  expect(cleared.players).toEqual(game.players);
  expect(cleared.rng).toBe(game.rng);
  expect(cleared.history).toEqual(game.history);
  await page.getByRole("button", { name: "Game settings" }).click();
  await expect(
    page.getByRole("switch", { name: /Only notifications involving you/ }),
  ).toBeChecked();
});

test("coach distinguishes a large cash balance from a thin debt-linked shock buffer", async ({
  page,
}) => {
  const game = completedMatch(),
    p = game.players[0];
  game.config.liquidityRisk = true;
  p.cash = 5000000;
  p.debts = [
    {
      id: "home",
      name: "Home mortgage",
      kind: "home",
      principal: 49050000,
      payment: 20000,
    },
  ];
  p.assets = [];
  await seed(page, game);
  const coach = page.locator(".game-coach"),
    stats = coach.locator(".coach-player-stats");
  await coach.scrollIntoViewIfNeeded();
  await expect(stats).toContainText("Cash on hand $50,000.00");
  await expect(stats).toContainText("Total debt $490,500.00");
  await expect(stats).toContainText("Required reserve$49,050.00");
  await expect(stats).toContainText("Cash above required reserve$950.00");
  await expect(coach.locator(".coach-tip").first()).toContainText(
    "Protect the cash above your debt reserve",
  );
  await expect(coach.locator(".coach-tip").first()).toContainText(
    "$50.00 below the reserve",
  );
  await expect(coach).not.toContainText(
    "Consider only cash beyond your safety buffer",
  );
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/risk-coach-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await stats.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await stats.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await expect(stats.locator(".coach-risk")).toContainText("$950.00");
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/risk-coach-phone.png",
    fullPage: true,
  });
});

test("elimination opens a personal review, NPCs keep playing, and their finish opens the final report", async ({
  page,
}) => {
  const now = new Date("2026-11-05T12:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  const game = createGame({
    profession: "designer",
    opponents: 2,
    roundLimit: 25,
    speed: "fast",
  });
  game.round = 25;
  game.players[0].salary = 0;
  game.players[0].cash = 0;
  game.phase = "decision";
  game.decision = {
    kind: "insolvency",
    amount: 100000,
    title: "Unpayable bill",
  };
  for (const p of game.players.slice(1)) p.skip = 1;
  await seed(page, game);
  await page.getByRole("button", { name: "Use bankruptcy recovery" }).click();
  const personal = page.getByRole("dialog", {
    name: "Your game-over overview",
    exact: true,
  });
  await expect(personal).toBeVisible();
  await expect(personal).toContainText("Your game ended in round 25.");
  await expect(personal.locator(".history-chart")).toHaveCount(4);
  await expect(personal).toContainText("A word from your game coach.");
  const exit = (await readState(page)).players[0].elimination;
  expect(exit).toBeDefined();
  await page.clock.runFor(800);
  expect((await readState(page)).current).toBe(1);
  await expect(personal).toBeVisible();
  await page.screenshot({
    path: "test-results/personal-game-over.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Watch remaining players" }).click();
  expect((await readState(page)).personalReviewSeen).toBe(true);
  await page.reload();
  await expect(personal).toHaveCount(0);
  await page.getByRole("button", { name: "Open financial statement" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Eliminated in round 25.",
  );
  await page.getByRole("tab", { name: "Loans & debt", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Borrow", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .locator(".spectator-banner")
    .getByRole("button", { name: "Review my game" })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(personal).toBeVisible();
  expect(
    await personal.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/personal-game-over-phone.png",
    fullPage: true,
  });
  for (
    let steps = 0;
    steps < 8 && (await readState(page)).phase !== "finished";
    steps++
  )
    await page.clock.runFor(800);
  const results = page.getByRole("dialog", {
    name: "Look at what you built",
    exact: true,
  });
  await expect(results).toBeVisible();
  await expect(results).toContainText("GAME COMPLETE");
  await expect(results.locator(".review-scoreboard tbody tr")).toHaveCount(3);
  const final = await readState(page);
  expect(final.phase).toBe("finished");
  expect(final.winners).not.toContain("p0");
  expect(final.players[0].elimination).toEqual(exit);
  await page.clock.resume();
  await expectAccessible(page);
});

test("many notifications form a compact stack with every update still readable", async ({
  page,
}) => {
  await page.clock.install();
  let game = createGame({ profession: "designer" });
  for (let i = 0; i < 8; i++)
    game = reduceGame(game, { type: "BORROW", amount: 100000 });
  await seed(page, game);
  await expect(page.locator(".game-notification")).toHaveCount(2);
  await expect(page.locator(".older-notifications summary")).toContainText(
    "6 earlier updates",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".older-notifications summary").click();
  await expect(page.locator(".older-notifications button")).toHaveCount(6);
  await page.locator(".older-notifications button").first().click();
  await expect(page.getByRole("dialog", { name: "Bank loan" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".game-notification")).toHaveCount(1);
  await expect(page.locator(".older-notifications summary")).toContainText(
    "7 earlier updates",
  );
  await page.screenshot({
    path: "test-results/notification-pile-phone.png",
    fullPage: true,
  });
  await page.clock.fastForward(30100);
  await expect(page.locator(".game-notification")).toHaveCount(0);
  expect((await readState(page)).notices).toHaveLength(0);
});

test("wiki sits beside How to play and searches roles without changing the match", async ({
  page,
}) => {
  const game = createGame({ profession: "engineer", seed: 47 });
  await seed(page, game);
  const links = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button");
  await expect(links).toHaveText([
    "The game",
    "Market",
    "How to play",
    "Wiki",
    "Rulebook",
  ]);
  await page.getByRole("button", { name: "Wiki", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Game wiki" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("213 entries");
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog).toContainText("Page 2 of 9");
  await page.getByLabel("Search the wiki").fill("software engineer");
  await expect(dialog.getByRole("status")).toHaveText("1 entry");
  await page
    .getByRole("button", { name: "Read entry: Software engineer", exact: true })
    .click();
  const heading = dialog.getByRole("heading", {
    name: "Software engineer",
    exact: true,
  });
  await expect(heading).toBeFocused();
  await expect(dialog).toContainText("Your role");
  await expect(dialog).toContainText("$4,084");
  await expect(dialog).toContainText("Debt breakdown");
  await expect(dialog).toContainText(
    professions.find((p) => p.id === "engineer")!.avoid,
  );
  await expectAccessible(page);
  await page.screenshot({ path: "test-results/wiki-role.png", fullPage: true });
  await page.getByRole("button", { name: "Back to results" }).click();
  await expect(
    page.getByRole("button", {
      name: "Read entry: Software engineer",
      exact: true,
    }),
  ).toBeFocused();
  await page.getByLabel("Search the wiki").fill("zzzzmissing");
  await expect(
    page.getByRole("heading", { name: "No matching entries" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(dialog.getByRole("status")).toHaveText("213 entries");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await readState(page)).toEqual(game);
});

test("wiki explains opportunities, disabled adaptations, events and dreams", async ({
  page,
}) => {
  const game = createGame({ dream: "forest", dreamMultiplier: 2 });
  await seed(page, game);
  await page.getByRole("button", { name: "Wiki", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Game wiki" });
  const search = page.getByLabel("Search the wiki");
  const categories = page.getByRole("navigation", { name: "Wiki categories" });
  await categories.getByRole("button", { name: /^Opportunities/ }).click();
  await expect(dialog.getByRole("status")).toHaveText("89 entries");
  await search.fill("Garden studio");
  await page
    .getByRole("button", { name: "Read entry: Garden studio", exact: true })
    .click();
  await expect(dialog).toContainText("already includes financing costs");
  await expect(dialog).toContainText("New financing debt");
  await page.getByLabel("Card set").selectOption("adapted");
  await search.fill("Studio Apartment");
  await page
    .getByRole("button", { name: "Read entry: Studio Apartment", exact: true })
    .click();
  await expect(dialog).toContainText("Adapted · off in this match");
  await expect(dialog).toContainText("-$58 / mo");
  await dialog
    .getByText("Adapted card · source & rules", { exact: true })
    .click();
  await expect(
    dialog.getByRole("link", { name: /Cash Flow Lifestyle card encyclopedia/ }),
  ).toHaveAttribute("href", /encyclopedia/);
  await page.getByLabel("Card set").selectOption("all");
  await page.getByRole("button", { name: "Clear wiki search" }).click();
  await categories.getByRole("button", { name: /^Sudden events/ }).click();
  await expect(dialog.getByRole("status")).toHaveText("16 entries");
  await page
    .getByRole("button", {
      name: "Read entry: Emergency rate hike",
      exact: true,
    })
    .click();
  await expect(dialog).toContainText("+100%");
  await expect(dialog).toContainText("round 11");
  await expect(dialog).toContainText("Real-life parallel");
  await expect(dialog).toContainText("Cycles off in this match");
  await expectAccessible(page);
  await page.screenshot({
    path: "test-results/wiki-cycle.png",
    fullPage: true,
  });
  await categories.getByRole("button", { name: /^Market cards/ }).click();
  await expect(dialog.getByRole("status")).toHaveText("36 entries");
  await search.fill("split");
  await page.getByRole("button", { name: /Read entry:/ }).click();
  await expect(dialog).toContainText("doubles its share count");
  await page.getByRole("button", { name: "Clear wiki search" }).click();
  await categories.getByRole("button", { name: /^Life expenses/ }).click();
  await expect(dialog.getByRole("status")).toHaveText("39 entries");
  await search.fill("A leaky roof");
  await page
    .getByRole("button", { name: "Read entry: A leaky roof", exact: true })
    .click();
  await expect(dialog).toContainText("$850");
  await expect(dialog).toContainText("does not permanently increase");
  await page.getByRole("button", { name: "Clear wiki search" }).click();
  await categories.getByRole("button", { name: /^Dreams/ }).click();
  await page
    .getByRole("button", {
      name: "Read entry: A cabin in the forest",
      exact: true,
    })
    .click();
  await expect(dialog).toContainText("Your dream");
  await expect(dialog).toContainText("$260,000");
  await categories.getByRole("button", { name: /^Special events/ }).click();
  await expect(dialog.getByRole("status")).toHaveText("9 entries");
  await page
    .getByRole("button", { name: "Read entry: Liquidity crisis", exact: true })
    .click();
  await expect(dialog).toContainText("50% of current equity");
  await page.keyboard.press("Escape");
  expect(await readState(page)).toEqual(game);
});

test("wiki navigation, filters and entries fit a compact phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, createGame());
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Wiki", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Game wiki" });
  await expect(dialog).toBeVisible();
  await expectAccessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/wiki-phone.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Wiki categories" })
    .getByRole("button", { name: /^Roles/ })
    .click();
  await page.getByLabel("Search the wiki").fill("musician");
  await page
    .getByRole("button", { name: "Read entry: Session musician", exact: true })
    .click();
  await expect(dialog).toContainText("$80");
  await expectAccessible(page);
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.setViewportSize({ width: 520, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(
    page.getByRole("dialog", { name: "A little guidance goes a long way" }),
  ).toBeVisible();
});

for (const round of [10, 11]) {
  test(`small-opportunity mix switches at the cutoff and survives refresh, round ${round}`, async ({
    page,
  }) => {
    const game = createGame({ profession: "designer", seed: 94 });
    game.round = round;
    game.phase = "decision";
    game.decision = { kind: "opportunity", owner: 0, transferred: false };
    game.decks.small = ["sp0", "ss0", "sb0"];
    await seed(page, game);
    const deck = page.getByRole("button", { name: /^Small opportunities/ });
    await expect(deck).toContainText(
      round === 10
        ? "stocks & debt-free businesses favored 3×"
        : "Shares, side ventures",
    );
    await deck.click();
    await expect
      .poll(async () => {
        const state = await readState(page);
        return state.decision?.kind === "opportunity"
          ? state.decision.card
          : "";
      })
      .toBeTruthy();
    const state = await readState(page);
    expect(state.smallDeckStage).toBe(round === 10 ? "early" : "normal");
    expect(state.decks.small).toHaveLength(round === 10 ? 2 : 23);
    if (round === 10) expect(state.decision).toMatchObject({ card: "sb0" });
    else expect(new Set(state.decks.small).size).toBe(23);
    await page.reload();
    expect(await readState(page)).toEqual(state);
    await expect(
      page.getByRole("button", { name: "Make the investment" }),
    ).toBeVisible();
  });
}
