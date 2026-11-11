import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import {
  DEFAULT_CONFIG,
  dreams,
  professions,
  EARLY_OPPORTUNITY_ROUNDS,
  EARLY_OPPORTUNITY_WEIGHT,
} from "../game/content";
import { money } from "../game/engine";
import type { GameConfig } from "../game/types";
export default function Setup({
  onStart,
}: {
  onStart: (config: GameConfig) => void;
}) {
  const [c, set] = useState<GameConfig>({
      ...DEFAULT_CONFIG,
      seed: Math.max(1, Date.now() % 4294967295),
    }),
    [error, setError] = useState("");
  function change<K extends keyof GameConfig>(key: K, value: GameConfig[K]) {
    set((v) => ({ ...v, [key]: value }));
  }
  function select(
    key: keyof GameConfig,
    label: string,
    values: [string | number, string][],
    numeric = false,
  ) {
    return (
      <label className="form-field">
        {label}
        <select
          value={c[key] as string | number}
          onChange={(e) =>
            change(
              key,
              (numeric ? Number(e.target.value) : e.target.value) as never,
            )
          }
        >
          {values.map(([value, text]) => (
            <option value={value} key={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onStart(c);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
      className="setup-form"
    >
      <p className="muted">
        A new city. A fresh set of possibilities. Choose how you want to play.
      </p>
      <p className="small muted">
        For the first {EARLY_OPPORTUNITY_ROUNDS} rounds, stocks and debt-free
        small businesses have {EARLY_OPPORTUNITY_WEIGHT}× the draw weight in the
        small-opportunity deck. The regular mix returns in round{" "}
        {EARLY_OPPORTUNITY_ROUNDS + 1}.
      </p>
      <div className="setup-feature">
        <Sparkles size={23} />
        <div>
          <strong>Your life, your strategy.</strong>
          <p>
            Original and adapted opportunities. Thoughtful opponents. Room to
            dream.
          </p>
        </div>
      </div>
      <div className="form-grid">
        {select(
          "opponents",
          "NPC opponents",
          [1, 2, 3, 4, 5, 6, 7, 8].map((v) => [
            v,
            `${v} opponent${v === 1 ? "" : "s"}`,
          ]),
          true,
        )}
        {select("roleDifficulty", "Your starting difficulty", [
          ["easy", "Easy · a strong financial start"],
          ["standard", "Standard · a balanced challenge"],
          ["hard", "Hard · tight budgets & heavier debt"],
        ])}
        {select("accounting", "Accounting", [
          ["auto", "Automatic · focus on strategy"],
          ["manual", "Guided manual · keep your own books"],
        ])}
        <label className="toggle-row">
          <span>
            <strong>Interactive tutorial</strong>
            <small>
              A friendly dollar-bill guide explains the board and each new
              feature the first time you meet it. You can turn it off later.
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={c.tutorials}
            onChange={(e) => change("tutorials", e.target.checked)}
          />
        </label>
        {select("victory", "Your finish line", [
          ["full", "Full game · build toward your dream"],
          ["freedom", "Financial freedom · escape the Rat Race"],
        ])}
      </div>
      <div className="role-preview" aria-live="polite">
        <strong>One of these five lives will be yours.</strong>
        <p className="small muted">
          Your role is drawn randomly from this tier. Every NPC starts with the
          same role, cash, debt, income and expenses as you. Their decision
          skill is set separately in the sandbox.
        </p>
        <div className="role-preview-grid">
          {professions
            .filter((p) => p.difficulty === c.roleDifficulty)
            .map((p) => {
              const payment = p.debts.reduce((sum, d) => sum + d.payment, 0);
              const flow =
                p.salary -
                p.taxes -
                Math.round(p.living * c.livingExpenses) -
                payment;
              return (
                <div key={p.id} style={{ borderTopColor: p.accent }}>
                  <strong>{p.name}</strong>
                  <span>{money(flow)} / month left</span>
                  <small>
                    {money(p.salary)} salary ·{" "}
                    {money(p.debts.reduce((sum, d) => sum + d.principal, 0))}{" "}
                    debt
                  </small>
                </div>
              );
            })}
        </div>
      </div>
      <h3 className="form-section-title">
        <Star size={17} /> What are you working toward?
      </h3>
      <div className="dream-picker">
        {dreams.map((d) => (
          <button
            type="button"
            key={d.id}
            aria-pressed={c.dream === d.id}
            className={`dream-option ${c.dream === d.id ? "selected" : ""}`}
            onClick={() => change("dream", d.id)}
          >
            <span>{d.name}</span>
            <small>{money(d.cost * c.dreamMultiplier)}</small>
          </button>
        ))}
      </div>
      <details className="sandbox">
        <summary>
          <span>
            <SlidersHorizontal size={17} /> Sandbox settings
          </span>
          <ChevronDown size={17} />
        </summary>
        <p className="muted small">
          Financial settings apply equally to everyone and stay fixed during the
          match.
        </p>
        <div className="form-grid">
          <label className="toggle-row">
            <span>
              <strong>Enable adapted cards</strong>
              <small>
                Add 62 encyclopedia-inspired investment, market and expense
                cards to everyone’s decks. Off by default.
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={c.adaptedCards}
              onChange={(e) => change("adaptedCards", e.target.checked)}
            />
          </label>
          {select(
            "startingCash",
            "Starting cash multiplier",
            [0.5, 1, 2, 5].map((n) => [n, `${n}× starting cash`]),
            true,
          )}
          {select(
            "livingExpenses",
            "Living expense multiplier",
            [0.75, 1, 1.25].map((n) => [n, `${n}× household costs`]),
            true,
          )}
          <div className="callout small">
            <b>Lending rules</b>
            <p>
              Bank loans: 2% monthly. Type 1 purchase loans: 1% monthly. New
              debt must fit the 55% debt-to-income limit; starting role debt is
              excluded. Financed Type 1 down payments rise from 10% to 35%
              across purchases.
            </p>
          </div>
          {select(
            "incomeGoal",
            "Additional Fast Track income",
            [250000, 500000, 1000000, 2000000].map((n) => [
              n,
              `${money(n)} / month`,
            ]),
            true,
          )}
          {select(
            "dreamMultiplier",
            "Dream price multiplier",
            [0.5, 1, 2].map((n) => [n, `${n}× dream prices`]),
            true,
          )}
          {select(
            "roundLimit",
            "Round limit",
            [
              [0, "No limit"],
              ...[25, 50, 100, 200].map(
                (n) => [n, `${n} rounds`] as [number, string],
              ),
            ],
            true,
          )}
          {select("difficulty", "NPC difficulty", [
            ["easy", "Easy · learning the ropes"],
            ["standard", "Standard · a thoughtful challenge"],
            ["hard", "Hard · disciplined investors"],
          ])}
          {select("speed", "Game speed", [
            ["instant", "Instant"],
            ["fast", "Fast"],
            ["normal", "Relaxed"],
          ])}
          {select(
            "principalRate",
            "Optional principal autopay per round",
            [0, 0.5, 1, 2].map((n) => [
              n,
              n ? `${n}% of remaining balances` : "Off · repay when you choose",
            ]),
            true,
          )}
          <label className="toggle-row">
            <span>Liquidity risk · 10% cash reserve</span>
            <input
              type="checkbox"
              role="switch"
              checked={c.liquidityRisk}
              onChange={(e) => change("liquidityRisk", e.target.checked)}
            />
          </label>

          <label className="toggle-row">
            <span>Economic market trends · every 5 rounds</span>
            <input
              type="checkbox"
              role="switch"
              checked={c.economicCycles}
              onChange={(e) => change("economicCycles", e.target.checked)}
            />
          </label>
          <label className="form-field">
            Game seed
            <input
              type="number"
              min="1"
              max="4294967295"
              required
              value={c.seed}
              onChange={(e) => change("seed", Number(e.target.value))}
            />
          </label>
        </div>
        <p className="small muted">
          The role drawn sets identical starting finances for everyone.
          Principal repayments are optional unless you opt into autopay above.
          Matching seeds and settings reproduce the same initial game. A
          completed round gives every active player a turn.
          {c.liquidityRisk &&
            " Starting cash includes an additional reserve equal to 10% of the profession’s debt, so the opening mortgage does not trigger an immediate crisis."}
        </p>
      </details>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="setup-footer">
        <p className="small muted">
          Starting a new match replaces the autosave.
          <br />
          Use a named save slot to keep your current game.
        </p>
        <button className="button primary" type="submit">
          Let’s play <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
}
