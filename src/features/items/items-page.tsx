"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import { ArchiveRestore, CheckSquare, Grid2X2, Heart, List, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { db } from "@/db/local/database";
import { moveItemToTrash, permanentlyDeleteItem, restoreItem, setItemStatus, updateItem } from "@/db/repositories/items";
import { todayLocal } from "@/lib/dates";
import { calculateDailyCost, calculateDaysHeld, calculateInvestedCost, formatMoney } from "@/lib/money";
import type { Item, ItemStatus, Locale } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ItemCover, ItemRow, itemMatchesSearch } from "./item-ui";
import { getEffectiveEndDate } from "@/lib/dates";

export type ItemsView = "items" | "favorites" | "archive" | "trash";
const terminalStatuses: ItemStatus[] = ["sold", "gifted", "lost", "retired"];

export function ItemsPage({ locale, view, onAdd }: { locale: string; view: ItemsView; onAdd: () => void }) {
  const t = useTranslations();
  const activeLocale = useLocale() as Locale;
  const data = useLiveQuery(async () => ({
    items: await db.items.toArray(),
    expenses: await db.expenses.toArray(),
    categories: await db.categories.orderBy("sortOrder").toArray(),
  }), []);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [currency, setCurrency] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("updated");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const result = data.items.filter((item) => {
      if (view === "trash") return Boolean(item.deletedAt);
      if (item.deletedAt) return false;
      if (view === "favorites" && !item.favorite) return false;
      if (view === "archive" && !terminalStatuses.includes(item.status)) return false;
      if (view === "items" && terminalStatuses.includes(item.status)) return false;
      if (currency !== "ALL" && item.currencyCode !== currency) return false;
      if (status !== "ALL" && item.status !== status) return false;
      if (category !== "ALL" && item.categoryId !== category) return false;
      return itemMatchesSearch(item, deferredSearch, data.categories.find((entry) => entry.id === item.categoryId));
    });
    return result.toSorted((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, activeLocale);
      if (sort === "purchase") return b.purchaseDate.localeCompare(a.purchaseDate);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [activeLocale, category, currency, data, deferredSearch, sort, status, view]);

  const currencies = [...new Set(data?.items.filter((item) => !item.deletedAt).map((item) => item.currencyCode) ?? [])].toSorted();
  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, Item[]>();
    for (const item of filtered) {
      const key = item.categoryId ?? "00000000-0000-4000-8000-000000000019";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map].map(([categoryId, items]) => ({ category: data.categories.find((entry) => entry.id === categoryId), items }));
  }, [data, filtered]);

  const title = view === "items" ? t("items.title") : t(`nav.${view}`);
  const toggleSelected = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const runBatch = async (action: "favorite" | "retire" | "trash" | "restore" | "delete") => {
    await Promise.all([...selected].map((id) => {
      if (action === "favorite") return updateItem(id, { favorite: true });
      if (action === "retire") return setItemStatus(id, "retired", todayLocal());
      if (action === "restore") return restoreItem(id);
      if (action === "delete") return permanentlyDeleteItem(id);
      return moveItemToTrash(id);
    }));
    setSelected(new Set());
    setSelectionMode(false);
  };

  return (
    <div className="flex flex-col gap-5 pt-10 md:pt-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">{title}</h1>
          {view === "trash" ? <p className="mt-1 text-sm text-muted-foreground">{t("items.trashRetention")}</p> : null}
        </div>
        <div className="flex gap-2">
          {filtered.length ? <Button variant="outline" onClick={() => { setSelectionMode((value) => !value); setSelected(new Set()); }}><CheckSquare data-icon="inline-start" />{t("common.more")}</Button> : null}
          {view === "items" ? <Button onClick={onAdd}><Plus data-icon="inline-start" />{t("home.addItem")}</Button> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("items.searchPlaceholder")} className="pl-9" />
          <span className="sr-only">{t("common.search")}</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger aria-label={t("items.currency")} className="lg:w-28"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="ALL">{t("home.allCurrencies")}</SelectItem>{currencies.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label={t("items.status")} className="lg:w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="ALL">{t("items.status")}</SelectItem>{(["active", "stored", "lent", "repairing", "sold", "gifted", "lost", "retired"] as ItemStatus[]).map((value) => <SelectItem key={value} value={value}>{t(`status.${value}`)}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label={t("items.category")} className="lg:w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="ALL">{t("items.category")}</SelectItem>{data?.categories.filter((entry) => !entry.isArchived).map((entry) => <SelectItem key={entry.id} value={entry.id}>{activeLocale === "zh-CN" ? entry.nameZh : entry.nameEn}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label={t("items.sort")} className="lg:w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="updated">{t("items.recentlyUpdated")}</SelectItem><SelectItem value="created">{t("items.recentlyAdded")}</SelectItem><SelectItem value="name">{t("items.name")}</SelectItem><SelectItem value="purchase">{t("items.purchaseDate")}</SelectItem></SelectGroup></SelectContent>
          </Select>
        </div>
        <div className="flex rounded-lg border p-0.5">
          <Button aria-label={t("items.list")} size="icon-sm" variant={layout === "list" ? "secondary" : "ghost"} onClick={() => setLayout("list")}><List /></Button>
          <Button aria-label={t("items.grid")} size="icon-sm" variant={layout === "grid" ? "secondary" : "ghost"} onClick={() => setLayout("grid")}><Grid2X2 /></Button>
        </div>
      </div>

      {selectionMode && selected.size ? (
        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm">
          <span className="mr-auto text-sm font-medium">{selected.size}</span>
          {view === "trash" ? <><Button size="sm" onClick={() => void runBatch("restore")}><ArchiveRestore data-icon="inline-start" />{t("common.restore")}</Button><Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 data-icon="inline-start" />{t("items.permanentDelete")}</Button></> : <>
            <Button size="sm" variant="outline" onClick={() => void runBatch("favorite")}><Heart data-icon="inline-start" />{t("items.favorite")}</Button>
            <Button size="sm" variant="outline" onClick={() => void runBatch("retire")}><SlidersHorizontal data-icon="inline-start" />{t("items.markRetired")}</Button>
            <Button size="sm" variant="destructive" onClick={() => void runBatch("trash")}><Trash2 data-icon="inline-start" />{t("items.moveTrash")}</Button>
          </>}
        </div>
      ) : null}

      {filtered.length ? layout === "list" ? (
        <div className="flex flex-col gap-4">
          {grouped.map(({ category: groupCategory, items }) => (
            <details key={groupCategory?.id ?? "other"} open className="overflow-hidden rounded-xl border bg-card">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between border-b px-4 text-sm font-semibold">
                <span>{groupCategory ? activeLocale === "zh-CN" ? groupCategory.nameZh : groupCategory.nameEn : t("common.more")}</span>
                <span className="tabular-nums text-muted-foreground">{items.length}</span>
              </summary>
              <div className="px-2">
                {items.map((item) => <ItemRow key={item.id} item={item} expenses={data?.expenses.filter((expense) => expense.itemId === item.id) ?? []} category={groupCategory} href={`/${locale}/app/items/${item.id}`} leading={selectionMode ? <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelected(item.id)} aria-label={`${t("common.open")} ${item.name}`} /> : undefined} onToggleFavorite={() => void updateItem(item.id, { favorite: !item.favorite })} />)}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const itemExpenses = data?.expenses.filter((expense) => expense.itemId === item.id) ?? [];
            const days = calculateDaysHeld(item.purchaseDate, getEffectiveEndDate(item));
            return (
              <Card key={item.id} size="sm" className="transition-transform hover:-translate-y-0.5">
                <CardHeader className="flex-row items-start">
                  {selectionMode ? <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelected(item.id)} aria-label={`${t("common.open")} ${item.name}`} /> : <ItemCover item={item} className="size-14" />}
                  <div className="min-w-0 flex-1"><CardTitle className="truncate">{item.name}</CardTitle><p className="mt-1 truncate text-xs text-muted-foreground">{[item.brand, item.model].filter(Boolean).join(" · ") || t(`status.${item.status}`)}</p></div>
                </CardHeader>
                <CardContent>
                  <Link href={`/${locale}/app/items/${item.id}`} className="block rounded-md">
                    <p className="tabular-nums text-xl font-semibold">{formatMoney(item.purchaseAmount, item.currencyCode, activeLocale)}</p>
                    <p className="mt-1 tabular-nums text-xs text-muted-foreground">{formatMoney(calculateDailyCost(calculateInvestedCost(item, itemExpenses), days), item.currencyCode, activeLocale, { computedRatio: true })}/{activeLocale === "zh-CN" ? "天" : "day"} · {t("detail.days", { count: days })}</p>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty className="rounded-xl border bg-card py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>{search || currency !== "ALL" || status !== "ALL" || category !== "ALL" ? t("items.noResults") : t("items.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{search || currency !== "ALL" || status !== "ALL" || category !== "ALL" ? t("items.noResultsDescription") : t("items.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{view === "items" ? <Button onClick={onAdd}><Plus data-icon="inline-start" />{t("items.addFirst")}</Button> : null}</EmptyContent>
        </Empty>
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("items.permanentDelete")}</AlertDialogTitle><AlertDialogDescription>{t("items.permanentDeleteConfirm", { count: selected.size })}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void runBatch("delete")}>{t("items.permanentDelete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
