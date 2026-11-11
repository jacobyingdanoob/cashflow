import { test, expect, type Page } from "@playwright/test";
import { createGame } from "../src/game/engine";
import type { GameState } from "../src/game/types";

async function startTutorial(page: Page, opponents = 4) {
  const state = createGame({ tutorials: true, opponents, seed: 123 });
  state.roleRevealed = true;
  await seedTutorial(page, state);
}

async function seedTutorial(page: Page, state: GameState) {
  await page.addInitScript((game) => {
    localStorage.setItem(
      "cashflow.v1.auto",
      JSON.stringify({
        name: "Tutorial layout",
        savedAt: new Date().toISOString(),
        state: game,
      }),
    );
  }, state);
  await page.goto("/");
  await expect(
    page.getByRole("dialog", { name: "Cashflow tutorial" }),
  ).toBeVisible();
}

async function expectFeatureVisible(page: Page, selector: string) {
  await expect(page.locator(".tutorial-card")).toHaveAttribute(
    "data-target",
    selector,
  );
  await expect(page.locator(".tutorial-card")).toHaveAttribute(
    "data-placement",
    /left|right|above|below/,
  );
  await expect
    .poll(async () =>
      page.evaluate((targetSelector) => {
        const card = document
          .querySelector(".tutorial-card")!
          .getBoundingClientRect();
        const avatar = document
          .querySelector(".tutorial-card canvas")!
          .getBoundingClientRect();
        const feature = Array.from(document.querySelectorAll(targetSelector))
          .map((node) => node.getBoundingClientRect())
          .find((r) => r.width > 0 && r.height > 0)!;
        const overlap =
          Math.min(card.right, feature.right) -
            Math.max(card.left, feature.left) >
            0 &&
          Math.min(card.bottom, feature.bottom) -
            Math.max(card.top, feature.top) >
            0;
        return {
          overlap,
          featureVisible:
            feature.top >= 0 &&
            feature.bottom <= innerHeight + 1 &&
            feature.left >= 0 &&
            feature.right <= innerWidth + 1,
          cardVisible:
            card.top >= 0 &&
            card.bottom <= innerHeight + 1 &&
            card.left >= 0 &&
            card.right <= innerWidth + 1,
          avatarWithText:
            avatar.top >= card.top &&
            avatar.bottom <= card.bottom &&
            avatar.left >= card.left &&
            avatar.right <= card.right,
        };
      }, selector),
    )
    .toEqual({
      overlap: false,
      featureVisible: true,
      cardVisible: true,
      avatarWithText: true,
    });
}

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["tablet", { width: 768, height: 1024 }],
  ["phone", { width: 390, height: 844 }],
  ["small phone", { width: 390, height: 600 }],
] as const) {
  test(`${name}: the guide stays together and scrolls to unobstructed features`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await startTutorial(page, 8);
    const next = page.getByRole("button", { name: "Next", exact: true });
    await next.click();
    // The first financial feature must also be brought back into view when
    // the player has scrolled down during a general introduction.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await next.click();
    await expectFeatureVisible(page, ".financial-strip");
    await next.click();
    await expectFeatureVisible(page, ".game-board");
    await next.click();
    await expectFeatureVisible(page, ".players-section");
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await next.click();
    await page.getByRole("button", { name: "Got it", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Cashflow tutorial" }),
    ).toHaveCount(0);
    expect(
      await page
        .locator(".players-section")
        .evaluate((element) => (element as HTMLElement).style.maxHeight),
    ).toBe("");
    expect(await page.evaluate(() => document.body.style.paddingBottom)).toBe(
      "",
    );
  });
}

test("finance guides reveal their modal target and clean up when disabled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startTutorial(page);
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Open financial statement" }).click();
  await expectFeatureVisible(page, ".finances-modal .tabs");
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("tab", { name: "Loans & debt" }).click();
  await expectFeatureVisible(page, ".finances-modal .tabs");
  await page.getByRole("button", { name: "Turn off tutorials" }).click();
  await expect(
    page.getByRole("dialog", { name: "Cashflow tutorial" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "A clearer financial picture" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".modal")
      .evaluate((element) => (element as HTMLElement).style.paddingBottom),
  ).toBe("");
});

test("resizing moves the whole guide without covering the board", async ({
  page,
}) => {
  await startTutorial(page);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await expectFeatureVisible(page, ".game-board");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectFeatureVisible(page, ".game-board");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectFeatureVisible(page, ".game-board");
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectFeatureVisible(page, ".game-board");
});

for (const topic of ["space", "event"] as const) {
  test(`phone: ${topic} guide reveals its live feature`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = createGame({ tutorials: true, seed: 123 });
    state.roleRevealed = state.tutorialDone = true;
    state.tutorialSeen = topic === "event" ? ["intro", "space"] : ["intro"];
    state.tutorialQueue = [topic];
    state.phase = "decision";
    state.decision = { kind: "opportunity", owner: 0, transferred: false };
    state.players[0].position = 1;
    state.notices.push({
      id: ++state.sequence,
      kind: "event",
      player: "p0",
      round: 1,
      title: "Opportunity knocks",
      description: "Choose an opportunity deck.",
      changes: [],
      events: [],
      reasons: [],
      dice: [],
    });
    await seedTutorial(page, state);
    await expectFeatureVisible(
      page,
      topic === "space" ? ".decision-panel" : ".notification-stack",
    );
    await page.getByRole("button", { name: "Turn off tutorials" }).click();
    await expect(
      page.getByRole("dialog", { name: "Cashflow tutorial" }),
    ).toHaveCount(0);
  });
}

test("NPC play waits throughout an anchored introduction", async ({ page }) => {
  const state = createGame({ tutorials: true, seed: 123, speed: "instant" });
  state.roleRevealed = true;
  state.current = 1;
  await seedTutorial(page, state);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await expectFeatureVisible(page, ".game-board");
  // Instant NPC turns would otherwise advance every 65 ms.
  await page.waitForTimeout(350);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cashflow.v1.auto")!).state,
  );
  expect([saved.current, saved.phase, saved.round, saved.rng]).toEqual([
    1,
    "roll",
    1,
    state.rng,
  ]);
});
