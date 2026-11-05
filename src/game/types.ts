export type Money = number;
export type Stage = "rat" | "fast";
export type Profile = "cautious" | "income" | "bold" | "diverse";
export type RoleDifficulty = "easy" | "standard" | "hard";
export type SpaceKind =
  | "payday"
  | "opportunity"
  | "market"
  | "expense"
  | "charity"
  | "baby"
  | "downsized"
  | "business"
  | "dream"
  | "audit"
  | "divorce"
  | "lawsuit";
export interface GameConfig {
  opponents: number;
  profession: string;
  roleDifficulty: RoleDifficulty;
  adaptedCards: boolean;
  startingCash: number;
  livingExpenses: number;
  annualRate: number;
  victory: "freedom" | "full";
  incomeGoal: Money;
  dreamMultiplier: number;
  roundLimit: number;
  difficulty: "easy" | "standard" | "hard";
  accounting: "auto" | "manual";
  speed: "instant" | "fast" | "normal";
  seed: number;
  dream: string;
  liquidityRisk: boolean;
  principalRate: number;
  economicCycles: boolean;
}
export interface Debt {
  paymentBasis?: { principal: Money; payment: Money };
  id: string;
  name: string;
  principal: Money;
  payment: Money;
  kind: "home" | "school" | "car" | "credit" | "retail" | "bank";
}
export interface Profession {
  difficulty: RoleDifficulty;
  accent: string;
  motif: "grid" | "rings" | "rays";
  icon: string;
  traits: string[];
  pursue: string;
  avoid: string;
  debtStory: string;
  id: string;
  name: string;
  salary: Money;
  savings: Money;
  taxes: Money;
  living: Money;
  childCost: Money;
  debts: Debt[];
  description: string;
}
export interface Asset {
  referenceValue?: Money;
  financingBasis?: { principal: Money; payment: Money };
  id: string;
  cardId: string;
  name: string;
  category: "property" | "business" | "stock";
  cost: Money;
  down: Money;
  mortgage: Money;
  income: Money;
  financing: Money;
  shares: number;
  unitPrice: Money;
  distress: Money;
}
export interface Player {
  elimination?: { round: number; reason: string; financials: Financials };
  id: string;
  name: string;
  human: boolean;
  profile: Profile;
  profession: string;
  salary: Money;
  taxes: Money;
  living: Money;
  childCost: Money;
  children: number;
  cash: Money;
  debts: Debt[];
  assets: Asset[];
  position: number;
  stage: Stage;
  entryIncome: Money;
  dream: string;
  dreamOwned: boolean;
  skip: number;
  charity: number;
  eliminated: boolean;
  debtRelief: boolean;
  bankrupt: boolean;
  color: string;
  decisionCount: number;
}
export interface Deal {
  source?: CardSource;
  referenceCost?: Money;
  id: string;
  name: string;
  description: string;
  category: Asset["category"];
  cost: Money;
  down: Money;
  mortgage: Money;
  income: Money;
  financing: Money;
  unitPrice: Money;
  transferable: boolean;
  tier: "small" | "large" | "fast";
  distress: Money;
}
export interface MarketCard {
  source?: CardSource;
  sharePrice?: Money;
  id: string;
  name: string;
  description: string;
  category: Asset["category"];
  multiplier: number;
  effect: "offer" | "split" | "dividend";
  amount: Money;
}
export interface ExpenseCard {
  source?: CardSource;
  id: string;
  name: string;
  description: string;
  cost: Money;
}
export interface CardSource {
  label: string;
  url: string;
  adaptation: string;
}
export interface Dream {
  id: string;
  name: string;
  description: string;
  cost: Money;
  icon: string;
}
export interface Space {
  kind: SpaceKind;
  label: string;
  content?: string;
}
export interface Financials {
  cash: Money;
  salary: Money;
  passive: Money;
  income: Money;
  expenses: Money;
  flow: Money;
  debt: Money;
  assets: Money;
  netWorth: Money;
}
export interface Receipt {
  id: number;
  player: string;
  title: string;
  before: Financials;
  after: Financials;
  note: string;
}
export type AccountingField =
  "cash" | "assets" | "debt" | "income" | "expenses" | "passive" | "flow";
export interface AccountingSubmission {
  [field: string]: string;
}
export interface PendingAccounting {
  next: Player;
  receipt: Receipt;
  fields: AccountingField[];
  errors: string[];
  values: AccountingSubmission;
}
export type Decision =
  | {
      kind: "opportunity";
      tier?: "small" | "large";
      card?: string;
      owner: number;
      transferred: boolean;
    }
  | { kind: "market"; card: string; responder: number; remaining: number[] }
  | { kind: "charity" }
  | { kind: "dream"; id: string }
  | { kind: "insolvency"; amount: Money; title: string; principal?: boolean }
  | { kind: "liquidity"; resume: "roll" | "end" };
export interface GameEvent {
  id: number;
  round: number;
  player: string;
  text: string;
  tone: "neutral" | "positive" | "negative";
}
export interface GameState {
  personalReviewSeen: boolean;
  smallDeckStage: "early" | "normal";
  roleRevealed: boolean;
  economy: EconomyState;
  history: FinancialHistoryPoint[];
  historyStartRound: number;
  notices: ActivityNotice[];
  turnContext: TurnContext | null;
  version: 1;
  contentVersion: 1;
  config: GameConfig;
  rng: number;
  players: Player[];
  current: number;
  round: number;
  phase: "roll" | "decision" | "end" | "finished";
  dice: number[];
  decision: Decision | null;
  pending: PendingAccounting | null;
  effects: ({ kind: "payday"; times: number } | { kind: "landing" })[];
  decks: {
    small: string[];
    large: string[];
    market: string[];
    expense: string[];
  };
  claimed: string[];
  dreamVisits: Record<string, string[]>;
  log: GameEvent[];
  receipts: Receipt[];
  sequence: number;
  winners: string[];
  finishReason: string;
  tutorialDone: boolean;
}
export type GameAction =
  | { type: "CLEAR_NOTIFICATIONS" }
  | { type: "ACKNOWLEDGE_GAME_OVER" }
  | { type: "REVEAL_ROLE" }
  | { type: "ACKNOWLEDGE"; id: number }
  | { type: "ROLL"; dice?: number }
  | { type: "DRAW"; tier: "small" | "large" }
  | { type: "BUY"; shares?: number }
  | { type: "PASS" }
  | { type: "SELL"; assetId: string }
  | { type: "TRANSFER"; target: number; price: Money }
  | { type: "CHARITY"; accept: boolean }
  | { type: "BORROW"; amount: Money }
  | { type: "REPAY"; debtId: string; amount?: Money }
  | { type: "LIQUIDATE"; assetId: string }
  | { type: "BANKRUPT" }
  | { type: "END" }
  | { type: "SUBMIT"; values: AccountingSubmission }
  | { type: "DRAFT"; field: AccountingField; value: string }
  | { type: "MODE"; accounting: "auto" | "manual" }
  | { type: "SPEED"; speed: GameConfig["speed"] }
  | { type: "TUTORIAL" };
export interface NpcDecisionView {
  player: Player;
  financials: Financials;
  phase: GameState["phase"];
  decision: Decision | null;
  deal?: Deal;
  market?: MarketCard;
  dreamPrice?: Money;
  eligibleAssets: Asset[];
  opponents: { id: string; cash: Money; human: boolean }[];
  config: Pick<
    GameConfig,
    | "annualRate"
    | "difficulty"
    | "incomeGoal"
    | "liquidityRisk"
    | "principalRate"
  >;
  liquidityReserve: Money;
  principalDue: Money;
  distressValues: Record<string, Money>;
}
export interface FinancialHistoryPoint {
  id: number;
  round: number;
  player: string;
  kind: "start" | "transaction" | "decision" | "finish";
  title: string;
  note: string;
  values: Financials;
  delta: Partial<Financials>;
  opportunity?: { down: Money; income: Money; affordable: boolean };
}
export interface FinancialChange {
  player: string;
  before: Financials;
  after: Financials;
}
export interface ActivityNotice {
  id: number;
  kind: "npc-turn" | "event" | "cycle" | "risk";
  eventId?: string;
  tone?: "positive" | "negative" | "neutral";
  player: string;
  round: number;
  title: string;
  description: string;
  events: string[];
  reasons: string[];
  changes: FinancialChange[];
  dice: number[];
}
export interface TurnContext {
  player: string;
  round: number;
  before: { player: string; values: Financials }[];
  events: string[];
  reasons: string[];
  dice: number[];
}
export interface EconomicEvent {
  id: string;
  name: string;
  tone: "positive" | "negative";
  description: string;
  scenario: string;
  source: { label: string; url: string };
  affected: string;
  duration: number;
  values?: Partial<Record<Asset["category"], number>>;
  income?: Partial<Record<Asset["category"], number>>;
  loanPayments?: number;
}
export interface EconomyState {
  version: 1;
  active: { card: string; start: number; expires: number }[];
  deck: string[];
  lastRound: number;
  principalPaid: Record<string, number>;
  warned: Record<string, number>;
}
