// Maps Plaid `personal_finance_category` values to display metadata.
// Reference: Plaid PFC taxonomy (primary + detailed).
// v1 is read-only, so this static map is the single source of category display.

export type CategoryInfo = { display: string; emoji: string; group: string };

// Ordered expense/income groups for the Sankey + list ordering.
export const GROUPS = [
  "Income",
  "Housing",
  "Bills & Utilities",
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Travel & Vacation",
  "Entertainment",
  "Health & Wellness",
  "Other",
] as const;

// detailed PFC -> display metadata
const MAP: Record<string, CategoryInfo> = {
  // ---- Income ----
  INCOME_WAGES: { display: "Paychecks", emoji: "💵", group: "Income" },
  INCOME_DIVIDENDS: { display: "Dividends", emoji: "📈", group: "Income" },
  INCOME_INTEREST_EARNED: { display: "Interest", emoji: "🏦", group: "Income" },
  INCOME_RETIREMENT_PENSION: { display: "Retirement", emoji: "👴", group: "Income" },
  INCOME_TAX_REFUND: { display: "Tax Refund", emoji: "🧾", group: "Income" },
  INCOME_UNEMPLOYMENT: { display: "Unemployment", emoji: "📋", group: "Income" },
  INCOME_OTHER_INCOME: { display: "Business", emoji: "💼", group: "Income" },

  // ---- Housing ----
  RENT_AND_UTILITIES_RENT: { display: "Rent", emoji: "🏠", group: "Housing" },
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: { display: "Mortgage", emoji: "🏡", group: "Housing" },
  HOME_IMPROVEMENT_FURNITURE: { display: "Furniture", emoji: "🛋️", group: "Housing" },
  HOME_IMPROVEMENT_HARDWARE: { display: "Hardware", emoji: "🔧", group: "Housing" },
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: { display: "Home Maintenance", emoji: "🛠️", group: "Housing" },
  HOME_IMPROVEMENT_SECURITY: { display: "Home Security", emoji: "🔒", group: "Housing" },
  HOME_IMPROVEMENT_OTHER: { display: "Home Improvement", emoji: "🏗️", group: "Housing" },

  // ---- Bills & Utilities ----
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: { display: "Gas & Electric", emoji: "⚡", group: "Bills & Utilities" },
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: { display: "Internet & Cable", emoji: "📶", group: "Bills & Utilities" },
  RENT_AND_UTILITIES_TELEPHONE: { display: "Phone", emoji: "📱", group: "Bills & Utilities" },
  RENT_AND_UTILITIES_WATER: { display: "Water", emoji: "💧", group: "Bills & Utilities" },
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: { display: "Waste", emoji: "🗑️", group: "Bills & Utilities" },
  RENT_AND_UTILITIES_OTHER_UTILITIES: { display: "Utilities", emoji: "🔌", group: "Bills & Utilities" },
  LOAN_PAYMENTS_CAR_PAYMENT: { display: "Auto Payment", emoji: "🚗", group: "Bills & Utilities" },
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: { display: "Credit Card", emoji: "💳", group: "Bills & Utilities" },
  LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: { display: "Loan Payment", emoji: "🏦", group: "Bills & Utilities" },
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: { display: "Student Loan", emoji: "🎓", group: "Bills & Utilities" },
  LOAN_PAYMENTS_OTHER_PAYMENT: { display: "Loan Payment", emoji: "🏦", group: "Bills & Utilities" },
  GENERAL_SERVICES_INSURANCE: { display: "Insurance", emoji: "🛡️", group: "Bills & Utilities" },
  GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: { display: "Financial", emoji: "📊", group: "Bills & Utilities" },

  // ---- Food & Dining ----
  FOOD_AND_DRINK_GROCERIES: { display: "Groceries", emoji: "🍎", group: "Food & Dining" },
  FOOD_AND_DRINK_RESTAURANT: { display: "Restaurants", emoji: "🍽️", group: "Food & Dining" },
  FOOD_AND_DRINK_FAST_FOOD: { display: "Fast Food", emoji: "🍔", group: "Food & Dining" },
  FOOD_AND_DRINK_COFFEE: { display: "Coffee", emoji: "☕", group: "Food & Dining" },
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: { display: "Alcohol", emoji: "🍷", group: "Food & Dining" },
  FOOD_AND_DRINK_VENDING_MACHINES: { display: "Vending", emoji: "🥤", group: "Food & Dining" },
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: { display: "Dining Out", emoji: "🍴", group: "Food & Dining" },

  // ---- Transportation ----
  TRANSPORTATION_GAS: { display: "Gas", emoji: "⛽", group: "Transportation" },
  TRANSPORTATION_PARKING: { display: "Parking", emoji: "🅿️", group: "Transportation" },
  TRANSPORTATION_PUBLIC_TRANSIT: { display: "Public Transit", emoji: "🚆", group: "Transportation" },
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: { display: "Taxi & Ride Shares", emoji: "🚕", group: "Transportation" },
  TRANSPORTATION_TOLLS: { display: "Tolls", emoji: "🛣️", group: "Transportation" },
  TRANSPORTATION_BIKES_AND_SCOOTERS: { display: "Bikes & Scooters", emoji: "🛴", group: "Transportation" },
  TRANSPORTATION_OTHER_TRANSPORTATION: { display: "Transportation", emoji: "🚙", group: "Transportation" },
  GENERAL_SERVICES_AUTOMOTIVE: { display: "Auto Maintenance", emoji: "🔧", group: "Transportation" },

  // ---- Shopping ----
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: { display: "Clothing", emoji: "👕", group: "Shopping" },
  GENERAL_MERCHANDISE_ELECTRONICS: { display: "Electronics", emoji: "💻", group: "Shopping" },
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: { display: "Shopping", emoji: "🛍️", group: "Shopping" },
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: { display: "Department Stores", emoji: "🏬", group: "Shopping" },
  GENERAL_MERCHANDISE_SUPERSTORES: { display: "Superstores", emoji: "🛒", group: "Shopping" },
  GENERAL_MERCHANDISE_SPORTING_GOODS: { display: "Sporting Goods", emoji: "🏀", group: "Shopping" },
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: { display: "Books", emoji: "📚", group: "Shopping" },
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: { display: "Gifts", emoji: "🎁", group: "Shopping" },
  GENERAL_MERCHANDISE_PET_SUPPLIES: { display: "Pets", emoji: "🐾", group: "Shopping" },
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: { display: "Convenience", emoji: "🏪", group: "Shopping" },
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPE: { display: "Tobacco", emoji: "🚬", group: "Shopping" },
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: { display: "Shopping", emoji: "🛍️", group: "Shopping" },

  // ---- Travel & Vacation ----
  TRAVEL_FLIGHTS: { display: "Flights", emoji: "✈️", group: "Travel & Vacation" },
  TRAVEL_LODGING: { display: "Lodging", emoji: "🏨", group: "Travel & Vacation" },
  TRAVEL_RENTAL_CARS: { display: "Rental Cars", emoji: "🚘", group: "Travel & Vacation" },
  TRAVEL_OTHER_TRAVEL: { display: "Travel", emoji: "🧳", group: "Travel & Vacation" },

  // ---- Entertainment ----
  ENTERTAINMENT_MUSIC_AND_AUDIO: { display: "Music & Audio", emoji: "🎵", group: "Entertainment" },
  ENTERTAINMENT_TV_AND_MOVIES: { display: "TV & Movies", emoji: "🎬", group: "Entertainment" },
  ENTERTAINMENT_VIDEO_GAMES: { display: "Video Games", emoji: "🎮", group: "Entertainment" },
  ENTERTAINMENT_CASINOS_AND_GAMBLING: { display: "Gambling", emoji: "🎰", group: "Entertainment" },
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: { display: "Events", emoji: "🎟️", group: "Entertainment" },
  ENTERTAINMENT_OTHER_ENTERTAINMENT: { display: "Entertainment", emoji: "🎭", group: "Entertainment" },

  // ---- Health & Wellness ----
  MEDICAL_PRIMARY_CARE: { display: "Medical", emoji: "🩺", group: "Health & Wellness" },
  MEDICAL_DENTAL_CARE: { display: "Dental", emoji: "🦷", group: "Health & Wellness" },
  MEDICAL_EYE_CARE: { display: "Eye Care", emoji: "👓", group: "Health & Wellness" },
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: { display: "Pharmacy", emoji: "💊", group: "Health & Wellness" },
  MEDICAL_VETERINARY_SERVICES: { display: "Veterinary", emoji: "🐶", group: "Health & Wellness" },
  MEDICAL_OTHER_MEDICAL: { display: "Medical", emoji: "🏥", group: "Health & Wellness" },
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: { display: "Fitness", emoji: "🏋️", group: "Health & Wellness" },
  PERSONAL_CARE_HAIR_AND_BEAUTY: { display: "Hair & Beauty", emoji: "💇", group: "Health & Wellness" },
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: { display: "Laundry", emoji: "🧺", group: "Health & Wellness" },
  PERSONAL_CARE_OTHER_PERSONAL_CARE: { display: "Personal Care", emoji: "🧴", group: "Health & Wellness" },
};

// Fallback display when a primary group has no specific mapping.
const PRIMARY_GROUP: Record<string, string> = {
  INCOME: "Income",
  TRANSFER_IN: "Income",
  RENT_AND_UTILITIES: "Bills & Utilities",
  LOAN_PAYMENTS: "Bills & Utilities",
  HOME_IMPROVEMENT: "Housing",
  FOOD_AND_DRINK: "Food & Dining",
  TRANSPORTATION: "Transportation",
  GENERAL_MERCHANDISE: "Shopping",
  TRAVEL: "Travel & Vacation",
  ENTERTAINMENT: "Entertainment",
  MEDICAL: "Health & Wellness",
  PERSONAL_CARE: "Health & Wellness",
  GENERAL_SERVICES: "Bills & Utilities",
};

function titleCase(pfPrimary: string): string {
  return pfPrimary
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Resolve a Plaid detailed category to display metadata, with graceful fallback. */
export function categoryInfo(pfDetailed: string): CategoryInfo {
  const hit = MAP[pfDetailed];
  if (hit) return hit;

  const primary = pfDetailed.split("_").slice(0, guessPrimaryLength(pfDetailed)).join("_");
  const group =
    PRIMARY_GROUP[primary] ??
    Object.entries(PRIMARY_GROUP).find(([p]) => pfDetailed.startsWith(p))?.[1] ??
    "Other";
  return { display: titleCase(primary), emoji: "💸", group };
}

// Plaid primaries are 1-3 tokens; find the longest known primary prefix.
function guessPrimaryLength(pfDetailed: string): number {
  for (const p of Object.keys(PRIMARY_GROUP)) {
    if (pfDetailed === p || pfDetailed.startsWith(p + "_")) {
      return p.split("_").length;
    }
  }
  return 1;
}

/** True when a transaction's primary category represents earned income. */
export function isIncomeCategory(pfPrimary: string): boolean {
  return pfPrimary.startsWith("INCOME");
}

/**
 * Transfers between the user's own accounts (and credit-card payments) are
 * neither income nor spending — they're excluded from all reports, the way
 * Monarch nets out internal movement.
 */
export function isTransfer(pfPrimary: string): boolean {
  return pfPrimary.startsWith("TRANSFER");
}

/** The one detailed transfer category that represents money leaving for an
 * investment/retirement account, distinct from all other transfers. */
export const INVESTMENT_TRANSFER_DETAILED =
  "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS";

/** True only for the exact detailed category that funds investment accounts. */
export function isInvestmentTransferCategory(pfDetailed: string): boolean {
  return pfDetailed === INVESTMENT_TRANSFER_DETAILED;
}
