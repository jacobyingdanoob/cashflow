import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron, expect } from "@playwright/test";

assert.equal(process.platform, "darwin", "Run this check on a Mac");
const version = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
).version;
const archive = path.resolve(
  process.argv[2] || `release/Cashflow-${version}-macos-universal.zip`,
);
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), "cashflow-mac-test-"),
);
const extracted = path.join(temporary, "extracted");
const profile = path.join(temporary, "profile");
await fs.mkdir(extracted);
await fs.mkdir(profile);
await fs.mkdir("test-results/desktop", { recursive: true });
execFileSync("ditto", ["-x", "-k", archive, extracted]);
const appPath = path.join(extracted, "Cashflow.app");
const executable = path.join(appPath, "Contents", "MacOS", "Cashflow");
const architectures = execFileSync("lipo", ["-archs", executable], {
  encoding: "utf8",
}).trim();
assert.match(architectures, /x86_64/);
assert.match(architectures, /arm64/);
execFileSync("codesign", ["--verify", "--deep", "--strict", appPath]);
const minimum = execFileSync(
  "/usr/libexec/PlistBuddy",
  [
    "-c",
    "Print :LSMinimumSystemVersion",
    path.join(appPath, "Contents/Info.plist"),
  ],
  { encoding: "utf8" },
).trim();
console.log(
  `Universal architectures: ${architectures}; minimum macOS: ${minimum}; native runner: ${process.arch}`,
);

async function launch() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${profile}`],
    env,
    timeout: 60000,
  });
  const info = await app.evaluate(({ app }) => ({
    version: app.getVersion(),
    name: app.getName(),
    userData: app.getPath("userData"),
  }));
  assert.equal(info.version, version);
  assert.equal(info.name, "Cashflow");
  assert.equal(info.userData, profile);
  const page = await app.firstWindow();
  await page.context().route(/^https?:/, (route) => route.abort());
  await page.reload();
  return { app, page };
}

let run;
const errors = [];
try {
  run = await launch();
  run.page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    run.page.getByRole("dialog", { name: "Welcome to Cashflow" }),
  ).toBeVisible();
  await run.page.screenshot({ path: "test-results/desktop/macos-welcome.png" });
  await run.page
    .getByRole("button", { name: "Get started", exact: true })
    .click();
  await run.page.getByRole("button", { name: "Start my story" }).click();
  await run.page.getByRole("button", { name: "Turn off tutorials" }).click();
  await expect(
    run.page.getByRole("group", { name: /Game board/ }),
  ).toBeVisible();
  assert.equal(
    await run.page.evaluate(() => typeof window.require),
    "undefined",
  );
  await run.page.getByRole("button", { name: "Pause NPC play" }).click();
  const readSave = () =>
    run.page.evaluate(() =>
      JSON.parse(localStorage.getItem("cashflow.v1.auto")),
    );
  const before = await readSave();
  await run.page.getByRole("button", { name: "Roll the dice" }).click();
  await expect
    .poll(async () => (await readSave()).state.rng)
    .not.toBe(before.state.rng);
  const saved = await readSave();
  await run.page.screenshot({ path: "test-results/desktop/macos-game.png" });
  await run.app.close();
  run = await launch();
  run.page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    run.page.getByRole("dialog", { name: "Welcome to Cashflow" }),
  ).toHaveCount(0);
  await expect(
    run.page.getByRole("button", { name: "Start my story" }),
  ).toHaveCount(0);
  const restored = await readSave();
  assert.equal(restored.state.rng, saved.state.rng);
  assert.deepEqual(restored.state.players[0], saved.state.players[0]);
  for (const [button, title] of [
    ["Market", "The city markets"],
    ["Wiki", "Game wiki"],
    ["Rulebook", "Rulebook"],
  ]) {
    await run.page.getByRole("button", { name: button, exact: true }).click();
    await expect(
      run.page.getByRole("dialog", { name: title, exact: true }),
    ).toBeVisible();
    await run.page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  await run.app.close();
  run = undefined;
  assert.deepEqual(errors, []);
  console.log(
    "PASS: extracted universal Mac app, valid ad-hoc signature, first-launch welcome, offline gameplay, saved-game restore and reference pages.",
  );
} finally {
  if (run) await run.app.close();
}
