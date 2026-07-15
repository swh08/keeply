import { get, set } from "idb-keyval";
import { db } from "@/db/local/database";
import { getActiveUserId } from "@/db/local/active-user";
import { pullSyncResponseSchema, pushSyncResponseSchema } from "@/lib/validation/sync";
import type { SyncOperation } from "@/types/domain";

let activeSync: Promise<{ synced: number; failed: number }> | null = null;

export function runSync() {
  if (activeSync) return activeSync;
  activeSync = performSync().finally(() => { activeSync = null; });
  return activeSync;
}

async function performSync() {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  const userId = getActiveUserId();
  const operations = await db.syncQueue.orderBy("createdAt").limit(100).toArray();
  let synced = 0;
  let failed = 0;

  if (operations.length) {
    const result = await pushOperations(operations);
    await db.transaction("rw", db.syncQueue, db.syncConflicts, async () => {
      if (result.accepted.length) await db.syncQueue.bulkDelete(result.accepted);
      for (const failure of result.failed) {
        const operation = operations.find((entry) => entry.id === failure.id);
        if (!operation) continue;
        await db.syncQueue.update(operation.id, { retryCount: operation.retryCount + 1, lastError: failure.message });
        if (failure.code === "CONFLICT") {
          await db.syncConflicts.put({
            id: crypto.randomUUID(),
            entityType: operation.entityType,
            entityId: operation.entityId,
            localVersion: operation.payload,
            remoteVersion: { message: failure.message },
            createdAt: new Date().toISOString(),
          });
        }
      }
    });
    synced += result.accepted.length;
    failed += result.failed.length;
  }

  await pullChanges(userId);
  return { synced, failed };
}

async function pushOperations(operations: SyncOperation[]) {
  const response = await fetch("/api/sync/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operations }),
  });
  if (!response.ok) throw new Error(`Sync push failed with status ${response.status}`);
  return pushSyncResponseSchema.parse(await response.json());
}

async function pullChanges(userId: string) {
  const cursorKey = `keeply:sync-cursor:${userId}`;
  let cursor = await get<number>(cursorKey) ?? 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/api/sync/pull?cursor=${cursor}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Sync pull failed with status ${response.status}`);
    const batch = pullSyncResponseSchema.parse(await response.json());
    await applyChanges(batch.changes);
    cursor = batch.cursor;
    hasMore = batch.hasMore;
    await set(cursorKey, cursor);
  }
}

async function applyChanges(changes: Array<{
  entityType: "item" | "expense" | "usage_event" | "reminder" | "category" | "location";
  entityId: string;
  action: "create" | "update" | "delete";
  payload: unknown | null;
}>) {
  if (!changes.length) return;
  await db.transaction(
    "rw",
    [db.items, db.expenses, db.usageEvents, db.reminders, db.categories, db.locations],
    async () => {
      for (const change of changes) {
        if (change.action === "delete") {
          await deleteLocalEntity(change.entityType, change.entityId);
          continue;
        }
        if (!change.payload || typeof change.payload !== "object") throw new Error("Invalid sync payload");
        await putLocalEntity(change.entityType, change.entityId, change.payload as Record<string, unknown>);
      }
    },
  );
}

async function putLocalEntity(entityType: string, entityId: string, payload: Record<string, unknown>) {
  if (entityType === "item") {
    const existing = await db.items.get(entityId);
    await db.items.put({ ...existing, ...payload, id: entityId } as never);
  } else if (entityType === "expense") await db.expenses.put({ ...payload, id: entityId } as never);
  else if (entityType === "usage_event") await db.usageEvents.put({ ...payload, id: entityId } as never);
  else if (entityType === "reminder") await db.reminders.put({ ...payload, id: entityId } as never);
  else if (entityType === "category") await db.categories.put({ ...payload, id: entityId } as never);
  else if (entityType === "location") await db.locations.put({ ...payload, id: entityId } as never);
}

async function deleteLocalEntity(entityType: string, entityId: string) {
  if (entityType === "item") {
    await db.expenses.where("itemId").equals(entityId).delete();
    await db.usageEvents.where("itemId").equals(entityId).delete();
    await db.reminders.where("itemId").equals(entityId).delete();
    await db.items.delete(entityId);
  } else if (entityType === "expense") await db.expenses.delete(entityId);
  else if (entityType === "usage_event") await db.usageEvents.delete(entityId);
  else if (entityType === "reminder") await db.reminders.delete(entityId);
  else if (entityType === "category") await db.categories.delete(entityId);
  else if (entityType === "location") await db.locations.delete(entityId);
}
