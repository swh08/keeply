"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import Decimal from "decimal.js";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "@/db/local/database";
import { calculateDailyCost, calculateDaysHeld, calculateInvestedCost, calculatePurchaseCost, formatMoney } from "@/lib/money";
import { getEffectiveEndDate } from "@/lib/dates";
import type { ItemStatus, Locale } from "@/types/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InsightsPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [currency, setCurrency] = useState<string>();
  const data = useLiveQuery(async () => ({ items: await db.items.filter((item) => !item.deletedAt).toArray(), expenses: await db.expenses.toArray(), categories: await db.categories.toArray() }), []);
  const currencies = [...new Set(data?.items.map((item) => item.currencyCode) ?? [])].toSorted();
  const selected = currency ?? currencies[0];
  const metrics = (() => {
    if (!data || !selected) return null;
    const items = data.items.filter((item) => item.currencyCode === selected);
    let purchase = new Decimal(0); let invested = new Decimal(0); let daily = new Decimal(0); let days = 0;
    const categoryMap = new Map<string, { name: string; count: number; amount: Decimal }>();
    const monthMap = new Map<string, Decimal>();
    const statusMap = new Map<ItemStatus, number>();
    for (const item of items) {
      const itemExpenses = data.expenses.filter((expense) => expense.itemId === item.id);
      const itemInvested = calculateInvestedCost(item, itemExpenses);
      const itemDays = calculateDaysHeld(item.purchaseDate, getEffectiveEndDate(item));
      purchase = purchase.plus(calculatePurchaseCost(item)); invested = invested.plus(itemInvested); daily = daily.plus(calculateDailyCost(itemInvested, itemDays)); days += itemDays;
      const category = data.categories.find((entry) => entry.id === item.categoryId);
      const categoryName = category ? locale === "zh-CN" ? category.nameZh : category.nameEn : t("common.more");
      const existing = categoryMap.get(categoryName) ?? { name: categoryName, count: 0, amount: new Decimal(0) };
      categoryMap.set(categoryName, { name: categoryName, count: existing.count + 1, amount: existing.amount.plus(calculatePurchaseCost(item)) });
      const month = item.purchaseDate.slice(0, 7); monthMap.set(month, (monthMap.get(month) ?? new Decimal(0)).plus(calculatePurchaseCost(item)));
      statusMap.set(item.status, (statusMap.get(item.status) ?? 0) + 1);
    }
    return {
      items,
      purchase,
      invested,
      daily,
      averageDays: items.length ? Math.round(days / items.length) : 0,
      categories: [...categoryMap.values()].map((entry) => ({ ...entry, amount: entry.amount.toNumber() })).toSorted((a, b) => b.amount - a.amount).slice(0, 8),
      months: [...monthMap].map(([month, amount]) => ({ month, amount: amount.toNumber() })).toSorted((a, b) => a.month.localeCompare(b.month)).slice(-12),
      statuses: [...statusMap],
    };
  })();

  return <div className="flex flex-col gap-5 pt-10 md:pt-0">
    <div className="flex items-end justify-between gap-3"><div><h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">{t("insights.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("insights.chooseCurrency")}</p></div>{selected ? <Select value={selected} onValueChange={setCurrency}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{currencies.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectGroup></SelectContent></Select> : null}</div>
    {metrics && selected ? <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><InsightMetric label={t("home.purchased")} value={formatMoney(metrics.purchase, selected, locale)} /><InsightMetric label={t("detail.invested")} value={formatMoney(metrics.invested, selected, locale)} /><InsightMetric label={t("home.dailyCost")} value={formatMoney(metrics.daily, selected, locale, { computedRatio: true })} /><InsightMetric label={t("insights.averageHeld")} value={t("detail.days", { count: metrics.averageDays })} /></section>
      <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{t("insights.textSummary", { count: metrics.items.length, amount: formatMoney(metrics.purchase, selected, locale) })}</p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>{t("insights.purchaseTrend")}</CardTitle></CardHeader><CardContent><div className="h-64 min-w-[420px] overflow-x-auto"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.months}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} /><YAxis hide /><Tooltip formatter={(value) => formatMoney(String(value), selected, locale)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10 }} /><Bar dataKey="amount" fill="var(--primary)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
        <Card><CardHeader><CardTitle>{t("insights.categoryDistribution")}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{metrics.categories.map((entry) => <div key={entry.name}><div className="mb-1.5 flex justify-between text-sm"><span>{entry.name}</span><span className="tabular-nums text-muted-foreground">{formatMoney(entry.amount, selected, locale, { compact: true })}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${metrics.purchase.isZero() ? 0 : new Decimal(entry.amount).div(metrics.purchase).mul(100).toNumber()}%` }} /></div></div>)}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>{t("insights.lifecycle")}</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">{metrics.statuses.map(([status, count]) => <div key={status} className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{t(`status.${status}`)}</p><p className="tabular-nums mt-2 text-2xl font-semibold">{count}</p></div>)}</CardContent></Card>
    </> : <Card><CardContent className="py-20 text-center text-sm text-muted-foreground">{t("items.emptyTitle")}</CardContent></Card>}
  </div>;
}

function InsightMetric({ label, value }: { label: string; value: string }) { return <Card size="sm"><CardContent><p className="text-xs text-muted-foreground">{label}</p><p className="tabular-nums mt-2 truncate text-xl font-semibold md:text-2xl">{value}</p></CardContent></Card>; }
