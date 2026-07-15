import { db } from "@/db/local/database";
import type { SyncEntityType } from "@/types/domain";

export function queueSyncOperation(
  entityType: SyncEntityType,
  entityId: string,
  action: "create" | "update" | "delete",
  payload: unknown,
) {
  return db.syncQueue.add({
    id: crypto.randomUUID(),
    entityType,
    entityId,
    action,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}
