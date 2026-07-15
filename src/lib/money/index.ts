import Decimal from "decimal.js";
import type {
  Item,
  ItemExpense,
  RecurringInterval,
} from "@/types/domain";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const formatterCache = new Map<string, Intl.NumberFormat>();

export function parseMoney(input: string): Decimal {
  const normalized = input.replace(/[\s,]/g, "").trim();
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid money value");
  }
  return new Decimal(normalized);
}

export function formatMoney(
  value: Decimal.Value,
  currency: string,
  locale: string,
  options: { compact?: boolean; computedRatio?: boolean } = {},
): string {
  const decimal = new Decimal(value);
  const tinyRatio = options.computedRatio && !decimal.isZero() && decimal.abs().lt(0.01);
  const key = `${locale}:${currency}:${options.compact ? "compact" : "standard"}:${tinyRatio ? 4 : options.computedRatio ? 2 : "auto"}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: options.compact ? "compact" : "standard",
      minimumFractionDigits: options.computedRatio ? 2 : undefined,
      maximumFractionDigits: tinyRatio ? 4 : options.computedRatio ? 2 : undefined,
    });
    formatterCache.set(key, formatter);
  }
  return formatter.format(decimal.toNumber());
}

export function groupByCurrency<T>(
  records: T[],
  getCurrency: (record: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const currency = getCurrency(record);
    const group = groups.get(currency);
    if (group) group.push(record);
    else groups.set(currency, [record]);
  }
  return groups;
}

export function calculatePurchaseCost(item: Item): Decimal {
  const amount = parseMoney(item.purchaseAmount);
  return item.priceMode === "per_unit"
    ? amount.mul(parseMoney(item.quantity || "1"))
    : amount;
}

export function calculateInvestedCost(item: Item, expenses: ItemExpense[]): Decimal {
  return expenses.reduce((total, expense) => {
    if (expense.type === "refund" || expense.type === "resale") return total;
    return total.plus(parseMoney(expense.amount));
  }, calculatePurchaseCost(item));
}

export function calculateNetCost(item: Item, expenses: ItemExpense[]): Decimal {
  return expenses.reduce((total, expense) => {
    const amount = parseMoney(expense.amount);
    return expense.type === "refund" || expense.type === "resale"
      ? total.minus(amount)
      : total;
  }, calculateInvestedCost(item, expenses));
}

export function calculateDaysHeld(purchaseDate: string, effectiveEndDate: string): number {
  const [purchaseYear, purchaseMonth, purchaseDay] = purchaseDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = effectiveEndDate.split("-").map(Number);
  const purchaseUtc = Date.UTC(purchaseYear, purchaseMonth - 1, purchaseDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.max(1, Math.floor((endUtc - purchaseUtc) / 86_400_000) + 1);
}

export function calculateDailyCost(totalCost: Decimal.Value, daysHeld: number): Decimal {
  return new Decimal(totalCost).div(Math.max(1, daysHeld));
}

export function calculateCostPerUse(totalCost: Decimal.Value, usageCount: number): Decimal {
  return new Decimal(totalCost).div(Math.max(1, usageCount));
}

export function calculateRecurringDailyCost(
  amount: Decimal.Value,
  interval: RecurringInterval,
  intervalCount = 1,
): Decimal {
  const divisor = {
    day: 1,
    week: 7,
    month: 30.4375,
    quarter: 91.3125,
    year: 365.25,
  }[interval];
  return new Decimal(amount).div(new Decimal(divisor).mul(Math.max(1, intervalCount)));
}

export function changeCurrency(amount: string, _from: string, to: string) {
  return { amount: parseMoney(amount).toString(), currency: to };
}
