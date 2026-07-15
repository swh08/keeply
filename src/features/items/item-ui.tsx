"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Heart, Package, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateDailyCost, calculateDaysHeld, calculateInvestedCost, formatMoney } from "@/lib/money";
import { getEffectiveEndDate, daysUntil } from "@/lib/dates";
import type { Category, Item, ItemExpense, Locale } from "@/types/domain";
import { cn } from "@/lib/utils";

export function ItemCover({ item, className }: { item: Item; className?: string }) {
  return (
    <div className={cn("grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-primary", className)}>
      {item.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={URL.createObjectURL(item.coverImage)} alt="" className="size-full object-cover" />
      ) : (
        <Package aria-hidden="true" className="size-5" strokeWidth={1.75} />
      )}
    </div>
  );
}

export function ItemRow({
  item,
  expenses,
  category,
  href,
  onToggleFavorite,
  leading,
}: {
  item: Item;
  expenses: ItemExpense[];
  category?: Category;
  href: string;
  onToggleFavorite?: () => void;
  leading?: React.ReactNode;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations();
  const invested = calculateInvestedCost(item, expenses);
  const days = calculateDaysHeld(item.purchaseDate, getEffectiveEndDate(item));
  const warrantyDays = item.warrantyEndDate ? daysUntil(item.warrantyEndDate) : null;
  return (
    <article className="content-auto group flex min-h-[76px] items-center gap-3 border-b px-1 py-3 last:border-b-0 hover:bg-muted/40 sm:px-3">
      {leading}
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-md">
        <ItemCover item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-medium">{item.name}</h3>
            <Badge variant="secondary" className="hidden sm:inline-flex">{t(`status.${item.status}`)}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[item.brand, item.model, category ? locale === "zh-CN" ? category.nameZh : category.nameEn : undefined].filter(Boolean).join(" · ") || t("items.category")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:hidden">
            {formatMoney(item.purchaseAmount, item.currencyCode, locale)} · {t("detail.days", { count: days })}
          </p>
        </div>
        <div className="hidden min-w-[120px] text-right sm:block">
          <p className="tabular-nums text-sm font-medium">{formatMoney(item.purchaseAmount, item.currencyCode, locale)}</p>
          <p className="tabular-nums text-xs text-muted-foreground">{formatMoney(calculateDailyCost(invested, days), item.currencyCode, locale, { computedRatio: true })}/{locale === "zh-CN" ? "天" : "day"}</p>
        </div>
        <div className="hidden min-w-24 text-right text-xs text-muted-foreground lg:block">
          <p>{t("detail.days", { count: days })}</p>
          {warrantyDays !== null ? (
            <p className={cn("mt-1 inline-flex items-center gap-1", warrantyDays < 0 ? "text-destructive" : "text-primary")}>
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              {warrantyDays < 0 ? t("status.retired") : t("detail.days", { count: warrantyDays })}
            </p>
          ) : null}
        </div>
      </Link>
      {onToggleFavorite ? (
        <Button variant="ghost" size="icon" aria-label={t("items.favorite")} onClick={onToggleFavorite}>
          <Heart aria-hidden="true" fill={item.favorite ? "currentColor" : "none"} className={item.favorite ? "text-primary" : ""} />
        </Button>
      ) : null}
    </article>
  );
}

export function itemMatchesSearch(item: Item, search: string, category?: Category) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return [item.name, item.brand, item.model, item.serialNumber, item.merchant, item.orderNumber, item.notes, category?.nameZh, category?.nameEn]
    .filter(Boolean)
    .some((value) => value!.toLocaleLowerCase().includes(query));
}
