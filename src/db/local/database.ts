import Dexie, { type EntityTable } from "dexie";
import type {
  AuditLog,
  Category,
  Item,
  ItemExpense,
  Location,
  Profile,
  Reminder,
  SyncOperation,
  SyncConflict,
  Tag,
  UsageEvent,
} from "@/types/domain";

const now = new Date().toISOString();
const systemCategories: Category[] = [
  ["digital", "数码电子", "Electronics", "Laptop"],
  ["appliance", "家用电器", "Appliances", "Refrigerator"],
  ["furniture", "家具家居", "Furniture", "Armchair"],
  ["clothing", "服饰", "Clothing", "Shirt"],
  ["accessories", "配饰", "Accessories", "Watch"],
  ["beauty", "美妆护理", "Beauty & Care", "Sparkles"],
  ["sports", "运动健身", "Sports & Fitness", "Dumbbell"],
  ["transport", "交通出行", "Transport", "Car"],
  ["tools", "工具设备", "Tools", "Wrench"],
  ["books", "图书资料", "Books", "BookOpen"],
  ["music", "乐器音频", "Music", "Music"],
  ["gaming", "游戏娱乐", "Gaming", "Gamepad2"],
  ["kitchen", "厨房用品", "Kitchen", "CookingPot"],
  ["outdoor", "户外旅行", "Outdoor & Travel", "TentTree"],
  ["pet", "宠物用品", "Pet Supplies", "PawPrint"],
  ["collectibles", "收藏品", "Collectibles", "Gem"],
  ["subscriptions", "订阅服务", "Subscriptions", "RefreshCw"],
  ["office", "办公用品", "Office", "BriefcaseBusiness"],
  ["other", "其他", "Other", "Package"],
].map(([key, nameZh, nameEn, iconKey], sortOrder) => ({
  id: `00000000-0000-4000-8000-${String(sortOrder + 1).padStart(12, "0")}`,
  key,
  nameZh,
  nameEn,
  iconKey,
  colorKey: "moss",
  sortOrder,
  isSystem: true,
  isArchived: false,
  createdAt: now,
  updatedAt: now,
}));

class KeeplyDatabase extends Dexie {
  profiles!: EntityTable<Profile, "id">;
  items!: EntityTable<Item, "id">;
  expenses!: EntityTable<ItemExpense, "id">;
  usageEvents!: EntityTable<UsageEvent, "id">;
  categories!: EntityTable<Category, "id">;
  locations!: EntityTable<Location, "id">;
  tags!: EntityTable<Tag, "id">;
  reminders!: EntityTable<Reminder, "id">;
  syncQueue!: EntityTable<SyncOperation, "id">;
  syncConflicts!: EntityTable<SyncConflict, "id">;
  auditLogs!: EntityTable<AuditLog, "id">;

  constructor() {
    super("keeply");
    this.version(1).stores({
      profiles: "id, email, updatedAt",
      items:
        "id, userId, name, categoryId, locationId, status, currencyCode, purchaseDate, favorite, updatedAt, deletedAt, [userId+status], [userId+currencyCode]",
      expenses: "id, userId, itemId, occurredAt, [itemId+occurredAt]",
      usageEvents: "id, userId, itemId, occurredAt, [itemId+occurredAt]",
      categories: "id, userId, key, parentId, sortOrder, isArchived",
      locations: "id, userId, parentId, sortOrder",
      tags: "id, userId, &name",
      reminders: "id, userId, itemId, remindAt, completed, dismissed",
      syncQueue: "id, entityType, entityId, createdAt, retryCount",
      auditLogs: "id, userId, entityType, entityId, action, createdAt",
    });
    this.version(2).stores({
      profiles: "id, email, updatedAt",
      items: "id, userId, name, categoryId, locationId, status, currencyCode, purchaseDate, favorite, updatedAt, deletedAt, [userId+status], [userId+currencyCode]",
      expenses: "id, userId, itemId, occurredAt, [itemId+occurredAt]",
      usageEvents: "id, userId, itemId, occurredAt, [itemId+occurredAt]",
      categories: "id, userId, key, parentId, sortOrder, isArchived",
      locations: "id, userId, parentId, sortOrder",
      tags: "id, userId, &name",
      reminders: "id, userId, itemId, remindAt, completed, dismissed",
      syncQueue: "id, entityType, entityId, createdAt, retryCount",
      syncConflicts: "id, entityType, entityId, createdAt, resolvedAt",
      auditLogs: "id, userId, entityType, entityId, action, createdAt",
    });
    this.on("populate", () => this.categories.bulkAdd(systemCategories));
  }
}

export const db = new KeeplyDatabase();

export async function clearLocalData() {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.categories.bulkAdd(systemCategories);
  });
}
