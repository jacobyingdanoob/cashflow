import {
  ArrowRight,
  BookOpen,
  ChartNoAxesCombined,
  Coins,
  Landmark,
  ShieldCheck,
  Users,
} from "lucide-react";
import Modal from "./Modal";

const features = [
  {
    icon: ChartNoAxesCombined,
    title: "Markets that keep moving",
    text: "Stocks, property and businesses change price each round. Shared shocks, economic trends and deep downturns give everyone the same changing market.",
  },
  {
    icon: Coins,
    title: "More ways to buy and sell",
    text: "Sell shares anytime or list property and businesses for a later closing. See acquisition fees, sale costs and profit tax before you commit.",
  },
  {
    icon: Landmark,
    title: "Borrowing with clear limits",
    text: "New-game bank loans cost 2% monthly; Type 1 purchase loans cost 1%. Down payments rise with financed purchases, and new debt must fit a 55% income limit.",
  },
  {
    icon: Users,
    title: "A fair table with different minds",
    text: "Play against one to eight NPCs. Everyone starts with the same role and finances, while different investing personalities choose how to use them.",
  },
  {
    icon: BookOpen,
    title: "Learn at your own pace",
    text: "Optional tutorials, a searchable wiki, a rulebook and guided manual accounting explain the choices. You can also let the game handle the books.",
  },
  {
    icon: ShieldCheck,
    title: "Keep your story and learn from it",
    text: "Autosaves, three save slots and a complete transaction history help you pick up where you left off. Charts and local coaching review your decisions when your game ends.",
  },
];

export default function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <Modal
      title="Welcome to Cashflow"
      eyebrow="A LITTLE STRATEGY. A DIFFERENT LIFE."
      onClose={onContinue}
      dismissOnBackdrop={false}
      className="welcome-modal"
      wide
    >
      <div
        className="welcome-content"
        tabIndex={0}
        role="region"
        aria-label="About Cashflow and this edition"
      >
        <div className="welcome-goal">
          <span className="eyebrow">THE IDEA BEHIND THE GAME</span>
          <h3>Turn a paycheck into possibilities.</h3>
          <p>
            Cashflow is a financial board game about earning a salary, covering
            life's bills and buying assets that bring in income. You decide what
            to buy, when to borrow and how much cash to keep for surprises.
          </p>
          <p>
            <strong>Your first goal:</strong> build passive income greater than
            your monthly expenses to escape the Rat Race. In a full game,
            continue on the Fast Track to buy your dream or reach your
            extra-income target.
          </p>
        </div>
        <h3 className="welcome-section-title">
          What makes this edition different?
        </h3>
        <p className="welcome-context">
          Inspired by the original CASHFLOW board game, this personal playtest
          adds its own rules and digital tools:
        </p>
        <div className="welcome-features">
          {features.map(({ icon: Icon, title, text }) => (
            <section key={title}>
              <Icon size={22} aria-hidden="true" />
              <div>
                <h4>{title}</h4>
                <p>{text}</p>
              </div>
            </section>
          ))}
        </div>
        <p className="welcome-note">
          The numbers are simplified game economics. Older saves keep their
          earlier rules; start a new match to explore every addition. Reopen
          this introduction anytime from How to play.
        </p>
      </div>
      <div className="welcome-actions">
        <span>Your game waits while you read.</span>
        <button className="button primary" onClick={onContinue}>
          Get started <ArrowRight size={18} />
        </button>
      </div>
    </Modal>
  );
}
