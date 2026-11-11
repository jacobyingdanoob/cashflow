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
export type TutorialTopic =
  | "intro"
  | "portfolio"
  | "debt"
  | "space"
  | "event"
  | "space-opportunity"
  | "space-market"
  | "space-life"
  | "space-payday"
  | "space-special"
  | "asset-1"
  | "asset-2"
  | "asset-3";
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
  /** Show the click-through guide for new and first-time game systems. */
  tutorials: boolean;
}
export interface Debt {
  /** Fixed monthly rate for new loans; absent on grandfathered annual-rate loans. */
  monthlyRateBps?: number;
  paymentBasis?: { principal: Money; payment: Money };
  id: string;
  name: string;
  principal: Money;
  payment: Money;
  kind: "home" | "school" | "car" | "credit" | "retail" | "bank" | "purchase";
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
  listing?: {
    listedRound: number;
    closesRound: number;
    /** Agreed gross proceeds, after the quick-sale discount, locked at listing. */
    gross: Money;
    discountBps: number;
  };
  boughtRound?: number;
  acquisitionFee?: Money;
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
  /** Lifetime financed Type 1 acquisitions. Selling does not reset the tier. */
  type1Purchases?: number;
  /** Legacy catalog-purchase markers retained when loading older saves. */
  bargainBuys?: Partial<Record<AssetCategory, number>>;
  stockGains?: Money;
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
  completeDiscount?: true;
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
  | {
      kind: "discount";
      card: string;
      market: string;
      responder: number;
      remaining: number[];
    }
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
  marketState?: PersistentMarkets;
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
  /** Contextual tutorial keys already completed in this match. */
  tutorialSeen: string[];
  /** Pending first-encounter lessons, in trigger order, retained across refresh. */
  tutorialQueue: TutorialTopic[];
}
export type GameAction =
  | { type: "SELL_ANYTIME"; playerId: string; assetId: string }
  | { type: "CANCEL_SALE"; playerId: string; assetId: string }
  | {
      type: "BARGAIN_BUY";
      card: string;
      shares?: number;
      outright?: boolean;
      loan?: Money;
    }
  | { type: "CLEAR_NOTIFICATIONS" }
  | { type: "ACKNOWLEDGE_GAME_OVER" }
  | { type: "REVEAL_ROLE" }
  | { type: "ACKNOWLEDGE"; id: number }
  | { type: "ROLL"; dice?: number }
  | { type: "DRAW"; tier: "small" | "large" }
  | { type: "BUY"; shares?: number; outright?: boolean; loan?: Money }
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
  | { type: "TUTORIAL"; key?: string }
  | { type: "TUTORIAL_MODE"; enabled: boolean };
export interface NpcDecisionView {
  lending?: {
    service: Money;
    income: Money;
    bankRate: number;
    purchaseRate: number;
  };
  voluntarySales?: Record<string, SaleQuote>;
  assetIncomes?: Record<string, Money>;
  canBorrow?: boolean;
  modern?: boolean;
  round?: number;
  sales?: Record<string, SaleQuote>;
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
export type AssetCategory = Asset["category"];
export interface MarketTick {
  id: number;
  round: number;
  category: AssetCategory;
  before: number;
  after: number;
  card: string;
  title: string;
  player: string;
  source?: "shock" | "drift" | "trend";
  changeBps?: number;
  trendStart?: number;
  model?: 2;
  fluctuationBps?: number;
  cycleDrawBps?: number;
  depression?: MarketDepression;
}
export interface MarketDepression {
  start: number;
  expires: number;
}
export interface MarketTrend {
  id: string;
  name: string;
  description: string;
  scenario: string;
  source: { label: string; url: string };
  tone: "positive" | "negative";
  duration: number;
  rates: Partial<Record<AssetCategory, [number, number]>>;
}
export interface MarketDynamics {
  model?: 2;
  depressions?: Partial<Record<AssetCategory, MarketDepression>>;
  version: 1;
  startedRound: number;
  lastRound: number;
  roundOpen: Record<AssetCategory, number>;
  deck: string[];
  active: { card: string; start: number; expires: number } | null;
}
export interface PersistentMarkets {
  version: 1;
  indices: Record<AssetCategory, number>;
  history: MarketTick[];
  dynamics?: MarketDynamics;
}
export interface SaleQuote {
  gross: Money;
  fee: Money;
  penalty: Money;
  taxableProfit: Money;
  tax: Money;
  mortgage: Money;
  net: Money;
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
