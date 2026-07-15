"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { Bell, BellRing, Check, RotateCcw } from "lucide-react";
import { db } from "@/db/local/database";
import { toggleReminder } from "@/db/repositories/activity";
import { daysUntil, todayLocal } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { Reminder } from "@/types/domain";

export function RemindersPage({ locale }: { locale: string }) {
  const t = useTranslations();
  const reminders = useLiveQuery(() => db.reminders.orderBy("remindAt").toArray(), []);
  const groups = reminders ? groupReminders(reminders) : [];
  const requestNotifications = async () => {
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  };
  return (
    <div className="flex flex-col gap-5 pt-10 md:pt-0">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">{t("reminders.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("reminders.notificationExplanation")}</p></div><Button variant="outline" onClick={() => void requestNotifications()}><BellRing data-icon="inline-start" />{t("reminders.enableNotifications")}</Button></div>
      {groups.some((group) => group.items.length) ? groups.map((group) => group.items.length ? (
        <Card key={group.key} size="sm"><CardHeader className="border-b"><CardTitle>{t(`reminders.${group.key}`)}</CardTitle></CardHeader><CardContent className="px-0">{group.items.map((reminder) => <div key={reminder.id} className="flex min-h-16 items-center gap-3 border-b px-4 py-3 last:border-b-0"><span className="grid size-9 place-items-center rounded-lg bg-muted"><Bell className="size-4 text-primary" /></span><Link href={reminder.itemId ? `/${locale}/app/items/${reminder.itemId}` : "#"} className="min-w-0 flex-1 rounded-md"><p className="truncate text-sm font-medium">{reminder.title}</p><p className="mt-1 text-xs text-muted-foreground">{reminder.remindAt.slice(0, 10)}</p></Link><Button size="icon-sm" variant="ghost" aria-label={reminder.completed ? t("reminders.reopen") : t("reminders.complete")} onClick={() => void toggleReminder(reminder.id, !reminder.completed)}>{reminder.completed ? <RotateCcw /> : <Check />}</Button></div>)}</CardContent></Card>
      ) : null) : <Empty className="rounded-xl border bg-card py-20"><EmptyHeader><EmptyMedia variant="icon"><Bell /></EmptyMedia><EmptyTitle>{t("reminders.empty")}</EmptyTitle><EmptyDescription>{t("reminders.notificationExplanation")}</EmptyDescription></EmptyHeader></Empty>}
    </div>
  );
}

function groupReminders(reminders: Reminder[]) {
  const today = todayLocal();
  return [
    { key: "overdue", items: reminders.filter((item) => !item.completed && item.remindAt.slice(0, 10) < today) },
    { key: "today", items: reminders.filter((item) => !item.completed && item.remindAt.slice(0, 10) === today) },
    { key: "upcoming", items: reminders.filter((item) => !item.completed && daysUntil(item.remindAt.slice(0, 10)) > 0) },
    { key: "completed", items: reminders.filter((item) => item.completed) },
  ];
}
