import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const version = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
).version;
const executable = path.resolve(
  process.argv[2] || `release/Cashflow-${version}-windows-x86.exe`,
);
const previousExecutable = process.env.CASHFLOW_UPGRADE_FROM;
const profile = await fs.mkdtemp(
  path.join(os.tmpdir(), "cashflow-desktop-test-"),
);
const output = path.resolve("test-results/desktop");
await fs.mkdir(output, { recursive: true });

async function assertX86(file) {
  const data = await fs.readFile(file);
  assert.equal(data.readUInt16LE(0), 0x5a4d, "Windows MZ header");
  const pe = data.readUInt32LE(0x3c);
  assert.equal(data.readUInt32LE(pe), 0x4550, "Windows PE header");
  assert.equal(
    data.readUInt16LE(pe + 4),
    0x14c,
    "Executable must be 32-bit x86",
  );
}

async function launch(binary = executable) {
  const activePort = path.join(profile, "DevToolsActivePort");
  await fs.rm(activePort, { force: true });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(
    binary,
    ["--remote-debugging-port=0", `--user-data-dir=${profile}`],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let diagnostics = "";
  child.stdout.on("data", (data) => {
    diagnostics = (diagnostics + data).slice(-6000);
  });
  child.stderr.on("data", (data) => {
    diagnostics = (diagnostics + data).slice(-6000);
  });
  let launchError;
  child.on("error", (error) => {
    launchError = error;
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (child.exitCode !== null)
      throw new Error(`App exited with code ${child.exitCode}: ${diagnostics}`);
    try {
      const port = (await fs.readFile(activePort, "utf8")).split("\n")[0];
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      const context = browser.contexts()[0];
      // Abort network requests so the smoke test also proves that the game runs offline.
      await context.route(/^https?:/, (route) => route.abort());
      const page = context.pages()[0] || (await context.waitForEvent("page"));
      await page.waitForURL("cashflow://app/");
      await page.reload();
      await page.waitForLoadState("load");
      return { browser, context, page, child };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  child.kill();
  throw new Error("The packaged app did not start within 90 seconds");
}

async function close(run) {
  const exited = new Promise((resolve) => {
    if (run.child.exitCode !== null) resolve();
    else run.child.once("exit", resolve);
  });
  // Closing the game window follows the same shutdown path as its title-bar X.
  void run.page.close().catch(() => {});
  let timeout;
  try {
    await Promise.race([
      exited,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("App did not exit cleanly")),
          20000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

let run;
const errors = [];
try {
  await assertX86(executable);
  await assertX86(path.resolve("release/win-ia32-unpacked/Cashflow.exe"));
  run = await launch(previousExecutable || executable);
  const { page } = run;
  page.on("pageerror", (error) => errors.push(error.message));
  if (!previousExecutable) {
    await expect(
      page.getByRole("dialog", { name: "Welcome to Cashflow" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Get started", exact: true })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "Start my story" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start my story" }).click();
  if (!previousExecutable) {
    await expect(
      page.getByRole("dialog", { name: "Cashflow tutorial" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Turn off tutorials" }).click();
  }
  await expect(page.getByRole("group", { name: /Game board/ })).toBeVisible();
  assert.equal(
    await page.evaluate(() => typeof window.require),
    "undefined",
    "Node is isolated from the game",
  );
  await page.getByRole("button", { name: "Pause NPC play" }).click();
  const readSave = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("cashflow.v1.auto")));
  const before = await readSave();
  await page.getByRole("button", { name: "Roll the dice" }).click();
  await expect
    .poll(async () => (await readSave()).state.rng)
    .not.toBe(before.state.rng);
  const saved = await readSave();
  await page.screenshot({ path: path.join(output, "windows-x86.png") });
  assert.deepEqual(errors, []);
  await close(run);
  run = await launch();
  run.page.on("pageerror", (error) => errors.push(error.message));
  if (previousExecutable) {
    await expect(
      run.page.getByRole("dialog", { name: "Welcome to Cashflow" }),
    ).toBeVisible();
    await run.page
      .getByRole("button", { name: "Get started", exact: true })
      .click();
  } else {
    await expect(
      run.page.getByRole("dialog", { name: "Welcome to Cashflow" }),
    ).toHaveCount(0);
  }
  await expect(
    run.page.getByRole("group", { name: /Game board/ }),
  ).toBeVisible();
  const restored = await run.page.evaluate(() =>
    JSON.parse(localStorage.getItem("cashflow.v1.auto")),
  );
  assert.equal(restored.state.config.seed, saved.state.config.seed);
  assert.equal(restored.state.rng, saved.state.rng);
  assert.equal(restored.state.roleRevealed, true);
  // Upgrades may add metadata; every field present in the original player must survive.
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(saved.state.players[0]).map((key) => [
        key,
        restored.state.players[0][key],
      ]),
    ),
    saved.state.players[0],
  );
  assert.equal(Boolean(restored.state.marketState), !previousExecutable);
  await expect(
    run.page.getByRole("button", { name: "Start my story" }),
  ).toHaveCount(0);
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
  await close(run);
  run = undefined;
  assert.deepEqual(errors, []);
  console.log(
    `PASS: portable EXE and runtime are x86; offline launch, game board, dice roll, renderer isolation, reference pages, clean shutdown, and ${previousExecutable ? "v1.0.0 save upgrade" : "saved-game restore"}.`,
  );
} finally {
  if (run) await close(run).catch(() => run.child.kill());
  // Keep the disposable test profile when a run fails, for diagnosis.
}
