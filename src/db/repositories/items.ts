import { db } from "@/db/local/database";
import { getActiveUserId } from "@/db/local/active-user";
import { queueSyncOperation } from "@/db/repositories/sync-queue";
import type { Item, ItemDraft, ItemStatus } from "@/types/domain";

async function audit(action: string, entityId: string, metadata?: Record<string, unknown>) {
  await db.auditLogs.add({
    id: crypto.randomUUID(),
    userId: getActiveUserId(),
    action,
    entityType: "item",
    entityId,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

export async function createItem(draft: ItemDraft): Promise<Item> {
  const timestamp = new Date().toISOString();
  const item: Item = {
    id: crypto.randomUUID(),
    userId: getActiveUserId(),
    ...draft,
    usageCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  await db.transaction("rw", db.items, db.syncQueue, db.auditLogs, async () => {
    await db.items.add(item);
    await queueSyncOperation("item", item.id, "create", item);
    await audit("item.created", item.id);
  });
  return item;
}

export async function updateItem(id: string, changes: Partial<Item>): Promise<Item> {
  const existing = await db.items.get(id);
  if (!existing) throw new Error("Item not found");
  const item: Item = {
    ...existing,
    ...changes,
    id,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  };
  await db.transaction("rw", db.items, db.syncQueue, db.auditLogs, async () => {
    await db.items.put(item);
    await queueSyncOperation("item", id, "update", item);
    await audit("item.updated", id, changes);
  });
  return item;
}

export async function changeItemCurrency(id: string, currencyCode: string): Promise<Item> {
  const existing = await db.items.get(id);
  if (!existing) throw new Error("Item not found");
  const updated = await updateItem(id, { currencyCode });
  await audit("item.currency_changed", id, {
    from: existing.currencyCode,
    to: currencyCode,
    amount: existing.purchaseAmount,
  });
  return updated;
}

export async function setItemStatus(
  id: string,
  status: ItemStatus,
  actualEndDate?: string,
): Promise<Item> {
  const terminal = ["sold", "gifted", "lost", "retired"].includes(status);
  return updateItem(id, { status, actualEndDate: terminal ? actualEndDate : undefined });
}

export async function moveItemToTrash(id: string): Promise<Item> {
  return updateItem(id, { deletedAt: new Date().toISOString() });
}

export async function restoreItem(id: string): Promise<Item> {
  return updateItem(id, { deletedAt: undefined });
}

export async function permanentlyDeleteItem(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.items, db.expenses, db.usageEvents, db.reminders, db.syncQueue, db.auditLogs],
    async () => {
      await db.expenses.where("itemId").equals(id).delete();
      await db.usageEvents.where("itemId").equals(id).delete();
      await db.reminders.where("itemId").equals(id).delete();
      await db.items.delete(id);
      await queueSyncOperation("item", id, "delete", { id });
      await audit("item.deleted_permanently", id);
    },
  );
}

export async function purgeExpiredTrash(retentionDays = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const ids = await db.items.where("deletedAt").belowOrEqual(cutoff.toISOString()).primaryKeys();
  for (const id of ids) await permanentlyDeleteItem(id);
  return ids.length;
}

export async function duplicateItem(id: string): Promise<Item> {
  const existing = await db.items.get(id);
  if (!existing) throw new Error("Item not found");
  return createItem({
    name: `${existing.name} · 副本`,
    purchaseAmount: existing.purchaseAmount,
    currencyCode: existing.currencyCode,
    purchaseDate: existing.purchaseDate,
    categoryId: existing.categoryId,
    brand: existing.brand,
    model: existing.model,
    locationId: existing.locationId,
    description: existing.description,
    notes: existing.notes,
    costMode: existing.costMode,
    priceMode: existing.priceMode,
    quantity: existing.quantity,
    warrantyEndDate: existing.warrantyEndDate,
    estimatedRetirementDate: existing.estimatedRetirementDate,
    recurringAmount: existing.recurringAmount,
    recurringInterval: existing.recurringInterval,
    status: "active",
    favorite: false,
  });
}
