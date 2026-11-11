import type { CSSProperties } from "react";
import {
  ArrowRight,
  Palette,
  HeartPulse,
  Code2,
  Stethoscope,
  Zap,
  BookOpen,
  Calculator,
  ChartNoAxesCombined,
  Wrench,
  ChefHat,
  Building2,
  Bike,
  Music2,
  Scale,
  BriefcaseBusiness,
  Check,
  Shield,
} from "lucide-react";
import { professions } from "../game/content";
import { money, playerFinancials } from "../game/engine";
import type { GameState } from "../game/types";
import Modal from "./Modal";

const icons = {
  palette: Palette,
  heart: HeartPulse,
  code: Code2,
  medical: Stethoscope,
  bolt: Zap,
  book: BookOpen,
  calculator: Calculator,
  chart: ChartNoAxesCombined,
  wrench: Wrench,
  chef: ChefHat,
  building: Building2,
  bike: Bike,
  music: Music2,
  scales: Scale,
  briefcase: BriefcaseBusiness,
};
export default function RoleReveal({
  game,
  onContinue,
}: {
  game: GameState;
  onContinue: () => void;
}) {
  const player = game.players[0];
  const role = professions.find((p) => p.id === player.profession)!;
  const f = playerFinancials(game, player);
  const Icon = icons[role.icon as keyof typeof icons];
  return (
    <Modal
      title="Meet your new life"
      eyebrow="YOUR STARTING ROLE"
      onClose={onContinue}
      dismissOnBackdrop={false}
      className="role-modal"
    >
      <div
        className={`role-reveal motif-${role.motif}`}
        style={{ "--role-accent": role.accent } as CSSProperties}
      >
        <div className="role-hero">
          <span className="role-difficulty">
            {role.difficulty === "standard"
              ? "Standard"
              : role.difficulty === "easy"
                ? "Easy"
                : "Hard"}{" "}
            start ·{" "}
            {role.id === "musician" || role.id === "courier"
              ? "Make every dollar count"
              : "A new chapter"}
          </span>
          <div className="role-emblem">
            <Icon size={54} strokeWidth={1.4} />
          </div>
          <h3>{role.name}</h3>
          <p>{role.description}</p>
        </div>
        <div className="role-traits">
          {role.traits.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <dl className="role-stats">
          {[
            ["Monthly salary", f.salary],
            ["Monthly expenses", f.expenses],
            ["Monthly cash flow", f.flow],
            ["Starting cash", f.cash],
            ["Total debt", f.debt],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{money(Number(value))}</dd>
            </div>
          ))}
        </dl>
        {game.players.every((p) => p.profession === player.profession) && (
          <p className="small muted">
            Every player starts with this role and identical cash, debt, income
            and expenses. Opponents bring different strategies to the same
            starting finances.
          </p>
        )}
        <div className="role-debt-story">
          <strong>What your debt does</strong>
          <p>{role.debtStory}</p>
          <small>
            Career debt can support earning power; it still costs cash. Only
            purchased investments produce passive income in this game.
          </small>
        </div>
        <div className="role-advice">
          <div>
            <Check size={19} />
            <strong>Try for</strong>
            <p>{role.pursue}</p>
          </div>
          <div>
            <Shield size={19} />
            <strong>Watch out for</strong>
            <p>{role.avoid}</p>
          </div>
        </div>
        <button className="button primary full" onClick={onContinue}>
          Start my story <ArrowRight size={17} />
        </button>
      </div>
    </Modal>
  );
}
