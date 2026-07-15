"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BarChart3, Bell, Box, Home, Moon, Plus, Settings, Sun } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { authClient } from "@/lib/auth-client";
import { AppShell } from "@/components/app-shell/app-shell";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearLocalData, db } from "@/db/local/database";
import { clearActiveUserId, initializeActiveUser } from "@/db/local/active-user";
import { runSync } from "@/db/sync/sync-engine";
import { HomePage } from "@/features/home/home-page";
import { InsightsPage } from "@/features/insights/insights-page";
import { ItemDetailPage } from "@/features/items/item-detail-page";
import { ItemFormSheet } from "@/features/items/item-form-sheet";
import { ItemsPage, type ItemsView } from "@/features/items/items-page";
import { RemindersPage } from "@/features/reminders/reminders-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { purgeExpiredTrash } from "@/db/repositories/items";
import type { CostMode, Item, ItemDraft } from "@/types/domain";

export function AppExperience({ locale, path, user }: { locale: string; path: string[]; user: { id: string; name: string; email: string } }) {
  const t = useTranslations();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item>();
  const [presetCostMode, setPresetCostMode] = useState<CostMode>();
  const [receiptPrefill, setReceiptPrefill] = useState<Partial<ItemDraft>>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot);
  const categories = useLiveQuery(() => db.categories.orderBy("sortOrder").toArray(), []) ?? [];
  const items = useLiveQuery(() => db.items.filter((item) => !item.deletedAt).toArray(), []) ?? [];
  const pendingCount = useLiveQuery(() => db.syncQueue.count(), []) ?? 0;
  const section = path[0] ?? "home";
  const itemId = section === "items" && path[1] && path[1] !== "new" ? path[1] : undefined;

  useEffect(() => {
    let cancelled = false;
    void initializeActiveUser(user.id).then(async (userChanged) => {
      if (userChanged) await clearPrivatePageCache();
      if (!cancelled) setLocalReady(true);
    });
    return () => {
      cancelled = true;
      clearActiveUserId();
    };
  }, [user.id]);

  useEffect(() => {
    if (!localReady || !online) return;
    void runSync().catch(() => undefined);
    const interval = window.setInterval(() => void runSync().catch(() => undefined), 60_000);
    return () => window.clearInterval(interval);
  }, [localReady, online, pendingCount, user.id]);

  useEffect(() => {
    if (localReady) void purgeExpiredTrash();
  }, [localReady]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); return; }
      if (typing) return;
      if (event.key.toLowerCase() === "n") { event.preventDefault(); setAddOpen(true); }
      if (event.key === "/") { event.preventDefault(); setSearchOpen(true); }
      if (event.key.toLowerCase() === "h" && event.shiftKey) router.push(`/${locale}/app/home`);
      if (event.key.toLowerCase() === "i" && event.shiftKey) router.push(`/${locale}/app/items`);
      if (event.key.toLowerCase() === "s" && event.shiftKey) router.push(`/${locale}/app/insights`);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [locale, router]);

  const startAdd = (mode?: CostMode) => { setEditingItem(undefined); setReceiptPrefill(undefined); setPresetCostMode(mode); setAddOpen(true); };
  const editItem = (item: Item) => { setEditingItem(item); setPresetCostMode(undefined); setAddOpen(true); };
  const navigateFromSearch = (href: string) => {
    setSearchOpen(false);
    router.push(href);
  };
  const signOut = async () => {
    if (!online && pendingCount) {
      toast.error(t("auth.pendingLogout"));
      return;
    }
    if (pendingCount) {
      const result = await runSync().catch(() => ({ synced: 0, failed: pendingCount }));
      if (result.failed) {
        toast.error(t("auth.pendingLogout"));
        return;
      }
    }
    await authClient.signOut();
    await clearLocalData();
    await clearPrivatePageCache();
    clearActiveUserId();
    router.replace(`/${locale}/login`);
    router.refresh();
  };
  const scanReceipt = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size === 0 || file.size > 10 * 1024 * 1024) {
      toast.error(t("receipt.invalidFile"));
      return;
    }
    const toastId = toast.loading(t("receipt.scanning"));
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/ocr/receipt", { method: "POST", body });
      if (response.status === 503) {
        toast.info(t("receipt.notConfigured"), { id: toastId });
        startAdd();
        return;
      }
      if (!response.ok) throw new Error("OCR failed");
      const result = await response.json() as { item: Partial<ItemDraft> };
      setEditingItem(undefined);
      setPresetCostMode(undefined);
      setReceiptPrefill(result.item);
      setAddOpen(true);
      toast.success(t("receipt.ready"), { id: toastId });
    } catch {
      toast.error(t("receipt.failed"), { id: toastId });
    } finally {
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  };

  let content: React.ReactNode;
  if (itemId) content = <ItemDetailPage locale={locale} id={itemId} onEdit={editItem} />;
  else if (["items", "favorites", "archive", "trash"].includes(section)) content = <ItemsPage locale={locale} view={section as ItemsView} onAdd={() => startAdd()} />;
  else if (section === "reminders") content = <RemindersPage locale={locale} />;
  else if (section === "insights") content = <InsightsPage />;
  else if (section === "settings") content = <SettingsPage locale={locale} />;
  else content = <HomePage locale={locale} userName={user.name} onAdd={() => startAdd()} onScanReceipt={() => receiptInputRef.current?.click()} onAddSubscription={() => startAdd("recurring")} />;

  if (!localReady) {
    return <div className="grid min-h-dvh place-items-center bg-background" role="status"><div className="size-7 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>;
  }

  return (
    <>
      <AppShell locale={locale} user={user} onSignOut={() => void signOut()} onAdd={() => startAdd()} onSearch={() => setSearchOpen(true)} pendingCount={pendingCount} online={online}>{content}</AppShell>
      <input ref={receiptInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" hidden onChange={(event) => void scanReceipt(event.target.files?.[0])} />
      <ItemFormSheet open={addOpen || (section === "items" && path[1] === "new")} onOpenChange={(open) => { setAddOpen(open); if (!open && path[1] === "new") router.replace(`/${locale}/app/items`); }} categories={categories} editingItem={editingItem} presetCostMode={presetCostMode} prefill={receiptPrefill} onSaved={(item, addAnother) => { if (!addAnother) router.push(`/${locale}/app/items/${item.id}`); }} />
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="sr-only"><DialogTitle>{t("common.search")}</DialogTitle><DialogDescription>{t("items.searchPlaceholder")}</DialogDescription></DialogHeader>
          <Command>
            <CommandInput placeholder={t("items.searchPlaceholder")} />
            <CommandList>
              <CommandEmpty>{t("items.noResults")}</CommandEmpty>
              <CommandGroup heading={t("nav.items")}>
                {items.slice(0, 50).map((item) => <CommandItem key={item.id} value={`${item.name} ${item.brand ?? ""} ${item.model ?? ""}`} onSelect={() => navigateFromSearch(`/${locale}/app/items/${item.id}`)}><Box />{item.name}<CommandShortcut>{item.currencyCode}</CommandShortcut></CommandItem>)}
              </CommandGroup>
              <CommandGroup heading={t("common.more")}>
                <CommandItem onSelect={() => { setSearchOpen(false); startAdd(); }}><Plus />{t("home.addItem")}<CommandShortcut>N</CommandShortcut></CommandItem>
                <CommandItem onSelect={() => navigateFromSearch(`/${locale}/app/home`)}><Home />{t("nav.home")}</CommandItem>
                <CommandItem onSelect={() => navigateFromSearch(`/${locale}/app/reminders`)}><Bell />{t("nav.reminders")}</CommandItem>
                <CommandItem onSelect={() => navigateFromSearch(`/${locale}/app/insights`)}><BarChart3 />{t("nav.insights")}</CommandItem>
                <CommandItem onSelect={() => navigateFromSearch(`/${locale}/app/settings`)}><Settings />{t("nav.settings")}</CommandItem>
                <CommandItem onSelect={() => setTheme("light")}><Sun />{t("settings.light")}</CommandItem>
                <CommandItem onSelect={() => setTheme("dark")}><Moon />{t("settings.dark")}</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

async function clearPrivatePageCache() {
  if ("caches" in window) await caches.delete("keeply-v2-private");
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
}
