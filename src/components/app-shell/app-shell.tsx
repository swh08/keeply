"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Archive,
  BarChart3,
  Bell,
  Box,
  CheckCircle2,
  Heart,
  Home,
  LogOut,
  Plus,
  Search,
  Settings,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { KeeplyLogo, KeeplyMark } from "./keeply-logo";

const navItems = [
  ["home", Home, "home"],
  ["items", Box, "items"],
  ["favorites", Heart, "favorites"],
  ["reminders", Bell, "reminders"],
  ["insights", BarChart3, "insights"],
  ["archive", Archive, "archive"],
  ["trash", Trash2, "trash"],
  ["settings", Settings, "settings"],
] as const;

const mobileNavItems = [
  ["home", Home, "home"],
  ["items", Box, "items"],
  ["add", Plus, "add"],
  ["insights", BarChart3, "insights"],
  ["settings", Settings, "settings"],
] as const;

export function AppShell({
  children,
  locale,
  onAdd,
  onSearch,
  onSignOut,
  user,
  pendingCount,
  online,
}: {
  children: React.ReactNode;
  locale: string;
  onAdd: () => void;
  onSearch: () => void;
  onSignOut: () => void;
  user: { id: string; name: string; email: string };
  pendingCount: number;
  online: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const base = `/${locale}/app`;
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || user.email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-dvh md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar px-4 py-5 md:flex">
        <div className="px-2 pb-7">
          <KeeplyLogo locale={locale} className="h-9" />
        </div>
        <nav aria-label={t("brand.name")} className="flex flex-1 flex-col gap-1">
          {navItems.map(([key, Icon, href]) => {
            const active = pathname.includes(`${base}/${href}`);
            return (
              <Link
                key={key}
                href={`${base}/${href}`}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                {t(`nav.${key}`)}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={t("auth.logout")} onClick={onSignOut}><LogOut /></Button>
          </div>
          <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground" role="status">
            {online ? (
              <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
            ) : (
              <WifiOff aria-hidden="true" className="size-4" />
            )}
            <span>{online ? (pendingCount ? t("sync.pending", { count: pendingCount }) : t("sync.synced")) : t("sync.offline")}</span>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 hidden h-[72px] items-center border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:flex lg:px-9">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-5">
          <span className="text-xl font-semibold tracking-tight">{currentTitle(pathname, base, t)}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="w-72 justify-start text-muted-foreground" onClick={onSearch}>
              <Search data-icon="inline-start" />
              {t("items.searchPlaceholder")}
              <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[11px]">⌘K</kbd>
            </Button>
            <Button onClick={onAdd}>
              <Plus data-icon="inline-start" />
              {t("home.addItem")}
            </Button>
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100dvh-72px)] max-w-[1280px] px-4 pb-28 pt-5 md:px-6 md:pb-10 md:pt-8 lg:px-9">
        {children}
      </main>

      <nav
        aria-label={t("brand.name")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 px-2 pt-2 backdrop-blur md:hidden"
      >
        {mobileNavItems.map(([key, Icon, href], index) => {
          if (key === "add") {
            return (
              <button key={key} type="button" onClick={onAdd} className="-mt-7 flex min-h-14 flex-col items-center gap-1 text-xs font-medium text-muted-foreground">
                <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                  <Icon aria-hidden="true" className="size-7" strokeWidth={1.75} />
                </span>
                <span className="sr-only">{t("home.addItem")}</span>
              </button>
            );
          }
          const active = pathname.includes(`${base}/${href}`);
          return (
            <Link
              key={key}
              href={`${base}/${href}`}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon aria-hidden="true" className="size-5" fill={index === 0 && active ? "currentColor" : "none"} strokeWidth={1.75} />
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="fixed left-4 top-4 z-20 flex items-center gap-3 md:hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={`${base}/home`} className="grid size-10 place-items-center rounded-lg bg-card shadow-sm">
              <KeeplyMark className="size-6 text-primary" />
              <span className="sr-only">{t("brand.name")}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent>{t("brand.name")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function currentTitle(pathname: string, base: string, t: ReturnType<typeof useTranslations>) {
  const match = navItems.find(([, , href]) => pathname.includes(`${base}/${href}`));
  return match ? t(`nav.${match[0]}`) : t("brand.name");
}
