import { db } from "@/lib/db";

// Default taxonomy seeded per user. Flat by default — users can nest via
// the categories page (parentId).
export const DEFAULT_CATEGORIES = [
  "Income",
  "Transfers",
  "Debt Payments",
  "Fees",
  "Groceries",
  "Dining",
  "Shopping",
  "Housing",
  "Home",
  "Health",
  "Entertainment",
  "Subscriptions",
  "Services",
  "Transport",
  "Travel",
  "Other",
] as const;

// Plaid personal_finance_category → our taxonomy.
// Detailed codes (e.g. FOOD_AND_DRINK_GROCERIES) are checked before the
// primary prefix so groceries and restaurants split correctly.
const DETAILED_MAP: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "Groceries",
};

const PRIMARY_MAP: Record<string, string> = {
  INCOME: "Income",
  TRANSFER_IN: "Transfers",
  TRANSFER_OUT: "Transfers",
  LOAN_PAYMENTS: "Debt Payments",
  BANK_FEES: "Fees",
  ENTERTAINMENT: "Entertainment",
  FOOD_AND_DRINK: "Dining",
  GENERAL_MERCHANDISE: "Shopping",
  HOME_IMPROVEMENT: "Home",
  RENT_AND_UTILITIES: "Housing",
  MEDICAL: "Health",
  PERSONAL_CARE: "Health",
  GENERAL_SERVICES: "Services",
  GOVERNMENT_AND_NON_PROFIT: "Other",
  TRANSPORTATION: "Transport",
  TRAVEL: "Travel",
  OTHER: "Other",
};

/** Map a stored plaidCategory (detailed or primary code) to a taxonomy name. */
export function mapPlaidCategory(plaidCategory: string | null): string | null {
  if (!plaidCategory) return null;
  const detailed = DETAILED_MAP[plaidCategory];
  if (detailed) return detailed;
  // Detailed codes start with their primary (FOOD_AND_DRINK_RESTAURANT).
  const primary = Object.keys(PRIMARY_MAP)
    .sort((a, b) => b.length - a.length)
    .find((p) => plaidCategory === p || plaidCategory.startsWith(p + "_"));
  return primary ? PRIMARY_MAP[primary] : null;
}

/** Idempotently seed the default taxonomy for a user. */
export async function ensureDefaultCategories(userId: string) {
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((name) => ({ userId, name })),
    skipDuplicates: true,
  });
}

export type CategoryResolver = (txn: {
  name: string;
  merchantName: string | null;
  plaidCategory: string | null;
}) => string | null;

/**
 * Build a resolver that picks a categoryId for a transaction:
 * user rules first (spec: rules win), Plaid category mapping as fallback.
 */
export async function buildCategoryResolver(
  userId: string
): Promise<CategoryResolver> {
  await ensureDefaultCategories(userId);

  const [categories, rules] = await Promise.all([
    db.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
    db.rule.findMany({
      where: { userId },
      select: { matchPattern: true, categoryId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const idByName = new Map(categories.map((c) => [c.name, c.id]));

  return (txn) => {
    const haystack = `${txn.merchantName ?? ""} ${txn.name}`.toLowerCase();
    for (const rule of rules) {
      if (haystack.includes(rule.matchPattern.toLowerCase())) {
        return rule.categoryId;
      }
    }
    const mapped = mapPlaidCategory(txn.plaidCategory);
    return mapped ? (idByName.get(mapped) ?? null) : null;
  };
}
