"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Camera, MoreHorizontal, PackagePlus, Plus, ReceiptText, RefreshCw, WalletCards } from "lucide-react";
import Decimal from "decimal.js";
import { db } from "@/db/local/database";
import { updateItem } from "@/db/repositories/items";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateDailyCost, calculateDaysHeld, calculateInvestedCost, calculatePurchaseCost, formatMoney, groupByCurrency } from "@/lib/money";
import { daysUntil, getEffectiveEndDate } from "@/lib/dates";
import type { CurrencySummary, Item, ItemExpense, Locale } from "@/types/domain";
import { ItemRow } from "@/features/items/item-ui";

const terminalStatuses = new Set(["sold", "gifted", "lost", "retired"]);

export function HomePage({ locale, userName, onAdd, onScanReceipt, onAddSubscription }: { locale: string; userName: string; onAdd: () => void; onScanReceipt: () => void; onAddSubscription: () => void }) {
  const t = useTranslations();
  const activeLocale = useLocale() as Locale;
  const [currency, setCurrency] = useState("ALL");
  const data = useLiveQuery(async () => {
    const [items, expenses, categories, reminders] = await Promise.all([
      db.items.filter((item) => !item.deletedAt && !terminalStatuses.has(item.status)).toArray(),
      db.expenses.toArray(),
      db.categories.orderBy("sortOrder").toArray(),
      db.reminders.filter((reminder) => !reminder.completed && !reminder.dismissed).toArray(),
    ]);
    return { items, expenses, categories, reminders };
  }, []);
  const summaries = data ? buildSummaries(data.items, data.expenses) : [];
  const currencies = summaries.map((summary) => summary.currencyCode);
  const visibleItems = data?.items.filter((item) => currency === "ALL" || item.currencyCode === currency) ?? [];
  const recent = visibleItems.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const expiring = data ? [
    ...data.items.filter((item) => item.warrantyEndDate && daysUntil(item.warrantyEndDate) >= 0 && daysUntil(item.warrantyEndDate) <= 30).map((item) => ({ id: `w-${item.id}`, itemId: item.id, title: item.name, date: item.warrantyEndDate!, type: "warranty" })),
    ...data.reminders.filter((reminder) => daysUntil(reminder.remindAt.slice(0, 10)) <= 30).map((reminder) => ({ id: reminder.id, itemId: reminder.itemId, title: reminder.title, date: reminder.remindAt.slice(0, 10), type: reminder.type })),
  ].toSorted((a, b) => a.date.localeCompare(b.date)).slice(0, 3) : [];
  const categoryCounts = (() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const item of visibleItems) counts.set(item.categoryId ?? "00000000-0000-4000-8000-000000000019", (counts.get(item.categoryId ?? "00000000-0000-4000-8000-000000000019") ?? 0) + 1);
    return [...counts.entries()].map(([id, count]) => ({ category: data.categories.find((entry) => entry.id === id), count })).toSorted((a, b) => b.count - a.count).slice(0, 4);
  })();

  if (!data) return <HomeSkeleton />;

  return (
    <div className="flex flex-col gap-7 pt-10 md:pt-0">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">{t("home.greeting", { name: userName })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("home.subtitle")}</p>
        </div>
        <div className="flex max-w-full overflow-x-auto rounded-xl border bg-card p-1" role="group" aria-label={t("items.currency")}>
          {["ALL", ...currencies].map((code) => (
            <button key={code} type="button" onClick={() => setCurrency(code)} className={`min-h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition-colors ${currency === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {code === "ALL" ? t("home.allCurrencies") : code}
            </button>
          ))}
        </div>
      </section>

      {summaries.length ? (
        <section className="grid grid-cols-2 gap-3" aria-label={t("home.purchased")}>
          {summaries.filter((summary) => currency === "ALL" || summary.currencyCode === currency).map((summary) => (
            <Card key={summary.currencyCode} className="overflow-hidden shadow-[0_1px_2px_rgb(20_30_24/0.04),0_8px_24px_rgb(20_30_24/0.05)]">
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center justify-between text-sm font-medium text-primary">
                  {summary.currencyCode}
                  <WalletCards aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="tabular-nums truncate text-[clamp(1.1rem,5.2vw,2rem)] font-semibold tracking-tight md:text-[40px]">{formatMoney(summary.purchaseTotal, summary.currencyCode, activeLocale)}</p>
                <div className="mt-2 flex flex-col items-start gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-3 sm:text-sm">
                  <span className="tabular-nums">{formatMoney(summary.dailyCostTotal, summary.currencyCode, activeLocale, { computedRatio: true })}/{activeLocale === "zh-CN" ? "天" : "day"}</span>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span>{t("home.itemsCount", { count: summary.itemCount })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("items.emptyTitle")}</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <p className="max-w-lg text-sm text-muted-foreground">{t("items.emptyDescription")}</p>
            <Button onClick={onAdd}><Plus data-icon="inline-start" />{t("items.addFirst")}</Button>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="sr-only">{t("home.quickActions")}</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          <QuickAction icon={PackagePlus} label={t("home.addItem")} onClick={onAdd} />
          <QuickAction icon={ReceiptText} label={t("home.scanReceipt")} onClick={onScanReceipt} />
          <QuickAction icon={RefreshCw} label={t("home.addSubscription")} onClick={onAddSubscription} />
          <QuickAction icon={MoreHorizontal} label={t("common.more")} href={`/${locale}/app/items`} className="sm:hidden" />
          <QuickAction icon={Camera} label={t("home.recordUsage")} href={`/${locale}/app/items`} className="hidden sm:flex" />
          <QuickAction icon={Bell} label={t("home.viewReminders")} href={`/${locale}/app/reminders`} className="hidden sm:flex" />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader className="border-b"><CardTitle>{t("home.expiring")}</CardTitle></CardHeader>
          <CardContent className="px-0">
            {expiring.length ? expiring.map((entry) => (
              <Link key={entry.id} href={entry.itemId ? `/${locale}/app/items/${entry.itemId}` : `/${locale}/app/reminders`} className="flex min-h-16 items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/50">
                <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground"><Bell aria-hidden="true" className="size-4" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.title}</span>
                <span className="text-right text-xs text-muted-foreground"><span className="block">{entry.date}</span><span className="text-primary">{t("detail.days", { count: Math.max(0, daysUntil(entry.date)) })}</span></span>
              </Link>
            )) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("reminders.empty")}</p>}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="border-b"><CardTitle>{t("home.categories")}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {categoryCounts.length ? categoryCounts.map(({ category, count }) => (
              <div key={category?.id ?? "other"} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <div className="min-w-0">
                  <div className="mb-1.5 flex justify-between"><span className="truncate">{category ? activeLocale === "zh-CN" ? category.nameZh : category.nameEn : t("common.more")}</span><span className="tabular-nums text-muted-foreground">{count}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, count / Math.max(1, visibleItems.length) * 100)}%` }} /></div>
                </div>
              </div>
            )) : <p className="py-6 text-center text-sm text-muted-foreground">{t("items.emptyTitle")}</p>}
          </CardContent>
        </Card>
      </div>

      {recent.length ? (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-[17px] font-semibold">{t("home.recent")}</h2>
            <Button asChild variant="ghost" size="sm"><Link href={`/${locale}/app/items`}>{t("home.viewAll")}</Link></Button>
          </div>
          <div className="px-2">
            {recent.map((item) => <ItemRow key={item.id} item={item} expenses={data.expenses.filter((expense) => expense.itemId === item.id)} category={data.categories.find((category) => category.id === item.categoryId)} href={`/${locale}/app/items/${item.id}`} onToggleFavorite={() => void updateItem(item.id, { favorite: !item.favorite })} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, href, className = "" }: { icon: typeof Plus; label: string; onClick?: () => void; href?: string; className?: string }) {
  const content = <><Icon aria-hidden="true" className="size-5 text-primary" strokeWidth={1.75} /><span>{label}</span></>;
  const classes = `flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card px-2 text-xs font-medium transition-colors hover:bg-muted sm:min-h-14 sm:flex-row sm:px-3 sm:text-sm ${className}`;
  return href ? <Link href={href} className={classes}>{content}</Link> : <button type="button" onClick={onClick} className={classes}>{content}</button>;
}

function buildSummaries(items: Item[], expenses: ItemExpense[]): CurrencySummary[] {
  return [...groupByCurrency(items, (item) => item.currencyCode)].map(([currencyCode, group]) => {
    let purchaseTotal = new Decimal(0);
    let investedTotal = new Decimal(0);
    let dailyCostTotal = new Decimal(0);
    for (const item of group) {
      const itemExpenses = expenses.filter((expense) => expense.itemId === item.id);
      const invested = calculateInvestedCost(item, itemExpenses);
      purchaseTotal = purchaseTotal.plus(calculatePurchaseCost(item));
      investedTotal = investedTotal.plus(invested);
      dailyCostTotal = dailyCostTotal.plus(calculateDailyCost(invested, calculateDaysHeld(item.purchaseDate, getEffectiveEndDate(item))));
    }
    return { currencyCode, itemCount: group.length, purchaseTotal: purchaseTotal.toString(), investedTotal: investedTotal.toString(), netCostTotal: investedTotal.toString(), dailyCostTotal: dailyCostTotal.toString() };
  }).toSorted((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}

function HomeSkeleton() {
  return <div className="flex flex-col gap-5 pt-10 md:pt-0"><Skeleton className="h-16 w-80 max-w-full" /><div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div><Skeleton className="h-16" /><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-52" /><Skeleton className="h-52" /></div></div>;
}
