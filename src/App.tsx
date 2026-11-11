import RoleReveal from "./components/RoleReveal";
import Market, { MarketChanges } from "./components/Market";
import { TrendBadge } from "./components/MarketTrend";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Flag,
  Heart,
  Landmark,
  Leaf,
  Menu,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Board, { Avatar } from "./components/Board";
import DecisionPanel from "./components/DecisionPanel";
import TutorialGuide, { TutorialTopic } from "./components/TutorialGuide";
import Modal from "./components/Modal";
import Setup from "./components/Setup";
import Finances from "./components/Finances";
import ActivityDialog from "./components/ActivityDialog";
import Notifications from "./components/Notifications";
import GameReview from "./components/GameReview";
import EconomicEvents, { EconomyBanner } from "./components/EconomicEvents";
import {
  DEFAULT_CONFIG,
  dreams,
  professions,
  profileNames,
} from "./game/content";
import {
  actingPlayer,
  createGame,
  money,
  playerFinancials,
  reduceGame,
} from "./game/engine";
import { npcStep } from "./game/npc";
import { loadGame, saveGame, saveInfo } from "./game/storage";
import type { ActivityNotice, GameAction, GameState } from "./game/types";
const Rulebook = lazy(() => import("./components/Rulebook"));
const Wiki = lazy(() => import("./components/Wiki"));
type Panel =
  | "new"
  | "finances"
  | "saves"
  | "settings"
  | "help"
  | "results"
  | "gameover"
  | "economy"
  | "wiki"
  | "market"
  | "rulebook"
  | null;
function boot() {
  try {
    const saved = loadGame();
    return {
      state:
        saved?.state ??
        createGame({
          ...DEFAULT_CONFIG,
          seed: Math.max(1, Date.now() % 4294967295),
        }),
      error: "",
    };
  } catch (e) {
    return { state: createGame(), error: (e as Error).message };
  }
}
function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem("cashflow.preferences") ?? "{}");
  } catch {
    return {};
  }
}
function SavePanel({
  game,
  onLoad,
  onNotify,
  onNew,
}: {
  game: GameState;
  onLoad: (s: GameState) => void;
  onNotify: (s: string) => void;
  onNew: () => void;
}) {
  const [tick, setTick] = useState(0),
    [names, setNames] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  return (
    <div className="save-panel">
      <p className="muted">
        A little pause doesn’t have to mean starting over. Saves stay in this
        browser on this device.
      </p>
      <div className="autosave-note">
        <ShieldCheck size={21} />
        <div>
          <strong>Your progress saves automatically.</strong>
          <p>
            Completed actions and unfinished accounting worksheets are included.
          </p>
        </div>
      </div>
      {["1", "2", "3"].map((slot) => {
        const info = saveInfo(slot);
        return (
          <div className="save-slot" key={`${slot}-${tick}`}>
            <div className="save-slot-number">0{slot}</div>
            <div className="save-slot-info">
              <label className="form-field">
                Save slot {slot}
                <input
                  aria-label={`Save name ${slot}`}
                  placeholder={`My next chapter ${slot}`}
                  value={names[slot] ?? info?.name ?? ""}
                  onChange={(e) =>
                    setNames((v) => ({ ...v, [slot]: e.target.value }))
                  }
                />
              </label>
              <small>
                {info?.damaged
                  ? "This slot is unreadable. Other slots are safe."
                  : info
                    ? `Round ${info.round} · ${new Date(info.savedAt).toLocaleString()}`
                    : "An empty page, ready when you are."}
              </small>
            </div>
            <div className="save-actions">
              <button
                className="button secondary small-button"
                onClick={() => {
                  try {
                    saveGame(
                      game,
                      slot,
                      names[slot]?.trim() || `My next chapter ${slot}`,
                    );
                    setTick((v) => v + 1);
                    onNotify(`Saved to slot ${slot}.`);
                  } catch {
                    setError(
                      "Your browser could not save this game. Check available browser storage.",
                    );
                  }
                }}
              >
                Save{info ? " over" : ""}
              </button>
              <button
                className="button primary small-button"
                disabled={!info || info.damaged}
                onClick={() => {
                  try {
                    const record = loadGame(slot);
                    if (record) onLoad(record.state);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Resume
              </button>
            </div>
          </div>
        );
      })}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <button className="text-button" onClick={onNew}>
        <Plus size={16} /> Start a new chapter instead
      </button>
    </div>
  );
}
function Help() {
  return (
    <div className="help-content">
      <div className="help-intro">
        <div className="decision-illustration sage">
          <Leaf size={35} />
        </div>
        <h3>
          A game about money.
          <br />A little more about possibility.
        </h3>
        <p>
          Build income that doesn’t depend on your paycheck. Make room for the
          life you want.
        </p>
      </div>
      <div className="help-steps">
        {[
          [
            "01",
            "Find your footing",
            "Your profession gives you a salary, savings, and recurring bills. Cash flow is income minus expenses. Collect it whenever you pass or land on Payday.",
          ],
          [
            "02",
            "Make thoughtful investments",
            "Opportunity spaces offer small or large deals. Buy shares, properties, or businesses to earn passive income. Keep enough cash for unexpected expenses. You can borrow in $1,000 increments.",
          ],
          [
            "03",
            "Find your financial freedom",
            "When passive income is strictly greater than total expenses, you qualify for the Fast Track at the start of your next turn. Your existing finances stay with you.",
          ],
          [
            "04",
            "Make your dream a reality",
            "In the full game, buy your chosen dream when you land on it, or reach the additional passive-income goal. A round limit ranks players by passive-income-to-expense ratio, then net worth.",
          ],
        ].map(([n, title, body]) => (
          <section key={n}>
            <span>{n}</span>
            <div>
              <h4>{title}</h4>
              <p>{body}</p>
            </div>
          </section>
        ))}
      </div>
      <details className="help-detail">
        <summary>Interactive tutorial</summary>
        <p>
          Enable the tutorial in the new-game options for a click-through guide
          led by a canvas-drawn dollar bill. It pauses play while it explains
          the goal, portfolio strip, board, dice, players, and first-time
          spaces. Each space category introduces itself on its first trigger,
          including when you cross Payday. The first three opportunity visits
          explain financed assets, debt-free purchases and stocks, one at a
          time. Portfolio and debt explain themselves the first time you open
          those views. Turn the guide off any time in the top-right settings.
        </p>
      </details>
      <details className="help-detail">
        <summary>What counts as passive income?</summary>
        <p>
          Recurring share dividends plus net property and business cash flow.
          Property and business figures already include financing and operating
          costs. Paying off their mortgage adds its financing payment back into
          income.
        </p>
      </details>
      <details className="help-detail">
        <summary>Trading, hardship, and the unexpected</summary>
        <p>
          Open your Portfolio to sell stocks immediately or list businesses and
          real estate. Businesses close in 1–3 rounds with a 5% quick-sale
          discount; property takes 1–3 rounds with a 15% discount. Matching
          market-space sales are immediate without these discounts. Income and
          financing continue until closing. Cards explicitly marked transferable
          can be offered to an NPC, who buys the investment and pays your
          proposed fee if it fits their strategy. Players cannot pool money or
          sell assets directly to one another.
        </p>
        <p>
          Life expenses are mandatory. Babies add recurring household costs, up
          to three children. Downsizing costs one month of expenses and two
          missed turns. Charity costs 10% of income and grants extra dice. On
          the Fast Track, audits and lawsuits cost half your cash; divorce costs
          all of it.
        </p>
        <p>
          If you cannot pay a bill, borrow, liquidate eligible assets for half
          their current equity, or enter bankruptcy recovery. Recovery attempts
          debt repayment, applies a one-time 50% reduction to car, credit-card,
          and retail balances and payments if needed, and loses three turns. If
          cash or monthly cash flow cannot recover, you are eliminated.
        </p>
        <p>
          Elimination opens your personal overview with charts and coaching.
          NPCs continue while you read; close the review to watch their turns.
          The final report opens when the match ends. Your exit finances stay
          fixed, and the review remains available from the spectator banner.
        </p>
      </details>
      <details className="help-detail">
        <summary>Debt repayments and liquidity</summary>
        <p>
          Principal repayments are optional. Autopay is off by default; at setup
          you can opt into scheduled payments of 0.5%, 1%, or 2% of each
          outstanding balance at turn end. A principal payment reduces cash and
          debt, separately from the recurring expenses collected at Payday. In
          Loans & debt, repay any custom amount, including cents. Paying half a
          balance halves its recurring payment; investment financing savings
          increase net passive income.
        </p>
        <p>
          When liquidity risk is enabled, cash must cover 10% of all debt at the
          start and end of your turn. A crisis requires a forced sale at half
          current equity or bankruptcy recovery. New games add an opening
          reserve to profession savings. Warning hints appear only in automatic
          accounting; the recovery rules apply in both modes.
        </p>
      </details>
      <details className="help-detail">
        <summary>Markets and notifications</summary>
        <p>
          In new games, market landings change stock, real-estate or business
          prices for everyone with 15%–50% shocks. Markets also move each round;
          a three-round economic trend is drawn every five rounds from round 5.
          Click its badge beside the round counter for details. Every eligible
          owner may sell or hold. All markets keep fluctuating during cycles,
          which tend toward 100% at extremes. Below 50%, finishing all market
          responses draws one random discounted asset for everyone to buy or
          pass in turn. Below 35%, a 5–10-round depression caps prices. Open
          Market for charts by round, and Rulebook for trading fees,
          capital-gains tax, early mortgage payoff penalties and opponent
          strategies.
        </p>
        <p>
          Turn summaries and automatic events appear in the bottom-right corner
          for 30 seconds. Click one to expand its financial details.
          Notifications and their details do not pause NPCs. The Pause control
          lets you stop NPC play when you need more time.
        </p>
        <p>
          Clear all sits beside Expand stack and removes every notification,
          including filtered updates. In the top-right settings, Only
          notifications involving you keeps your events and updates that change
          your finances. Hidden updates still expire after 30 seconds.
        </p>
      </details>
      <details className="help-detail">
        <summary>Manual accounting and your auditor</summary>
        <p>
          Record the affected totals after each transaction. Enter dollar
          amounts, including cents where necessary. Your auditor highlights
          errors and offers hints or the full answer. NPC play pauses until your
          worksheet balances. Change accounting mode at the beginning of your
          own turn.
        </p>
      </details>
      <details className="help-detail">
        <summary>Original content and simplified economics</summary>
        <p>
          This independent personal playtest uses original board artwork,
          professions, and dreams, plus original and adapted opportunities. The
          card catalogue credits Cash Flow Lifestyle and explains the
          adaptations. Finances are fixed game values, not investment forecasts.
          Personal bank loans default to 12% annual simple interest before
          economic effects. Scheduled principal is paid separately each round;
          custom repayments proportionally reduce future payments. There is no
          100× Fast Track windfall.
        </p>
        <a
          href="https://www.boardgameswizard.com/wp-content/uploads/2020/03/Cashflow-Rules-PDF.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Read the source rulebook ↗
        </a>
      </details>
    </div>
  );
}
export default function App() {
  const [initial] = useState(boot),
    [game, setGame] = useState(initial.state),
    [recovery, setRecovery] = useState(initial.error),
    [panel, setPanel] = useState<Panel>(null),
    [toast, setToast] = useState(""),
    [paused, setPaused] = useState(false),
    [mobileTab, setMobileTab] = useState("board"),
    [financialPlayerId, setFinancialPlayerId] = useState("p0"),
    [requestedTutorial, setTutorial] = useState<TutorialTopic | null>(null),
    [prefs, setPrefs] = useState(() => ({
      sound: false,
      notificationsOnlyMine: false,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
      ...getPrefs(),
    })),
    [menu, setMenu] = useState(false);
  const shownResults = useRef(false);
  const [activeNotice, setActiveNotice] = useState<ActivityNotice | null>(null);
  const tutorial: TutorialTopic | null =
    game.config.tutorials && game.roleRevealed
      ? !game.tutorialSeen.includes("intro")
        ? "intro"
        : (requestedTutorial ?? game.tutorialQueue?.[0] ?? null)
      : null;
  const showRole = !game.roleRevealed && !panel && !recovery && !activeNotice;
  const human = game.players[0],
    f = playerFinancials(game, human),
    actor = actingPlayer(game),
    current = game.players[game.current],
    freedom = Math.max(0, (f.passive / Math.max(1, f.expenses)) * 100);
  const showDiscount =
    game.decision?.kind === "discount" &&
    actor.human &&
    !panel &&
    !activeNotice &&
    !tutorial &&
    !showRole &&
    !recovery;
  const overlayOpen = !!(
    activeNotice ||
    panel ||
    showRole ||
    showDiscount ||
    tutorial
  );
  const notify = useCallback((message: string) => setToast(message), []);
  const keepDiscountOpen = useCallback(() => {}, []);
  const revealTutorialTarget = useCallback((selector: string) => {
    if (selector === ".game-board") setMobileTab("board");
    if (selector === ".decision-panel") setMobileTab("decision");
  }, []);
  const openPanel = useCallback(
    (next: Panel, topic?: TutorialTopic) => {
      if (next === "finances") setFinancialPlayerId("p0");
      setPanel(next);
      if (
        topic &&
        game.config.tutorials &&
        !(game.tutorialSeen ?? []).includes(topic)
      )
        setTutorial(topic);
    },
    [game.config.tutorials, game.tutorialSeen],
  );
  function sound() {
    if (!prefs.sound) return;
    try {
      const context = new AudioContext(),
        o = context.createOscillator(),
        g = context.createGain();
      o.connect(g);
      g.connect(context.destination);
      o.frequency.value = 620;
      g.gain.setValueAtTime(0.035, context.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      o.start();
      o.stop(context.currentTime + 0.12);
      o.onended = () => void context.close();
    } catch {
      /* Sound is optional on browsers without an audio context. */
    }
  }
  const dispatch = useCallback(
    (action: GameAction) => {
      setGame((s) => {
        try {
          return reduceGame(s, action);
        } catch (e) {
          queueMicrotask(() => notify((e as Error).message));
          return s;
        }
      });
    },
    [notify],
  );
  const finishTutorial = useCallback(() => {
    if (!tutorial) return;
    dispatch({ type: "TUTORIAL", key: tutorial });
    setTutorial(null);
  }, [dispatch, tutorial]);
  const disableTutorials = useCallback(() => {
    dispatch({ type: "TUTORIAL_MODE", enabled: false });
    setTutorial(null);
  }, [dispatch]);
  const playAction = (a: GameAction) => {
    if (a.type !== "DRAFT") sound();
    dispatch(a);
    if (a.type === "ROLL" || a.type === "DRAW") setMobileTab("decision");
  };
  const dismissNotice = useCallback(
    (id: number) => dispatch({ type: "ACKNOWLEDGE", id }),
    [dispatch],
  );
  const close = useCallback(() => {
    if (panel === "gameover") dispatch({ type: "ACKNOWLEDGE_GAME_OVER" });
    setPanel(null);
  }, [panel, dispatch]);
  useEffect(() => {
    if (recovery) return;
    try {
      saveGame(game);
    } catch {
      notify(
        "Browser storage is unavailable. Keep this tab open to preserve your current game.",
      );
    }
  }, [game, recovery, notify]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.motion = prefs.reducedMotion
      ? "reduced"
      : "full";
    try {
      localStorage.setItem("cashflow.preferences", JSON.stringify(prefs));
    } catch {
      /* Preferences do not block play. */
    }
  }, [prefs]);
  useEffect(() => {
    document.documentElement.dataset.speed = game.config.speed;
  }, [game.config.speed]);
  useEffect(() => {
    if (
      (actor.human && !(actor.eliminated && game.phase === "end")) ||
      !game.roleRevealed ||
      game.pending ||
      game.phase === "finished" ||
      (panel && panel !== "gameover") ||
      paused ||
      recovery ||
      tutorial
    )
      return;
    const id = setTimeout(
      () => {
        if (document.hidden) return;
        try {
          setGame((s) =>
            actingPlayer(s).human && actingPlayer(s).eliminated
              ? reduceGame(s, { type: "END" })
              : npcStep(s),
          );
        } catch (e) {
          setPaused(true);
          notify(`NPC play paused: ${(e as Error).message}`);
        }
      },
      game.config.speed === "instant"
        ? 65
        : game.config.speed === "fast"
          ? 700
          : 1600,
    );
    const visibility = () => {
      if (!document.hidden) setGame((s) => ({ ...s }));
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [game, actor.human, panel, paused, recovery, notify, tutorial]);
  useEffect(() => {
    if (game.phase !== "finished") {
      shownResults.current = false;
      if (
        human.eliminated &&
        !game.personalReviewSeen &&
        !game.pending &&
        !recovery &&
        !panel
      ) {
        setActiveNotice(null);
        setPanel("gameover");
      }
      return;
    }
    if (!game.pending && !recovery && !shownResults.current) {
      shownResults.current = true;
      setActiveNotice(null);
      setPanel("results");
    }
  }, [
    game.phase,
    game.personalReviewSeen,
    human.eliminated,
    game.pending,
    recovery,
    panel,
  ]);
  const latest = game.receipts.find((r) => r.player === human.id);
  return (
    <>
      <header className="site-header" inert={overlayOpen}>
        <div className="header-inner">
          <a
            href="#"
            className="wordmark"
            aria-label="Cashflow home"
            onClick={(e) => {
              e.preventDefault();
              setPanel(null);
            }}
          >
            <span className="brand-symbol">
              <span />
              <span />
              <span />
            </span>
            cashflow<span className="brand-dot">.</span>
          </a>
          <nav
            className={menu ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            <button
              className="nav-link active"
              onClick={() => {
                close();
                setMenu(false);
              }}
            >
              The game
              <span />
            </button>
            <button
              className="nav-link"
              onClick={() => {
                setPanel("market");
                setMenu(false);
              }}
            >
              Market <TrendingUp size={13} />
            </button>
            <button
              className="nav-link"
              onClick={() => {
                setPanel("help");
                setMenu(false);
              }}
            >
              How to play <ArrowUpRight size={13} />
            </button>
            <button
              className="nav-link"
              onClick={() => {
                setPanel("wiki");
                setMenu(false);
              }}
            >
              Wiki <BookOpen size={13} />
            </button>
            <button
              className="nav-link"
              onClick={() => {
                setPanel("rulebook");
                setMenu(false);
              }}
            >
              Rulebook <BookOpen size={13} />
            </button>
            <span className="local-status">
              <span /> LOCAL PLAYTEST
            </span>
          </nav>
          <div className="header-actions">
            <button
              className="icon-button sound-button"
              aria-label={prefs.sound ? "Mute sound" : "Enable sound"}
              onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}
            >
              {prefs.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Game settings"
              onClick={() => setPanel("settings")}
            >
              <Settings2 size={19} />
            </button>
            <span className="header-divider" />
            <button
              className="save-header"
              aria-label="Save & resume"
              onClick={() => setPanel("saves")}
            >
              <Save size={16} />
              <span>Save & resume</span>
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
          </div>
        </div>
      </header>
      <main className="page-shell" inert={overlayOpen}>
        {!game.marketState && (
          <EconomyBanner game={game} onOpen={() => setPanel("economy")} />
        )}
        {human.eliminated && game.phase !== "finished" && (
          <div className="spectator-banner" role="status">
            <div>
              <strong>Your game is over.</strong>
              <p>
                {paused
                  ? "NPC play is paused."
                  : "The remaining players are continuing. The final report will open when the match ends."}
              </p>
            </div>
            <button
              className="button secondary small-button"
              onClick={() => setPanel("gameover")}
            >
              Review my game
            </button>
          </div>
        )}
        {recovery && (
          <div role="alert" className="recovery-banner">
            <TriangleMessage />
            <div>
              <strong>Your previous autosave needs attention.</strong>
              <p>{recovery} We haven’t overwritten it.</p>
            </div>
            <button
              className="button secondary small-button"
              onClick={() => setPanel("saves")}
            >
              Choose a save
            </button>
            <button
              className="button primary small-button"
              onClick={() => setPanel("new")}
            >
              Start fresh
            </button>
          </div>
        )}
        <section className="page-intro">
          <div>
            <div className="eyebrow intro-eyebrow">
              <span /> A LITTLE STRATEGY. A DIFFERENT LIFE.
            </div>
            <h1>
              Small moves.<span> Bigger possibilities.</span>
            </h1>
            <p>Build your income. Find your freedom. Play your own way.</p>
          </div>
          <button className="button new-game" onClick={() => setPanel("new")}>
            <Plus size={17} /> New game
          </button>
        </section>
        <section
          className="financial-strip"
          aria-label="Your financial summary"
        >
          <div className="finance-stat cash-stat">
            <span className="stat-label">
              <Coins size={15} /> CASH ON HAND
            </span>
            <strong>{money(f.cash)}</strong>
            <span className="stat-description">
              Your next possibility starts here
            </span>
          </div>
          <div className="finance-stat">
            <span className="stat-label">
              <TrendingUp size={15} /> MONTHLY CASH FLOW
            </span>
            <strong className={f.flow < 0 ? "negative" : ""}>
              {f.flow >= 0 ? "+" : ""}
              {money(f.flow)}
              <small>/mo</small>
            </strong>
            <span className="stat-description">Income after your expenses</span>
          </div>
          <div className="finance-stat">
            <span className="stat-label">
              <Leaf size={15} /> PASSIVE INCOME
            </span>
            <strong>
              {money(f.passive)}
              <small>/mo</small>
            </strong>
            <span className="stat-description">
              Working for you, without you
            </span>
          </div>
          <div className="finance-stat">
            <span className="stat-label">
              <ArrowUpRight size={15} /> MONTHLY EXPENSES
            </span>
            <strong>
              {money(f.expenses)}
              <small>/mo</small>
            </strong>
            <span className="stat-description">
              Your financial freedom target
            </span>
          </div>
          <button
            className="financial-link"
            onClick={() => openPanel("finances", "portfolio")}
            aria-label="Open financial statement"
          >
            <ArrowUpRight size={22} />
          </button>
        </section>
        <div className="mobile-tabs" role="tablist" aria-label="Game views">
          {[
            ["board", "The board"],
            ["decision", game.pending ? "Worksheet" : "Your move"],
            ["finances", "Finances"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mobileTab === id}
              onClick={() => setMobileTab(id)}
            >
              {label}
              {id === "decision" && game.pending && <span />}
            </button>
          ))}
        </div>
        <div className={`play-layout mobile-${mobileTab}`}>
          <div className="board-column">
            <section className="board-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">
                    YOUR BOARD, YOUR JOURNEY
                  </span>
                  <h2>
                    The road to <em>more.</em>
                  </h2>
                </div>
                <div className="round-controls">
                  <TrendBadge game={game} />
                  <div className="round-badge">
                    <span /> Round{" "}
                    {Math.min(game.round, game.config.roundLimit || game.round)}
                    {game.config.roundLimit
                      ? ` / ${game.config.roundLimit}`
                      : ""}
                    <span className="round-separator">/</span>
                    {human.stage === "rat" ? "Rat Race" : "Fast Track"}
                  </div>
                </div>
              </div>
              <Board game={game} />
              <div className="board-legend">
                <span>
                  <i className="legend-dot opportunity" />
                  Opportunity
                </span>
                <span>
                  <i className="legend-dot market" />
                  The market
                </span>
                <span>
                  <i className="legend-dot expense" />
                  Life happens
                </span>
                <span>
                  <i className="legend-dot payday" />
                  Payday
                </span>
                <span className="legend-dream">
                  <Star size={12} />
                  Your dream awaits
                </span>
              </div>
              <div className="freedom-card">
                <div className="freedom-icon">
                  <Flag size={23} />
                </div>
                <div className="freedom-copy">
                  <div>
                    <strong>
                      {human.stage === "fast"
                        ? "You’re on the Fast Track."
                        : "Your ticket out of the Rat Race"}
                    </strong>
                    <span>{Math.round(freedom)}%</span>
                  </div>
                  <p>
                    {human.stage === "fast"
                      ? `${money(Math.max(0, f.passive - human.entryIncome))} / ${money(game.config.incomeGoal)} additional passive income`
                      : `${money(f.passive)} passive income / ${money(f.expenses)} monthly expenses`}
                  </p>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="Progress toward financial freedom"
                    aria-valuenow={Math.min(100, Math.round(freedom))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div style={{ width: `${Math.min(100, freedom)}%` }} />
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label="Learn about financial freedom"
                  onClick={() => setPanel("help")}
                >
                  <CircleHelp size={18} />
                </button>
              </div>
            </section>
            <div className="players-section">
              <div className="minor-heading">
                <h2>
                  Around the table <span>{game.players.length} players</span>
                </h2>
                <button
                  className="text-button"
                  aria-label={paused ? "Resume NPC play" : "Pause NPC play"}
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? <Play size={13} /> : <Pause size={13} />}{" "}
                  {paused ? "Resume" : "Pause"}
                </button>
              </div>
              <div className="player-cards">
                {game.players.map((p) => {
                  const f = playerFinancials(game, p),
                    active = p.id === current.id;
                  return (
                    <button
                      type="button"
                      className={`player-card ${active ? "current" : ""} ${p.eliminated ? "eliminated" : ""}`}
                      key={p.id}
                      aria-label={
                        p.human
                          ? "View your finances"
                          : `View ${p.name}’s finances`
                      }
                      onClick={() => {
                        setFinancialPlayerId(p.id);
                        setPanel("finances");
                      }}
                    >
                      <div className="player-top">
                        <Avatar player={p} size={42} />
                        <div>
                          <strong>
                            {p.name}
                            {p.human && <span className="you-label"> YOU</span>}
                          </strong>
                          <small>
                            {p.human
                              ? professions.find((pr) => pr.id === p.profession)
                                  ?.name
                              : profileNames[p.profile]}
                          </small>
                        </div>
                        {active && !p.eliminated && (
                          <span className="active-player-dot" />
                        )}
                      </div>
                      <div className="player-numbers">
                        <span>
                          Cash <strong>{money(f.cash, true)}</strong>
                        </span>
                        <span>
                          Passive{" "}
                          <strong>
                            {money(f.passive, true)}
                            <small>/mo</small>
                          </strong>
                        </span>
                      </div>
                      <div className="player-progress">
                        <span
                          style={{
                            width: `${Math.min(100, Math.max(0, (f.passive / Math.max(1, f.expenses)) * 100))}%`,
                            background: p.color,
                          }}
                        />
                      </div>
                      <div className="player-bottom">
                        <span>
                          {p.eliminated
                            ? "Out of the game"
                            : p.stage === "fast"
                              ? "Fast Track ↗"
                              : "Rat Race"}
                        </span>
                        <span>
                          {p.skip
                            ? `${p.skip} turns recovering`
                            : p.human
                              ? "Your next chapter"
                              : p.charity
                                ? "Giving back ♥"
                                : `${p.assets.length} investment${p.assets.length === 1 ? "" : "s"}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <aside className="decision-column">
            <div className="decision-panel">
              <div className="turn-heading">
                <span className={`turn-pill ${actor.human ? "" : "npc"}`}>
                  <span />
                  {game.phase === "finished"
                    ? "GAME COMPLETE"
                    : game.pending
                      ? "YOUR WORKSHEET"
                      : actor.human
                        ? "YOUR TURN"
                        : `${actor.name.toUpperCase()}’S TURN`}
                </span>
                <span className="turn-number">
                  {game.phase === "finished" ? (
                    <Star size={16} />
                  ) : (
                    <>
                      <span
                        className="turn-dot"
                        style={{ background: current.color }}
                      />
                      {game.config.accounting === "manual"
                        ? "Manual books"
                        : "Auto books"}
                    </>
                  )}
                </span>
              </div>
              <DecisionPanel
                key={`${game.current}-${game.round}-${game.decision?.kind ?? game.phase}-${game.decision?.kind === "opportunity" ? (game.decision.card ?? "deck") : ""}-${game.decision?.kind === "market" ? game.decision.responder : ""}`}
                game={game}
                dispatch={playAction}
                onFinances={() => {
                  const next =
                    game.phase === "finished"
                      ? "results"
                      : human.eliminated
                        ? "gameover"
                        : "finances";
                  if (next === "finances") openPanel(next, "portfolio");
                  else setPanel(next);
                }}
              />
            </div>
            <MarketChanges
              game={game}
              compact
              onOpen={() => setPanel("market")}
            />
            <div className="activity-section">
              <MarketChanges game={game} onOpen={() => setPanel("market")} />
            </div>
          </aside>
          <div className="mobile-finances">
            <Finances
              game={game}
              dispatch={playAction}
              onTabChange={(tab) => {
                const topic =
                  tab === "debt"
                    ? "debt"
                    : tab === "assets"
                      ? "portfolio"
                      : null;
                if (
                  topic &&
                  game.config.tutorials &&
                  !(game.tutorialSeen ?? []).includes(topic)
                )
                  setTutorial(topic);
              }}
            />
          </div>
        </div>

        {latest && (
          <div className="receipt-bar">
            <ShieldCheck size={16} />
            <span>
              <strong>Books balanced.</strong> {latest.title} · Cash{" "}
              {money(latest.before.cash)} → {money(latest.after.cash)}
            </span>
            <button
              className="text-button"
              onClick={() => openPanel("finances", "portfolio")}
            >
              View statement <ArrowRight size={13} />
            </button>
          </div>
        )}
        <footer className="page-footer">
          <span>
            <Leaf size={14} /> A little wiser with every move.
          </span>
          <span>
            Original & adapted cards. Simplified economics. Real possibilities.
          </span>
          <button className="text-button" onClick={() => setPanel("help")}>
            <BookOpen size={13} /> Game guide
          </button>
        </footer>
      </main>
      {panel && (
        <Modal
          hidden={!!activeNotice}
          eyebrow={
            panel === "results"
              ? "GAME COMPLETE"
              : panel === "gameover"
                ? "GAME OVER"
                : panel === "wiki"
                  ? "THE CITY FIELD GUIDE"
                  : "MAKE IT YOURS"
          }
          title={
            panel === "finances" && financialPlayerId !== "p0"
              ? `${game.players.find((p) => p.id === financialPlayerId)?.name ?? "Player"}’s financial statement`
              : (
                  {
                    new: "A new chapter",
                    finances: "A clearer financial picture",
                    saves: "Pick up where you left off",
                    settings: "Your kind of game",
                    help: "A little guidance goes a long way",
                    results: "Look at what you built",
                    gameover: "Your game-over overview",
                    economy: "The city economy",
                    wiki: "Game wiki",
                    market: "The city markets",
                    rulebook: "Rulebook",
                  } as const
                )[panel]
          }
          onClose={close}
          className={
            panel === "results" || panel === "gameover"
              ? "review-modal"
              : panel === "wiki"
                ? "wiki-modal"
                : ""
          }
          wide={
            panel === "new" ||
            panel === "finances" ||
            panel === "results" ||
            panel === "gameover" ||
            panel === "economy" ||
            panel === "market" ||
            panel === "rulebook"
          }
        >
          {panel === "new" ? (
            <Setup
              onStart={(config) => {
                setGame(createGame(config));
                setRecovery("");
                setPaused(false);
                setPanel(null);
                setMobileTab("board");
                notify("A fresh start. Your next move is yours.");
              }}
            />
          ) : panel === "gameover" ? (
            <>
              <div className="personal-review-note">
                <p>
                  NPCs continue while you read. Your charts and coach cover your
                  game up to elimination; the final table report opens
                  automatically when the match ends.
                </p>
                <button
                  className="button secondary small-button"
                  onClick={close}
                >
                  Watch remaining players <ArrowRight size={16} />
                </button>
              </div>
              <GameReview game={game} personal />
            </>
          ) : panel === "finances" || panel === "results" ? (
            <Finances
              key={`${panel}-${financialPlayerId}`}
              game={game}
              playerId={panel === "finances" ? financialPlayerId : undefined}
              dispatch={(a) => {
                playAction(a);
                if (
                  game.config.accounting === "manual" &&
                  (["REPAY", "BORROW", "SELL"].includes(a.type) ||
                    (a.type === "SELL_ANYTIME" &&
                      human.assets.find((asset) => asset.id === a.assetId)
                        ?.category === "stock"))
                ) {
                  setPanel(null);
                  setMobileTab("decision");
                }
              }}
              onTabChange={(tab) => {
                const topic =
                  tab === "debt"
                    ? "debt"
                    : tab === "assets"
                      ? "portfolio"
                      : null;
                if (
                  financialPlayerId === "p0" &&
                  topic &&
                  game.config.tutorials &&
                  !(game.tutorialSeen ?? []).includes(topic)
                )
                  setTutorial(topic);
              }}
              results={panel === "results"}
            />
          ) : panel === "saves" ? (
            <SavePanel
              game={game}
              onLoad={(s) => {
                setGame(s);
                setRecovery("");
                setPanel(null);
                setPaused(false);
                notify("Welcome back. Your game is ready.");
              }}
              onNotify={notify}
              onNew={() => setPanel("new")}
            />
          ) : panel === "wiki" ? (
            <Suspense fallback={<p role="status">Opening wiki…</p>}>
              <Wiki game={game} />
            </Suspense>
          ) : panel === "market" ? (
            <Market game={game} />
          ) : panel === "rulebook" ? (
            <Suspense fallback={<p role="status">Opening rulebook…</p>}>
              <Rulebook />
            </Suspense>
          ) : panel === "economy" ? (
            <EconomicEvents game={game} />
          ) : panel === "help" ? (
            <Help />
          ) : (
            <div className="settings-content">
              <p className="muted">
                Make a little space for the way you like to play.
              </p>
              <label className="toggle-row">
                <span>
                  <ShieldCheck size={19} />
                  <span>
                    <strong>Only notifications involving you</strong>
                    <small>
                      Your events and updates that change your finances
                    </small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={prefs.notificationsOnlyMine}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      notificationsOnlyMine: e.target.checked,
                    })
                  }
                />
              </label>
              <label className="toggle-row">
                <span>
                  <BookOpen size={19} />
                  <span>
                    <strong>Interactive tutorial</strong>
                    <small>
                      Explain the board and first-time features as you meet them
                    </small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={game.config.tutorials}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    dispatch({ type: "TUTORIAL_MODE", enabled });
                    if (!enabled) setTutorial(null);
                  }}
                />
              </label>
              <label className="toggle-row">
                <span>
                  <Volume2 size={19} />
                  <span>
                    <strong>A little sound</strong>
                    <small>Soft feedback when you make a move</small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={prefs.sound}
                  onChange={(e) =>
                    setPrefs({ ...prefs, sound: e.target.checked })
                  }
                />
              </label>
              <label className="toggle-row">
                <span>
                  <Sparkles size={19} />
                  <span>
                    <strong>Reduced motion</strong>
                    <small>Keep the experience calm and still</small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={prefs.reducedMotion}
                  onChange={(e) =>
                    setPrefs({ ...prefs, reducedMotion: e.target.checked })
                  }
                />
              </label>
              <label className="form-field">
                NPC and animation speed
                <select
                  value={game.config.speed}
                  onChange={(e) =>
                    dispatch({ type: "SPEED", speed: e.target.value as "fast" })
                  }
                >
                  <option value="instant">Instant</option>
                  <option value="fast">Fast</option>
                  <option value="normal">Relaxed</option>
                </select>
              </label>
              <label className="form-field">
                Your accounting mode
                <select
                  disabled={
                    game.phase !== "roll" ||
                    game.current !== 0 ||
                    !!game.pending
                  }
                  value={game.config.accounting}
                  onChange={(e) =>
                    dispatch({
                      type: "MODE",
                      accounting: e.target.value as "auto",
                    })
                  }
                >
                  <option value="auto">Automatic</option>
                  <option value="manual">Guided manual</option>
                </select>
                <small>
                  Change accounting at the start of your own turn, before
                  rolling.
                </small>
              </label>
              <div className="callout">
                <ShieldCheck size={20} />
                <div>
                  Everyone plays by the same financial rules.
                  <small>
                    Change economic settings by starting a new game.
                  </small>
                </div>
              </div>
              <dl className="settings-summary">
                <div>
                  <dt>Bank interest</dt>
                  <dd>
                    {game.marketState
                      ? "2% monthly · purchase loans 1%"
                      : `${game.config.annualRate}% annually`}
                  </dd>
                </div>
                <div>
                  <dt>NPC difficulty</dt>
                  <dd>{game.config.difficulty}</dd>
                </div>
                <div>
                  <dt>Game seed</dt>
                  <dd>{game.config.seed}</dd>
                </div>
                <div>
                  <dt>Victory</dt>
                  <dd>
                    {game.config.victory === "full"
                      ? "Dream or additional income"
                      : "Financial freedom"}
                  </dd>
                </div>
              </dl>
              <button
                className="button secondary full"
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                {paused ? "Resume NPCs" : "Pause NPCs"}
              </button>
            </div>
          )}
        </Modal>
      )}
      {activeNotice && (
        <ActivityDialog
          key={activeNotice.id}
          notice={activeNotice}
          game={game}
          onDismiss={() => setActiveNotice(null)}
        />
      )}
      {showDiscount && (
        <Modal
          title={
            game.pending
              ? game.pending.completeDiscount
                ? "Record your discount purchase"
                : "Record your financing"
              : "Discounted market offer"
          }
          eyebrow="A SHARED OPPORTUNITY"
          className="shared-discount-modal"
          dismissible={false}
          onClose={keepDiscountOpen}
        >
          <DecisionPanel
            key={`discount-${game.decision!.kind === "discount" ? game.decision!.card : ""}-${game.round}`}
            game={game}
            dispatch={playAction}
            onFinances={() => openPanel("finances", "portfolio")}
          />
        </Modal>
      )}
      {showRole && (
        <RoleReveal
          game={game}
          onContinue={() => dispatch({ type: "REVEAL_ROLE" })}
        />
      )}
      {tutorial && game.config.tutorials && (
        <TutorialGuide
          key={tutorial}
          topic={tutorial}
          onFinish={finishTutorial}
          onDisable={disableTutorials}
          onRevealTarget={revealTutorialTarget}
        />
      )}
      <div
        inert={showRole || !!activeNotice || showDiscount || !!tutorial}
        style={showDiscount ? { visibility: "hidden" } : undefined}
      >
        <Notifications
          notices={game.notices.filter(
            (n) => n.kind !== "risk" || game.config.accounting === "auto",
          )}
          onDismiss={dismissNotice}
          onExpand={setActiveNotice}
          onClear={() => dispatch({ type: "CLEAR_NOTIFICATIONS" })}
          playerId={human.id}
          onlyMine={prefs.notificationsOnlyMine}
        />
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
function TriangleMessage() {
  return <ShieldCheck size={26} />;
}
