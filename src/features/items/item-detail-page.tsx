"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, BellPlus, CalendarClock, Copy, Heart, MoreHorizontal, Pencil, Plus, RefreshCw, RotateCcw, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/db/local/database";
import { addExpense, createReminder, recordUsage } from "@/db/repositories/activity";
import { changeItemCurrency, duplicateItem, moveItemToTrash, setItemStatus, updateItem } from "@/db/repositories/items";
import { daysUntil, getEffectiveEndDate, todayLocal } from "@/lib/dates";
import { calculateCostPerUse, calculateDailyCost, calculateDaysHeld, calculateInvestedCost, calculateNetCost, formatMoney } from "@/lib/money";
import type { ExpenseType, Item, Locale, ReminderType } from "@/types/domain";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ItemCover } from "./item-ui";

const currencies = ["CNY", "AUD", "USD", "EUR", "GBP", "JPY", "HKD", "SGD", "CAD", "NZD"];

export function ItemDetailPage({ locale, id, onEdit }: { locale: string; id: string; onEdit: (item: Item) => void }) {
  const t = useTranslations();
  const activeLocale = useLocale() as Locale;
  const data = useLiveQuery(async () => {
    const item = await db.items.get(id);
    if (!item) return null;
    const [expenses, usage, reminders, category] = await Promise.all([
      db.expenses.where("itemId").equals(id).reverse().sortBy("occurredAt"),
      db.usageEvents.where("itemId").equals(id).reverse().sortBy("occurredAt"),
      db.reminders.where("itemId").equals(id).sortBy("remindAt"),
      item.categoryId ? db.categories.get(item.categoryId) : undefined,
    ]);
    return { item, expenses, usage, reminders, category };
  }, [id]);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<string>();

  const metrics = useMemo(() => {
    if (!data) return null;
    const invested = calculateInvestedCost(data.item, data.expenses);
    const net = calculateNetCost(data.item, data.expenses);
    const days = calculateDaysHeld(data.item.purchaseDate, getEffectiveEndDate(data.item));
    return { invested, net, days, daily: calculateDailyCost(invested, days), netDaily: calculateDailyCost(net, days), perUse: calculateCostPerUse(invested, data.item.usageCount) };
  }, [data]);

  if (data === undefined) return <div className="pt-20 text-center text-sm text-muted-foreground">{t("common.open")}…</div>;
  if (!data || !metrics) return (
    <Empty className="pt-24"><EmptyHeader><EmptyTitle>{t("errors.notFound")}</EmptyTitle><EmptyDescription><Button asChild variant="outline"><Link href={`/${locale}/app/items`}>{t("common.back")}</Link></Button></EmptyDescription></EmptyHeader></Empty>
  );
  const { item, expenses, usage, reminders, category } = data;

  const currencyBefore = formatMoney(item.purchaseAmount, item.currencyCode, activeLocale);
  const currencyAfter = pendingCurrency ? formatMoney(item.purchaseAmount, pendingCurrency, activeLocale) : "";

  return (
    <div className="flex flex-col gap-6 pt-10 md:pt-0">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm"><Link href={`/${locale}/app/items`}><ArrowLeft data-icon="inline-start" />{t("common.back")}</Link></Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={t("items.favorite")} onClick={() => void updateItem(item.id, { favorite: !item.favorite })}><Heart fill={item.favorite ? "currentColor" : "none"} className={item.favorite ? "text-primary" : ""} /></Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(item)}><Pencil data-icon="inline-start" />{t("common.edit")}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t("common.more")}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => void duplicateItem(item.id).then(() => toast.success(t("form.saved")))}><Copy />{t("items.copy")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void setItemStatus(item.id, item.status === "retired" ? "active" : "retired", item.status === "retired" ? undefined : todayLocal())}>{item.status === "retired" ? <RotateCcw /> : <RefreshCw />}{item.status === "retired" ? t("items.restoreActive") : t("items.markRetired")}</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup><DropdownMenuItem variant="destructive" onSelect={() => void moveItemToTrash(item.id)}><Trash2 />{t("items.moveTrash")}</DropdownMenuItem></DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
        <ItemCover item={item} className="size-24 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-[26px] font-semibold tracking-tight md:text-[30px]">{item.name}</h1><Badge variant="secondary">{t(`status.${item.status}`)}</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">{[item.brand, item.model, category ? activeLocale === "zh-CN" ? category.nameZh : category.nameEn : undefined].filter(Boolean).join(" · ")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span>{item.purchaseDate}</span><span className="text-muted-foreground">·</span><span>{t("detail.days", { count: metrics.days })}</span>
            {item.warrantyEndDate ? <span className={daysUntil(item.warrantyEndDate) < 0 ? "text-destructive" : "text-primary"}>{t("items.warranty")} · {item.warrantyEndDate}</span> : null}
          </div>
        </div>
        <Select value={item.currencyCode} onValueChange={(value) => value !== item.currencyCode && setPendingCurrency(value)}>
          <SelectTrigger aria-label={t("items.currency")} className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>{currencies.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={t("detail.purchase")} value={formatMoney(item.purchaseAmount, item.currencyCode, activeLocale)} />
        <Metric label={t("detail.invested")} value={formatMoney(metrics.invested, item.currencyCode, activeLocale)} />
        <Metric label={t("detail.currentDaily")} value={`${formatMoney(metrics.daily, item.currencyCode, activeLocale, { computedRatio: true })}/${activeLocale === "zh-CN" ? "天" : "day"}`} />
        {item.costMode === "per_use" ? <Metric label={t("detail.costPerUse")} value={formatMoney(metrics.perUse, item.currencyCode, activeLocale, { computedRatio: true })} /> : <Metric label={t("detail.netCost")} value={formatMoney(metrics.net, item.currencyCode, activeLocale)} />}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
        <div className="flex flex-col gap-5">
          <Card size="sm">
            <CardHeader className="flex-row items-center justify-between border-b"><CardTitle>{t("detail.expenses")}</CardTitle><Button size="sm" variant="outline" onClick={() => setExpenseOpen(true)}><Plus data-icon="inline-start" />{t("detail.addExpense")}</Button></CardHeader>
            <CardContent className="px-0">
              {expenses.length ? expenses.map((expense) => <div key={expense.id} className="flex min-h-14 items-center gap-3 border-b px-4 py-3 last:border-b-0"><span className="grid size-8 place-items-center rounded-lg bg-muted"><Wrench className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{expense.title}</p><p className="text-xs text-muted-foreground">{expense.occurredAt}</p></div><p className="tabular-nums text-sm font-medium">{expense.type === "refund" || expense.type === "resale" ? "−" : "+"}{formatMoney(expense.amount, item.currencyCode, activeLocale)}</p></div>) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("detail.noExpenses")}</p>}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="flex-row items-center justify-between border-b"><CardTitle>{t("detail.usage")}</CardTitle><Button size="sm" variant="outline" onClick={() => void recordUsage(item.id, 1).then(() => toast.success(t("detail.addUsage")))}><Plus data-icon="inline-start" />+1</Button></CardHeader>
            <CardContent className="px-0">
              {usage.length ? usage.slice(0, 8).map((event) => <div key={event.id} className="flex min-h-12 items-center justify-between border-b px-4 py-3 last:border-b-0"><span className="text-sm">{event.occurredAt.slice(0, 10)}</span><span className="tabular-nums text-sm font-medium">+{event.count}</span></div>) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("detail.noUsage")}</p>}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card size="sm">
            <CardHeader className="flex-row items-center justify-between border-b"><CardTitle>{t("detail.reminders")}</CardTitle><Button size="icon-sm" variant="ghost" aria-label={t("detail.addReminder")} onClick={() => setReminderOpen(true)}><BellPlus /></Button></CardHeader>
            <CardContent className="px-0">
              {reminders.length ? reminders.map((reminder) => <div key={reminder.id} className="flex gap-3 border-b px-4 py-3 last:border-b-0"><CalendarClock className="mt-0.5 size-4 text-primary" /><div><p className="text-sm font-medium">{reminder.title}</p><p className="mt-1 text-xs text-muted-foreground">{reminder.remindAt.slice(0, 10)}</p></div></div>) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("reminders.empty")}</p>}
            </CardContent>
          </Card>
          <Card size="sm"><CardHeader><CardTitle>{t("detail.timeline")}</CardTitle></CardHeader><CardContent><ol className="border-l pl-5 text-sm"><li className="relative pb-5 before:absolute before:-left-[25px] before:top-1 before:size-2 before:rounded-full before:bg-primary"><p className="font-medium">{t("detail.purchase")}</p><p className="mt-1 text-xs text-muted-foreground">{item.purchaseDate}</p></li>{expenses.slice().reverse().map((expense) => <li key={expense.id} className="relative pb-5 before:absolute before:-left-[25px] before:top-1 before:size-2 before:rounded-full before:bg-border"><p className="font-medium">{expense.title}</p><p className="mt-1 text-xs text-muted-foreground">{expense.occurredAt}</p></li>)}</ol></CardContent></Card>
          {item.notes ? <Card size="sm"><CardHeader><CardTitle>{t("detail.notes")}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.notes}</p></CardContent></Card> : null}
        </div>
      </div>

      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} itemId={item.id} />
      <ReminderDialog open={reminderOpen} onOpenChange={setReminderOpen} itemId={item.id} />
      <AlertDialog open={Boolean(pendingCurrency)} onOpenChange={(open) => !open && setPendingCurrency(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("items.currencyWarningTitle")}</AlertDialogTitle><AlertDialogDescription>{t("items.currencyWarning", { before: currencyBefore, after: currencyAfter })}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => pendingCurrency && void changeItemCurrency(item.id, pendingCurrency).then(() => setPendingCurrency(undefined))}>{t("common.confirm")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card size="sm"><CardContent><p className="text-xs text-muted-foreground">{label}</p><p className="tabular-nums mt-2 truncate text-xl font-semibold tracking-tight md:text-2xl">{value}</p></CardContent></Card>;
}

function ExpenseDialog({ open, onOpenChange, itemId }: { open: boolean; onOpenChange: (open: boolean) => void; itemId: string }) {
  const t = useTranslations();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<ExpenseType>("other");
  const [notes, setNotes] = useState("");
  const save = async () => {
    if (!title.trim() || !amount.trim()) return;
    await addExpense({ itemId, title: title.trim(), amount, type, notes: notes.trim(), occurredAt: todayLocal() });
    setTitle(""); setAmount(""); setNotes(""); onOpenChange(false); toast.success(t("form.saved"));
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{t("detail.addExpense")}</DialogTitle><DialogDescription>{t("detail.expenses")}</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="expense-title">{t("detail.expenseTitle")}</FieldLabel><Input id="expense-title" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field><FieldLabel>{t("detail.expenseType")}</FieldLabel><Select value={type} onValueChange={(value) => setType(value as ExpenseType)}><SelectTrigger aria-label={t("detail.expenseType")}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{(["accessory", "repair", "maintenance", "shipping", "service", "refund", "resale", "other"] as ExpenseType[]).map((value) => <SelectItem key={value} value={value}>{t(`expenseTypes.${value}`)}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="expense-amount">{t("detail.amount")}</FieldLabel><Input id="expense-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field></div><Field><FieldLabel htmlFor="expense-notes">{t("form.notes")}</FieldLabel><Textarea id="expense-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></FieldGroup><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button><Button onClick={() => void save()}>{t("common.save")}</Button></DialogFooter></DialogContent></Dialog>;
}

function ReminderDialog({ open, onOpenChange, itemId }: { open: boolean; onOpenChange: (open: boolean) => void; itemId: string }) {
  const t = useTranslations();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [type, setType] = useState<ReminderType>("custom");
  const save = async () => {
    if (!title.trim()) return;
    await createReminder({ itemId, title: title.trim(), type, remindAt: `${date}T09:00:00` });
    setTitle(""); onOpenChange(false); toast.success(t("form.saved"));
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{t("detail.addReminder")}</DialogTitle><DialogDescription>{t("reminders.notificationExplanation")}</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="reminder-title">{t("detail.reminders")}</FieldLabel><Input id="reminder-title" value={title} onChange={(event) => setTitle(event.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field><FieldLabel>{t("detail.reminderType")}</FieldLabel><Select value={type} onValueChange={(value) => setType(value as ReminderType)}><SelectTrigger aria-label={t("detail.reminderType")}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{(["warranty", "renewal", "retirement", "maintenance", "return", "custom"] as ReminderType[]).map((value) => <SelectItem key={value} value={value}>{t(`reminderTypes.${value}`)}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="reminder-date">{t("detail.date")}</FieldLabel><Input id="reminder-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field></div></FieldGroup><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button><Button onClick={() => void save()}>{t("common.save")}</Button></DialogFooter></DialogContent></Dialog>;
}
