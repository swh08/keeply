import { formatDistanceToNowStrict } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import type { Item, Locale } from "@/types/domain";

export const todayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function getEffectiveEndDate(item: Item, today = todayLocal()): string {
  return item.actualEndDate && ["sold", "gifted", "lost", "retired"].includes(item.status)
    ? item.actualEndDate
    : today;
}

export function formatRelativeDate(value: string, locale: Locale): string {
  return formatDistanceToNowStrict(new Date(value), {
    addSuffix: true,
    locale: locale === "zh-CN" ? zhCN : enUS,
  });
}

export function daysUntil(date: string, today = todayLocal()): number {
  const [year, month, day] = date.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  return Math.ceil(
    (Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) /
      86_400_000,
  );
}
