import { test as base } from "@playwright/test";
export { expect, type Page } from "@playwright/test";

// Feature regressions use a returning player; welcome.spec.ts covers first launch.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() =>
      localStorage.setItem("cashflow.welcome.v1", "seen"),
    );
    await use(page);
  },
});
