import type { Debt, Profession } from "./types";
const dollars = (n: number) => Math.round(n * 100);
const debt = (
  id: Debt["kind"],
  name: string,
  principal: number,
  payment: number,
): Debt => ({
  id,
  kind: id,
  name,
  principal: dollars(principal),
  payment: dollars(payment),
});
const legacyRoles = [
  {
    id: "designer",
    name: "Product designer",
    salary: dollars(6400),
    savings: dollars(5200),
    taxes: dollars(1200),
    living: dollars(1450),
    childCost: dollars(350),
    debts: [
      debt("home", "Home mortgage", 97000, 620),
      debt("school", "Student loan", 18000, 180),
      debt("car", "Car loan", 12000, 240),
      debt("credit", "Credit card", 3000, 90),
    ],
    description: "A creative mind. A fresh financial canvas.",
  },
  {
    id: "nurse",
    name: "Registered nurse",
    salary: dollars(5900),
    savings: dollars(6000),
    taxes: dollars(1050),
    living: dollars(1300),
    childCost: dollars(320),
    debts: [
      debt("home", "Home mortgage", 97000, 625),
      debt("school", "Student loan", 24000, 220),
      debt("car", "Car loan", 9000, 190),
    ],
    description: "Taking care of others. Building a future for yourself.",
  },
  {
    id: "engineer",
    name: "Software engineer",
    salary: dollars(9200),
    savings: dollars(8500),
    taxes: dollars(2200),
    living: dollars(1850),
    childCost: dollars(450),
    debts: [
      debt("home", "Home mortgage", 101000, 630),
      debt("school", "Student loan", 15000, 136),
      debt("car", "Car loan", 10000, 180),
      debt("credit", "Credit card", 4000, 120),
    ],
    description: "A bigger paycheck comes with bigger commitments.",
  },
  {
    id: "teacher",
    name: "School teacher",
    salary: dollars(4300),
    savings: dollars(4000),
    taxes: dollars(650),
    living: dollars(1100),
    childCost: dollars(260),
    debts: [
      debt("home", "Home mortgage", 110000, 740),
      debt("school", "Student loan", 12000, 120),
      debt("car", "Car loan", 6000, 150),
    ],
    description: "Patience and planning can go a long way.",
  },
  {
    id: "electrician",
    name: "Electrician",
    salary: dollars(5400),
    savings: dollars(7000),
    taxes: dollars(900),
    living: dollars(1250),
    childCost: dollars(300),
    debts: [
      debt("home", "Home mortgage", 112000, 730),
      debt("car", "Work van loan", 14000, 280),
      debt("retail", "Equipment debt", 4000, 110),
    ],
    description: "Practical skills. Plenty of untapped potential.",
  },
  {
    id: "doctor",
    name: "Family physician",
    salary: dollars(12000),
    savings: dollars(6500),
    taxes: dollars(2950),
    living: dollars(2200),
    childCost: dollars(520),
    debts: [
      debt("home", "Home mortgage", 90000, 563),
      debt("school", "Medical school loan", 25000, 158),
      debt("car", "Car loan", 12000, 218),
      debt("credit", "Credit card", 3000, 90),
    ],
    description: "A strong income. Choose how to put it to work.",
  },
];

// Versioned, original role sheets. Career debt supports earnings, not passive income.
export const ROLE_CONTENT_VERSION = 1;
const additionalRoles = [
  {
    id: "accountant",
    name: "Tax accountant",
    salary: dollars(7500),
    savings: dollars(14000),
    taxes: dollars(1500),
    living: dollars(1150),
    childCost: dollars(300),
    debts: [debt("school", "Accounting qualification", 18000, 140)],
    description: "Low consumer debt. Lean household.",
  },
  {
    id: "analyst",
    name: "Data analyst",
    salary: dollars(8500),
    savings: dollars(12000),
    taxes: dollars(1850),
    living: dollars(1300),
    childCost: dollars(350),
    debts: [
      debt("school", "Graduate training", 32000, 260),
      debt("car", "Car loan", 8000, 160),
    ],
    description: "High salary. Low fixed payments.",
  },
  {
    id: "technician",
    name: "Solar technician",
    salary: dollars(6200),
    savings: dollars(11000),
    taxes: dollars(1050),
    living: dollars(1100),
    childCost: dollars(280),
    debts: [debt("retail", "Work equipment", 9000, 180)],
    description: "Solid salary. Very low debt.",
  },
  {
    id: "chef",
    name: "Head chef",
    salary: dollars(5600),
    savings: dollars(5000),
    taxes: dollars(950),
    living: dollars(1450),
    childCost: dollars(320),
    debts: [
      debt("home", "Home mortgage", 78000, 520),
      debt("retail", "Kitchen equipment", 22000, 330),
      debt("car", "Car loan", 12000, 240),
      debt("credit", "Credit card", 5000, 150),
    ],
    description: "Middle income. Equipment financing.",
  },
  {
    id: "planner",
    name: "Urban planner",
    salary: dollars(6100),
    savings: dollars(6500),
    taxes: dollars(1150),
    living: dollars(1550),
    childCost: dollars(340),
    debts: [
      debt("home", "Home mortgage", 125000, 820),
      debt("school", "Planning qualification", 28000, 250),
      debt("car", "Car loan", 10000, 200),
    ],
    description: "Steady professional income. Education and housing debt.",
  },
  {
    id: "courier",
    name: "Delivery courier",
    salary: dollars(3300),
    savings: dollars(2200),
    taxes: dollars(300),
    living: dollars(1350),
    childCost: dollars(220),
    debts: [
      debt("car", "Delivery vehicle", 28000, 680),
      debt("credit", "Credit card", 12000, 360),
    ],
    description: "Low income. Costly transport debt.",
  },
  {
    id: "musician",
    name: "Session musician",
    salary: dollars(4200),
    savings: dollars(3200),
    taxes: dollars(500),
    living: dollars(1500),
    childCost: dollars(260),
    debts: [
      debt("home", "Home mortgage", 105000, 700),
      debt("school", "Music school loan", 45000, 350),
      debt("retail", "Instruments and studio gear", 18000, 300),
      debt("car", "Car loan", 22000, 350),
      debt("credit", "Credit card", 14000, 420),
    ],
    description: "Very thin surplus. Training and equipment debt.",
  },
  {
    id: "lawyer",
    name: "Junior attorney",
    salary: dollars(10500),
    savings: dollars(4000),
    taxes: dollars(2600),
    living: dollars(3000),
    childCost: dollars(500),
    debts: [
      debt("home", "Home mortgage", 230000, 1450),
      debt("school", "Law school loan", 170000, 1150),
      debt("car", "Car loan", 38000, 660),
      debt("credit", "Credit card", 12000, 360),
    ],
    description: "High income. Very high education debt.",
  },
  {
    id: "manager",
    name: "Retail manager",
    salary: dollars(8200),
    savings: dollars(3500),
    taxes: dollars(1800),
    living: dollars(2600),
    childCost: dollars(400),
    debts: [
      debt("home", "Home mortgage", 180000, 1180),
      debt("car", "Luxury car loan", 50000, 900),
      debt("credit", "Credit card", 20000, 600),
      debt("retail", "Furniture financing", 8000, 200),
    ],
    description: "Good salary. High lifestyle costs.",
  },
];
const strategies: Record<
  string,
  Pick<
    Profession,
    | "difficulty"
    | "accent"
    | "motif"
    | "icon"
    | "traits"
    | "pursue"
    | "avoid"
    | "debtStory"
  >
> = {
  designer: {
    difficulty: "standard",
    accent: "#79519a",
    motif: "grid",
    icon: "palette",
    traits: ["Balanced salary", "Mixed household debt", "Room for small deals"],
    pursue:
      "Build a small, diversified income base before taking on a large mortgage.",
    avoid: "Letting lifestyle purchases eat your investment budget.",
    debtStory:
      "Education debt supports your career; the home is personal housing, while car and card debt generate no passive income.",
  },
  nurse: {
    difficulty: "standard",
    accent: "#226d72",
    motif: "rings",
    icon: "heart",
    traits: ["Steady salary", "Education investment", "Moderate living costs"],
    pursue:
      "Keep a reserve and compare loan-payment savings with investment income.",
    avoid: "Spending the emergency fund on a deal with a thin return.",
    debtStory:
      "Student debt helped fund your qualification. Your home and car still need monthly cash; neither pays you rent.",
  },
  engineer: {
    difficulty: "easy",
    accent: "#345aa0",
    motif: "grid",
    icon: "code",
    traits: [
      "High income",
      "Strong monthly surplus",
      "Manageable debt service",
    ],
    pursue:
      "Turn the large surplus into recurring income while keeping cash for shocks.",
    avoid: "Mistaking a high salary for financial independence.",
    debtStory:
      "Training supports earning power; home, car and card payments still rely on that salary.",
  },
  doctor: {
    difficulty: "easy",
    accent: "#9a465d",
    motif: "rings",
    icon: "medical",
    traits: [
      "Very high income",
      "High household costs",
      "Strong repayment capacity",
    ],
    pursue:
      "Use the surplus to buy income and retire costly consumer balances.",
    avoid: "Expanding your lifestyle every time more income arrives.",
    debtStory:
      "Medical education supports your high salary. Housing and consumer debt are commitments, not passive-income assets.",
  },
  electrician: {
    difficulty: "standard",
    accent: "#8b5a1f",
    motif: "rays",
    icon: "bolt",
    traits: [
      "Practical earning power",
      "Work-tool financing",
      "Moderate surplus",
    ],
    pursue:
      "Compare van and equipment payment savings with affordable investments.",
    avoid: "Borrowing for a large deal before protecting the work budget.",
    debtStory:
      "The work van and equipment enable your income; the home mortgage pays for personal housing.",
  },
  teacher: {
    difficulty: "hard",
    accent: "#9c4c34",
    motif: "grid",
    icon: "book",
    traits: ["Modest income", "Housing-heavy debt", "Limited deal budget"],
    pursue:
      "Start with small positive-income deals and protect several bills worth of cash.",
    avoid:
      "Taking on a big mortgage because the down payment looks affordable.",
    debtStory:
      "Education supports your career, but most debt is tied to personal housing and transport rather than cash-producing assets.",
  },
  accountant: {
    difficulty: "easy",
    accent: "#35654b",
    motif: "grid",
    icon: "calculator",
    traits: ["Low consumer debt", "Lean household", "Large savings cushion"],
    pursue: "Use your low fixed costs to build passive income early.",
    avoid: "Holding every dollar in cash after your reserve is secure.",
    debtStory:
      "A small qualification loan supports your career; there is no card or car debt. Rent is included in living expenses.",
  },
  analyst: {
    difficulty: "easy",
    accent: "#65549a",
    motif: "rays",
    icon: "chart",
    traits: ["High salary", "Low fixed payments", "Strong savings"],
    pursue:
      "Diversify into income assets instead of depending on one big winner.",
    avoid: "Treating stock appreciation as guaranteed monthly income.",
    debtStory:
      "A qualification loan supports your earnings and a small car loan covers transport. Neither is an income asset.",
  },
  technician: {
    difficulty: "easy",
    accent: "#2e717a",
    motif: "rings",
    icon: "wrench",
    traits: ["Solid salary", "Very low debt", "Low living costs"],
    pursue: "Put the monthly surplus to work and keep tools funded.",
    avoid:
      "Overlooking investment opportunities because debt-free feels safer.",
    debtStory:
      "A modest equipment balance supports your work. You rent your home and carry no consumer-card balance.",
  },
  chef: {
    difficulty: "standard",
    accent: "#a24a37",
    motif: "rays",
    icon: "chef",
    traits: ["Middle income", "Equipment financing", "Some card debt"],
    pursue:
      "Clear expensive card payments while building reliable investment income.",
    avoid: "Stacking new business loans on top of equipment and card payments.",
    debtStory:
      "Equipment enables your kitchen work. Car and credit-card balances do not generate passive income.",
  },
  planner: {
    difficulty: "standard",
    accent: "#466c8d",
    motif: "grid",
    icon: "building",
    traits: [
      "Steady professional income",
      "Education and housing debt",
      "Balanced spending",
    ],
    pursue: "Build a reserve, then compare small rental and business returns.",
    avoid:
      "Concentrating every investment in property because it feels familiar.",
    debtStory:
      "Your qualification supports earning power; your personal mortgage is housing debt, not a rental asset.",
  },
  courier: {
    difficulty: "hard",
    accent: "#a24831",
    motif: "rays",
    icon: "bike",
    traits: ["Low income", "Costly transport debt", "Thin monthly cushion"],
    pursue:
      "Pay down high-payment balances in small steps and favor low-cost income.",
    avoid: "Using new loans to chase opportunities while cash is tight.",
    debtStory:
      "The vehicle enables deliveries, but its payment is heavy. Card debt funds no income asset; living costs include rent.",
  },
  musician: {
    difficulty: "hard",
    accent: "#784698",
    motif: "rings",
    icon: "music",
    traits: [
      "Very thin surplus",
      "Training and equipment debt",
      "Heavy consumer payments",
    ],
    pursue:
      "Preserve cash first, then reduce the payments that consume most of your salary.",
    avoid:
      "Buying negative-cash-flow assets while the household budget is fragile.",
    debtStory:
      "Training and instruments support your career. Home, car and card debt absorb most remaining cash.",
  },
  lawyer: {
    difficulty: "hard",
    accent: "#435683",
    motif: "grid",
    icon: "scales",
    traits: ["High income", "Very high education debt", "Heavy housing costs"],
    pursue:
      "Use your salary to reduce debt service and build a resilient reserve.",
    avoid: "Assuming a large paycheck makes aggressive leverage safe.",
    debtStory:
      "Law school supports earning power, but a large personal mortgage and consumer debt create substantial fixed bills.",
  },
  manager: {
    difficulty: "hard",
    accent: "#8e5844",
    motif: "rays",
    icon: "briefcase",
    traits: ["Good salary", "High lifestyle costs", "Expensive consumer debt"],
    pursue:
      "Target card, retail and vehicle payments while keeping an emergency fund.",
    avoid:
      "Adding more consumer spending or stretching for a large down payment.",
    debtStory:
      "Most debt funds personal housing, a costly car and past purchases. None of it pays recurring investment income.",
  },
};
export const professions: Profession[] = [
  ...legacyRoles,
  ...additionalRoles,
].map((role) => ({ ...role, ...strategies[role.id] }));
