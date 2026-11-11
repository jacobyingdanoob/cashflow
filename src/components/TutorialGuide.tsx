import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, CircleDollarSign, X } from "lucide-react";
import useTutorialPlacement from "./useTutorialPlacement";

import type { TutorialTopic } from "../game/types";
export type { TutorialTopic } from "../game/types";

type TutorialSlide = {
  eyebrow: string;
  title: string;
  body: string;
  accent: "teal" | "gold" | "coral" | "purple";
  target?: string;
};

const introSlides: TutorialSlide[] = [
  {
    eyebrow: "WELCOME TO CASHFLOW",
    title: "Your paycheck is the beginning, not the finish line.",
    body: "Build income from investments, keep an eye on risk, and make room for the life you want. Every choice changes your monthly picture.",
    accent: "teal",
  },
  {
    eyebrow: "YOUR GOAL",
    title: "Make passive income cover your expenses.",
    body: "Escape the Rat Race when income that keeps arriving without your next shift is greater than your monthly expenses. In the full game, reach your dream or your extra-income goal too.",
    accent: "gold",
  },
  {
    eyebrow: "THE GREEN PORTFOLIO",
    title: "Start with the numbers that matter most.",
    body: "The green strip at the top shows cash, monthly cash flow, passive income, and expenses. Click the arrow to open your full statement, portfolio, debt, and transaction history.",
    accent: "teal",
    target: ".financial-strip",
  },
  {
    eyebrow: "THE CITY MAP",
    title: "Move around the board one roll at a time.",
    body: "Roll the dice to move. Payday adds your monthly cash flow. Opportunities offer investments, markets reprice eligible holdings, and life spaces bring costs or choices.",
    accent: "coral",
    target: ".game-board",
  },
  {
    eyebrow: "YOUR TABLE",
    title: "Everyone plays by the same rules.",
    body: "You and the NPCs begin with the same role, cash, debt, income, and expenses. Their different personalities change how they use the same information, not the odds or the rules.",
    accent: "teal",
    target: ".players-section",
  },
  {
    eyebrow: "A SMALL HABIT",
    title: "Keep a reserve before chasing growth.",
    body: "Debt can help you buy an asset, but it also creates a monthly bill. Leave room for surprises, read each deal, and use Loans & debt when you want to repay a custom amount.",
    accent: "gold",
  },
];

const topicSlides: Record<Exclude<TutorialTopic, "intro">, TutorialSlide[]> = {
  "space-opportunity": [
    {
      eyebrow: "OPPORTUNITY SPACE",
      title: "A chance to build your income.",
      body: "Choose Small deals or Large deals to reveal an investment. Compare cash needed, monthly income and debt before buying. Passing is always allowed. We’ll introduce one asset type on each of your first three opportunity visits.",
      accent: "teal",
      target: ".decision-panel",
    },
  ],
  "space-market": [
    {
      eyebrow: "MARKET SPACE",
      title: "The market just moved for everyone.",
      body: "A market landing changes stock, property or business prices by 15%–50%. Everyone’s eligible holdings are revalued. Owners may sell immediately at the new price or hold. Falling business and stock prices also reduce operating income slightly; debts stay the same.",
      accent: "teal",
      target: ".decision-panel",
    },
  ],
  "space-life": [
    {
      eyebrow: "LIFE HAPPENS",
      title: "Make room for unexpected costs.",
      body: "Life happens spaces draw a mandatory expense. Family and legal events can also change your finances. Check the amount in your receipt; if cash is short, the decision panel explains borrowing and recovery. Keep a reserve above any debt-linked cash requirement.",
      accent: "coral",
      target: ".decision-panel",
    },
  ],
  "space-payday": [
    {
      eyebrow: "PAYDAY",
      title: "Collect what your monthly budget earns.",
      body: "Passing or landing on Payday collects salary plus passive income minus recurring expenses. Negative monthly cash flow creates a bill instead. Each crossed Payday pays once; landing does not pay a second time. Optional principal autopay is separate.",
      accent: "gold",
      target: ".financial-strip",
    },
  ],
  "space-special": [
    {
      eyebrow: "PURPLE SPECIAL EVENTS",
      title: "Check which special event you reached.",
      body: "Give back is optional: donate 10% of monthly income for extra dice. Downsized charges one month of expenses and skips two turns. Divorce consumes cash on hand. Each event works differently, so read its result and next choice before continuing.",
      accent: "purple",
      target: ".decision-panel",
    },
  ],
  "asset-1": [
    {
      eyebrow: "ASSET TYPES · 1 OF 3",
      title: "Type 1: an asset with financing.",
      body: "These properties or businesses include a mortgage. Down payments rise with financed purchases: 10%, 15%, 20%, 25%, then 35%. Net income already subtracts mortgage financing. An optional purchase loan costs 1% monthly; new debt must fit the 55% income limit. Budget the 5% fee and a cash reserve too.",
      accent: "coral",
      target: ".decision-panel",
    },
  ],
  "asset-2": [
    {
      eyebrow: "ASSET TYPES · 2 OF 3",
      title: "Type 2: a one-time purchase.",
      body: "A debt-free property or business costs its full price plus the 5% acquisition fee, with no included mortgage. Income still responds to applicable market conditions. Borrowing to fund the purchase creates separate debt and interest, so it may consume the profit.",
      accent: "teal",
      target: ".decision-panel",
    },
  ],
  "asset-3": [
    {
      eyebrow: "ASSET TYPES · 3 OF 3",
      title: "Type 3: stocks and shares.",
      body: "Choose how many whole shares to buy. Some pay dividends; others rely on price gains. Stocks have no acquisition or selling fee and can be sold anytime from Portfolio. Positive sale profits are taxed at 20%; a falling price can still produce a loss.",
      accent: "gold",
      target: ".decision-panel",
    },
  ],
  portfolio: [
    {
      eyebrow: "YOUR PORTFOLIO",
      title: "This is your financial worksheet.",
      body: "Statement shows the monthly picture. Portfolio lists your holdings and sale controls: stocks sell now; businesses and property take 1–3 rounds at a discount. Transactions explain what changed and why.",
      accent: "teal",
      target: ".finances-modal .tabs",
    },
  ],
  debt: [
    {
      eyebrow: "LOANS & DEBT",
      title: "Debt is a choice with a recurring cost.",
      body: "Ordinary new bank loans cost 2% monthly; Type 1 purchase loans cost 1%. New debt is limited to 55% of income after operating costs and mortgage financing, excluding starting role debt. Borrow in $1,000 steps and repay any custom amount to lower future payments. Keep enough cash for reserves and surprises.",
      accent: "coral",
      target: ".finances-modal .tabs",
    },
  ],
  space: [
    {
      eyebrow: "A NEW SPACE",
      title: "Read the space before you act.",
      body: "Some spaces resolve automatically. Others pause for a choice, such as buying an opportunity, answering a market, or deciding on charity. The decision panel always explains the next legal move.",
      accent: "gold",
      target: ".decision-panel",
    },
  ],
  event: [
    {
      eyebrow: "AN EVENT JUST HAPPENED",
      title: "Unexpected costs are part of the lesson.",
      body: "Life events, market moves, and economic trends can change cash, value, or income. Check the receipt and your updated statement before your next decision.",
      accent: "coral",
      target: ".notification-stack",
    },
  ],
};

function DollarAvatar({ accent }: { accent: TutorialSlide["accent"] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const size = 104;
    const ratio = window.devicePixelRatio || 1;
    node.width = size * ratio;
    node.height = size * ratio;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const paper =
      accent === "purple"
        ? "#e6dcef"
        : accent === "coral"
          ? "#f3d8cd"
          : accent === "gold"
            ? "#f2e0ad"
            : "#d9ebe3";
    const ink =
      accent === "purple"
        ? "#655077"
        : accent === "coral"
          ? "#985f4b"
          : accent === "gold"
            ? "#80652b"
            : "#286451";
    const shade =
      accent === "purple"
        ? "#b6a0c9"
        : accent === "coral"
          ? "#dfa992"
          : accent === "gold"
            ? "#dfc579"
            : "#9cc7b4";
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(52, 48);
    ctx.rotate(-0.045);
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-39, -26, 78, 52, 7);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-33, -20, 66, 40, 4);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = paper;
    ctx.font = "bold 20px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 2);
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-25, 0, 3, 0, Math.PI * 2);
    ctx.arc(25, 0, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = "bold 12px Georgia";
    ctx.fillText("$", -25, 1);
    ctx.fillText("$", 25, 1);
    ctx.restore();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(13, 47);
    ctx.lineTo(5, 57);
    ctx.moveTo(91, 47);
    ctx.lineTo(99, 57);
    ctx.moveTo(40, 75);
    ctx.lineTo(35, 88);
    ctx.moveTo(64, 75);
    ctx.lineTo(69, 88);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(35, 89, 2.7, 0, Math.PI * 2);
    ctx.arc(69, 89, 2.7, 0, Math.PI * 2);
    ctx.fill();
  }, [accent]);
  return (
    <canvas ref={canvas} aria-label="A friendly dollar bill guide" role="img" />
  );
}

export default function TutorialGuide({
  topic,
  onFinish,
  onDisable,
  onRevealTarget,
}: {
  topic: TutorialTopic;
  onFinish: () => void;
  onDisable: () => void;
  onRevealTarget: (selector: string) => void;
}) {
  const slides = useMemo(
    () => (topic === "intro" ? introSlides : topicSlides[topic]),
    [topic],
  );
  const [index, setIndex] = useState(0);
  const shell = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const slide = slides[Math.min(index, slides.length - 1)];
  const placement = useTutorialPlacement(slide.target, card, onRevealTarget);
  const next = () => {
    if (index >= slides.length - 1) onFinish();
    else setIndex((value) => value + 1);
  };
  useEffect(() => setIndex(0), [topic]);
  useEffect(() => shell.current?.focus({ preventScroll: true }), [topic]);
  return (
    <div
      ref={shell}
      className={`tutorial-backdrop ${placement ? "has-spotlight" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Cashflow tutorial"
      onClick={next}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onDisable();
        }
        if (event.key === "Tab") {
          const buttons = Array.from(
            shell.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
          );
          const first = buttons[0],
            last = buttons.at(-1);
          event.preventDefault();
          if (event.shiftKey)
            (document.activeElement === first ? last : first)?.focus();
          else (document.activeElement === last ? first : last)?.focus();
        }
        if (event.key === "Enter" || event.key === " ") {
          if (event.target instanceof HTMLButtonElement) return;
          event.preventDefault();
          next();
        }
      }}
      tabIndex={0}
    >
      {placement && (
        <div
          className="tutorial-spotlight"
          style={placement.target}
          aria-hidden="true"
        />
      )}
      <div
        ref={card}
        className={`tutorial-card tutorial-${slide.accent} ${slide.target ? "tutorial-anchored" : ""}`}
        style={placement?.card}
        data-target={slide.target}
        data-placement={placement?.side}
        onClick={(event) => {
          event.stopPropagation();
          next();
        }}
      >
        <button
          className="tutorial-close"
          aria-label="Turn off tutorials"
          title="Turn off tutorials"
          onClick={(event) => {
            event.stopPropagation();
            onDisable();
          }}
        >
          <X size={16} />
        </button>
        <div className="tutorial-heading">
          <div className="tutorial-avatar">
            <DollarAvatar accent={slide.accent} />
          </div>
          <div>
            <span className="eyebrow">{slide.eyebrow}</span>
            <h2>{slide.title}</h2>
          </div>
        </div>
        <p className="tutorial-body">{slide.body}</p>
        <p className="tutorial-hint">
          <CircleDollarSign size={14} /> Click anywhere to continue
        </p>
        <div className="tutorial-footer">
          <span>
            {topic === "intro"
              ? `${index + 1} of ${slides.length}`
              : "First time here"}
          </span>
          <button
            className="button primary"
            onClick={(event) => {
              event.stopPropagation();
              next();
            }}
          >
            {index >= slides.length - 1 ? "Got it" : "Next"}{" "}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="tutorial-credit">
          <BookOpen size={13} /> Your guide pauses the game while you learn.
        </div>
      </div>
    </div>
  );
}
