import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateCostPerUse,
  calculateDailyCost,
  calculateDaysHeld,
  calculateInvestedCost,
  calculateNetCost,
  calculatePurchaseCost,
  calculateRecurringDailyCost,
  changeCurrency,
  formatMoney,
  parseMoney,
} from "@/lib/money";
import type { Item, ItemExpense } from "@/types/domain";

const item = (overrides: Partial<Item> = {}): Item => ({
  id: "item-1", userId: "user-1", name: "MacBook Pro", costMode: "ownership", priceMode: "total", purchaseAmount: "3499", currencyCode: "AUD", purchaseDate: "2025-06-01", quantity: "1", usageCount: 0, status: "active", favorite: false, createdAt: "2025-06-01T00:00:00Z", updatedAt: "2025-06-01T00:00:00Z", version: 1, ...overrides,
});
const expense = (type: ItemExpense["type"], amount: string): ItemExpense => ({ id: crypto.randomUUID(), userId: "user-1", itemId: "item-1", type, title: type, amount, occurredAt: "2025-07-01", createdAt: "2025-07-01T00:00:00Z", updatedAt: "2025-07-01T00:00:00Z" });

describe("money parsing and formatting", () => {
  it("parses exact decimals without floating point drift", () => expect(parseMoney("0.1").plus(parseMoney("0.2")).toString()).toBe("0.3"));
  it("formats CNY and AUD independently", () => { expect(formatMoney("6999", "CNY", "zh-CN")).toContain("6,999"); expect(formatMoney("3499", "AUD", "en-AU")).toContain("3,499"); });
  it("shows JPY computed ratios with decimals", () => expect(formatMoney("12.3456", "JPY", "ja-JP", { computedRatio: true })).toMatch(/12[.,]35/));
  it("preserves extra precision for tiny daily cost", () => expect(formatMoney("0.0083", "AUD", "en-AU", { computedRatio: true })).toContain("0.0083"));
  it("handles large amounts", () => expect(parseMoney("99999999999999.999999").toFixed(6)).toBe("99999999999999.999999"));
});

describe("calendar ownership rules", () => {
  it("counts purchase day as day one", () => expect(calculateDaysHeld("2026-07-15", "2026-07-15")).toBe(1));
  it("is stable across daylight saving transitions", () => expect(calculateDaysHeld("2026-10-03", "2026-10-05")).toBe(3));
  it("counts leap-year calendar days", () => expect(calculateDaysHeld("2024-02-28", "2024-03-01")).toBe(3));
  it("stops on retirement date", () => expect(calculateDaysHeld("2024-01-01", "2024-01-10")).toBe(10));
  it("matches the PRD 366-day example", () => expect(calculateDaysHeld("2025-06-01", "2026-06-01")).toBe(366));
});

describe("cost calculations", () => {
  it("supports total price mode", () => expect(calculatePurchaseCost(item({ quantity: "3" })).toString()).toBe("3499"));
  it("supports per-unit price mode", () => expect(calculatePurchaseCost(item({ purchaseAmount: "10.25", quantity: "3", priceMode: "per_unit" })).toString()).toBe("30.75"));
  it("adds positive expenses to invested cost", () => expect(calculateInvestedCost(item(), [expense("repair", "240"), expense("accessory", "129")]).toString()).toBe("3868"));
  it("subtracts refunds and resale only from net cost", () => { const expenses = [expense("repair", "100"), expense("refund", "50"), expense("resale", "1000")]; expect(calculateInvestedCost(item(), expenses).toString()).toBe("3599"); expect(calculateNetCost(item(), expenses).toString()).toBe("2549"); });
  it("calculates AUD daily cost accurately", () => expect(calculateDailyCost(new Decimal("3499"), 366).toFixed(2)).toBe("9.56"));
  it("calculates CNY daily cost accurately", () => expect(calculateDailyCost("6999", 255).toFixed(2)).toBe("27.45"));
  it("guards zero usage count", () => expect(calculateCostPerUse("3499", 0).toString()).toBe("3499"));
  it("converts recurring intervals to daily equivalents", () => { expect(calculateRecurringDailyCost("14.99", "month", 1).toFixed(2)).toBe("0.49"); expect(calculateRecurringDailyCost("365.25", "year", 1).toString()).toBe("1"); });
  it("changes currency without changing the numeric amount", () => expect(changeCurrency("2999", "CNY", "AUD")).toEqual({ amount: "2999", currency: "AUD" }));
});
