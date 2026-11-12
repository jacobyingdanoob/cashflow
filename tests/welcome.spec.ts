import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createGame } from "../src/game/engine";

test("first launch explains the game and this edition before role and tutorial, once per profile", async ({
  page,
}) => {
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "Welcome to Cashflow" });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText(
    "passive income greater than your monthly expenses",
  );
  await expect(welcome).toContainText("original CASHFLOW board game");
  await expect(welcome.locator(".welcome-features section")).toHaveCount(6);
  await expect(
    page.getByRole("dialog", { name: "Meet your new life" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(welcome).toBeVisible();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cashflow.v1.auto")!).state,
  );
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Meet your new life" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start my story" }).click();
  await expect(
    page.getByRole("dialog", { name: "Cashflow tutorial" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Turn off tutorials" }).click();
  await page.reload();
  await expect(welcome).toHaveCount(0);
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cashflow.v1.auto")!).state,
  );
  expect(after.rng).toBe(before.rng);
  expect(after.players).toEqual(before.players);
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await page
    .getByRole("button", { name: "About Cashflow & this edition", exact: true })
    .click();
  await expect(welcome).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(welcome).toHaveCount(0);
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Meet your new life" }),
  ).toBeVisible();
  await expect(welcome).toHaveCount(0);
});

test("the introduction pauses a resumed NPC turn without changing its saved finances", async ({
  page,
}) => {
  const state = createGame({ seed: 123, speed: "instant", tutorials: false });
  state.roleRevealed = true;
  state.current = 1;
  await page.addInitScript((game) => {
    if (!localStorage.getItem("cashflow.v1.auto"))
      localStorage.setItem(
        "cashflow.v1.auto",
        JSON.stringify({
          name: "Resume",
          savedAt: new Date().toISOString(),
          state: game,
        }),
      );
  }, state);
  await page.clock.install();
  await page.goto("/");
  await expect(
    page.getByRole("dialog", { name: "Welcome to Cashflow" }),
  ).toBeVisible();
  await page.clock.runFor(6000);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cashflow.v1.auto")!).state,
  );
  expect(saved.rng).toBe(state.rng);
  expect(saved.players).toEqual(state.players);
  expect(saved.current).toBe(1);
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.clock.runFor(6000);
  expect(
    (
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("cashflow.v1.auto")!).state,
      )
    ).rng,
  ).not.toBe(state.rng);
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 600 },
]) {
  test(`welcome is readable and keyboard accessible at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const welcome = page.getByRole("dialog", { name: "Welcome to Cashflow" });
    await expect(welcome).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Get started", exact: true }),
    ).toBeInViewport();
    expect(
      await welcome.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.failureSummary),
      })),
    ).toEqual([]);
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("button", { name: "Get started", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Close dialog", exact: true }),
    ).toBeFocused();
    await page.screenshot({
      path: `test-results/welcome-${viewport.width}.png`,
    });
  });
}
