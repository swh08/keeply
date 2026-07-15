import { db } from "@/db/local/database";
import { getActiveUserId } from "@/db/local/active-user";
import { queueSyncOperation } from "@/db/repositories/sync-queue";
import type { Category, Location } from "@/types/domain";

export async function createCategory(name: string, sortOrder: number) {
  const timestamp = new Date().toISOString();
  const category: Category = {
    id: crypto.randomUUID(),
    userId: getActiveUserId(),
    nameZh: name,
    nameEn: name,
    iconKey: "Package",
    colorKey: "moss",
    sortOrder,
    isSystem: false,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.transaction("rw", db.categories, db.syncQueue, async () => {
    await db.categories.add(category);
    await queueSyncOperation("category", category.id, "create", category);
  });
  return category;
}

export async function setCategoryArchived(id: string, isArchived: boolean) {
  const category = await db.categories.get(id);
  if (!category) return;
  const updated = { ...category, isArchived, updatedAt: new Date().toISOString() };
  await db.transaction("rw", db.categories, db.syncQueue, async () => {
    await db.categories.put(updated);
    if (!updated.isSystem) await queueSyncOperation("category", id, "update", updated);
  });
}

export async function createLocation(name: string, sortOrder: number) {
  const timestamp = new Date().toISOString();
  const location: Location = {
    id: crypto.randomUUID(),
    userId: getActiveUserId(),
    name,
    iconKey: "MapPin",
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.transaction("rw", db.locations, db.syncQueue, async () => {
    await db.locations.add(location);
    await queueSyncOperation("location", location.id, "create", location);
  });
  return location;
}
