import type { PoolClient } from "pg";
import type { Category, Item, ItemExpense, Location, Reminder, UsageEvent } from "@/types/domain";
import { parseSyncPayload, type SyncEntityType, type SyncOperationInput } from "@/lib/validation/sync";

export class SyncConflictError extends Error {
  constructor(message = "The server has a newer version of this record") {
    super(message);
    this.name = "SyncConflictError";
  }
}

export async function applySyncOperation(client: PoolClient, userId: string, operation: SyncOperationInput) {
  const existing = await client.query<{ sequence: string }>(
    "select sequence from public.sync_changes where operation_id = $1 and user_id = $2",
    [operation.id, userId],
  );
  if (existing.rowCount) return Number(existing.rows[0].sequence);

  if (operation.action === "delete") {
    await deleteEntity(client, userId, operation.entityType, operation.entityId);
    return recordChange(client, userId, operation, null);
  }

  const serverTimestamp = new Date().toISOString();
  let payload: Item | ItemExpense | UsageEvent | Reminder | Category | Location;

  switch (operation.entityType) {
    case "item": {
      const item = { ...(parseSyncPayload("item", operation.payload) as Item), userId, updatedAt: serverTimestamp };
      assertMatchingId(operation.entityId, item.id);
      await assertItemReferences(client, userId, item);
      await upsertItem(client, userId, item);
      payload = item;
      break;
    }
    case "expense": {
      const expense = { ...(parseSyncPayload("expense", operation.payload) as ItemExpense), userId, updatedAt: serverTimestamp };
      assertMatchingId(operation.entityId, expense.id);
      await assertOwnedItem(client, userId, expense.itemId);
      await upsertExpense(client, expense);
      payload = expense;
      break;
    }
    case "usage_event": {
      const event = { ...(parseSyncPayload("usage_event", operation.payload) as UsageEvent), userId };
      assertMatchingId(operation.entityId, event.id);
      await assertOwnedItem(client, userId, event.itemId);
      await insertUsageEvent(client, event);
      payload = event;
      break;
    }
    case "reminder": {
      const reminder = { ...(parseSyncPayload("reminder", operation.payload) as Reminder), userId, updatedAt: serverTimestamp };
      assertMatchingId(operation.entityId, reminder.id);
      if (reminder.itemId) await assertOwnedItem(client, userId, reminder.itemId);
      await upsertReminder(client, reminder);
      payload = reminder;
      break;
    }
    case "category": {
      const category = { ...(parseSyncPayload("category", operation.payload) as Category), userId, isSystem: false, updatedAt: serverTimestamp };
      assertMatchingId(operation.entityId, category.id);
      if (category.parentId) await assertOwnedCategory(client, userId, category.parentId);
      await upsertCategory(client, category);
      payload = category;
      break;
    }
    case "location": {
      const location = { ...(parseSyncPayload("location", operation.payload) as Location), userId, updatedAt: serverTimestamp };
      assertMatchingId(operation.entityId, location.id);
      if (location.parentId) await assertOwnedLocation(client, userId, location.parentId);
      await upsertLocation(client, location);
      payload = location;
      break;
    }
  }

  return recordChange(client, userId, operation, payload);
}

function assertMatchingId(envelopeId: string, payloadId: string) {
  if (envelopeId !== payloadId) throw new Error("Sync envelope and payload IDs do not match");
}

async function assertOwnedItem(client: PoolClient, userId: string, itemId: string) {
  const result = await client.query("select 1 from public.items where id = $1 and user_id = $2", [itemId, userId]);
  if (!result.rowCount) throw new Error("Referenced item does not belong to the current user");
}

async function assertOwnedCategory(client: PoolClient, userId: string, categoryId: string) {
  const result = await client.query(
    "select 1 from public.categories where id = $1 and (is_system or user_id = $2)",
    [categoryId, userId],
  );
  if (!result.rowCount) throw new Error("Referenced category is unavailable");
}

async function assertOwnedLocation(client: PoolClient, userId: string, locationId: string) {
  const result = await client.query("select 1 from public.locations where id = $1 and user_id = $2", [locationId, userId]);
  if (!result.rowCount) throw new Error("Referenced location is unavailable");
}

async function assertItemReferences(client: PoolClient, userId: string, item: Item) {
  if (item.categoryId) await assertOwnedCategory(client, userId, item.categoryId);
  if (item.subcategoryId) await assertOwnedCategory(client, userId, item.subcategoryId);
  if (item.locationId) await assertOwnedLocation(client, userId, item.locationId);
}

async function upsertItem(client: PoolClient, userId: string, item: Item) {
  const values = [
    item.id, userId, item.name, item.description ?? null, item.categoryId ?? null, item.subcategoryId ?? null,
    item.locationId ?? null, item.brand ?? null, item.model ?? null, item.serialNumber ?? null, item.iconKey ?? null,
    item.colorKey ?? null, item.costMode, item.priceMode, item.purchaseAmount, item.currencyCode, item.purchaseDate,
    item.quantity, item.quantityUnit ?? null, item.usageCount, item.recurringAmount ?? null, item.recurringInterval ?? null,
    item.recurringIntervalCount ?? null, item.recurringStartDate ?? null, item.recurringEndDate ?? null, item.autoRenew ?? null,
    item.warrantyStartDate ?? null, item.warrantyEndDate ?? null, item.estimatedRetirementDate ?? null, item.actualEndDate ?? null,
    item.status, item.favorite, item.merchant ?? null, item.orderNumber ?? null, item.purchaseUrl ?? null, item.notes ?? null,
    item.version, item.deletedAt ?? null, item.createdAt, item.updatedAt,
  ];
  const result = await client.query(
    `insert into public.items as target (
      id, user_id, name, description, category_id, subcategory_id, location_id, brand, model, serial_number,
      icon_key, color_key, cost_mode, price_mode, purchase_amount, currency_code, purchase_date, quantity,
      quantity_unit, usage_count, recurring_amount, recurring_interval, recurring_interval_count, recurring_start_date,
      recurring_end_date, auto_renew, warranty_start_date, warranty_end_date, estimated_retirement_date, actual_end_date,
      status, favorite, merchant, order_number, purchase_url, notes, version, deleted_at, created_at, updated_at
    ) values (${values.map((_, index) => `$${index + 1}`).join(", ")})
    on conflict (id) do update set
      name = excluded.name, description = excluded.description, category_id = excluded.category_id,
      subcategory_id = excluded.subcategory_id, location_id = excluded.location_id, brand = excluded.brand,
      model = excluded.model, serial_number = excluded.serial_number, icon_key = excluded.icon_key,
      color_key = excluded.color_key, cost_mode = excluded.cost_mode, price_mode = excluded.price_mode,
      purchase_amount = excluded.purchase_amount, currency_code = excluded.currency_code, purchase_date = excluded.purchase_date,
      quantity = excluded.quantity, quantity_unit = excluded.quantity_unit, usage_count = excluded.usage_count,
      recurring_amount = excluded.recurring_amount, recurring_interval = excluded.recurring_interval,
      recurring_interval_count = excluded.recurring_interval_count, recurring_start_date = excluded.recurring_start_date,
      recurring_end_date = excluded.recurring_end_date, auto_renew = excluded.auto_renew,
      warranty_start_date = excluded.warranty_start_date, warranty_end_date = excluded.warranty_end_date,
      estimated_retirement_date = excluded.estimated_retirement_date, actual_end_date = excluded.actual_end_date,
      status = excluded.status, favorite = excluded.favorite, merchant = excluded.merchant,
      order_number = excluded.order_number, purchase_url = excluded.purchase_url, notes = excluded.notes,
      version = excluded.version, deleted_at = excluded.deleted_at, updated_at = excluded.updated_at
    where target.user_id = excluded.user_id and target.version < excluded.version
    returning id`,
    values,
  );
  if (!result.rowCount) throw new SyncConflictError();
}

async function upsertExpense(client: PoolClient, expense: ItemExpense) {
  const result = await client.query(
    `insert into public.item_expenses as target
      (id, user_id, item_id, type, title, amount, occurred_at, notes, created_at, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    on conflict (id) do update set item_id = excluded.item_id, type = excluded.type, title = excluded.title,
      amount = excluded.amount, occurred_at = excluded.occurred_at, notes = excluded.notes, updated_at = excluded.updated_at
    where target.user_id = excluded.user_id
    returning id`,
    [expense.id, expense.userId, expense.itemId, expense.type, expense.title, expense.amount, expense.occurredAt, expense.notes ?? null, expense.createdAt, expense.updatedAt],
  );
  if (!result.rowCount) throw new SyncConflictError("Expense ID is already owned by another user");
}

async function insertUsageEvent(client: PoolClient, event: UsageEvent) {
  const result = await client.query(
    `insert into public.usage_events (id, user_id, item_id, count, occurred_at, notes, created_at)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing returning id`,
    [event.id, event.userId, event.itemId, event.count, event.occurredAt, event.notes ?? null, event.createdAt],
  );
  if (!result.rowCount) throw new SyncConflictError("Usage event already exists");
}

async function upsertReminder(client: PoolClient, reminder: Reminder) {
  const result = await client.query(
    `insert into public.reminders as target
      (id, user_id, item_id, type, title, remind_at, completed, dismissed, created_at, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    on conflict (id) do update set item_id = excluded.item_id, type = excluded.type, title = excluded.title,
      remind_at = excluded.remind_at, completed = excluded.completed, dismissed = excluded.dismissed, updated_at = excluded.updated_at
    where target.user_id = excluded.user_id
    returning id`,
    [reminder.id, reminder.userId, reminder.itemId ?? null, reminder.type, reminder.title, reminder.remindAt, reminder.completed, reminder.dismissed, reminder.createdAt, reminder.updatedAt],
  );
  if (!result.rowCount) throw new SyncConflictError("Reminder ID is already owned by another user");
}

async function upsertCategory(client: PoolClient, category: Category) {
  const result = await client.query(
    `insert into public.categories as target
      (id, user_id, parent_id, key, name_zh, name_en, icon_key, color_key, sort_order, is_system, is_archived, created_at, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11,$12)
    on conflict (id) do update set parent_id = excluded.parent_id, key = excluded.key, name_zh = excluded.name_zh,
      name_en = excluded.name_en, icon_key = excluded.icon_key, color_key = excluded.color_key,
      sort_order = excluded.sort_order, is_archived = excluded.is_archived, updated_at = excluded.updated_at
    where target.user_id = excluded.user_id and not target.is_system
    returning id`,
    [category.id, category.userId, category.parentId ?? null, category.key ?? null, category.nameZh, category.nameEn, category.iconKey, category.colorKey, category.sortOrder, category.isArchived, category.createdAt, category.updatedAt],
  );
  if (!result.rowCount) throw new SyncConflictError("Category ID is unavailable");
}

async function upsertLocation(client: PoolClient, location: Location) {
  const result = await client.query(
    `insert into public.locations as target
      (id, user_id, parent_id, name, icon_key, sort_order, created_at, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8)
    on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name,
      icon_key = excluded.icon_key, sort_order = excluded.sort_order, updated_at = excluded.updated_at
    where target.user_id = excluded.user_id
    returning id`,
    [location.id, location.userId, location.parentId ?? null, location.name, location.iconKey ?? null, location.sortOrder, location.createdAt, location.updatedAt],
  );
  if (!result.rowCount) throw new SyncConflictError("Location ID is unavailable");
}

async function deleteEntity(client: PoolClient, userId: string, entityType: SyncEntityType, entityId: string) {
  const tables: Record<SyncEntityType, string> = {
    item: "items",
    expense: "item_expenses",
    usage_event: "usage_events",
    reminder: "reminders",
    category: "categories",
    location: "locations",
  };
  const systemGuard = entityType === "category" ? " and not is_system" : "";
  await client.query(`delete from public.${tables[entityType]} where id = $1 and user_id = $2${systemGuard}`, [entityId, userId]);
}

async function recordChange(
  client: PoolClient,
  userId: string,
  operation: SyncOperationInput,
  payload: Item | ItemExpense | UsageEvent | Reminder | Category | Location | null,
) {
  const result = await client.query<{ sequence: string }>(
    `insert into public.sync_changes (operation_id, user_id, entity_type, entity_id, action, payload)
     values ($1,$2,$3,$4,$5,$6) returning sequence`,
    [operation.id, userId, operation.entityType, operation.entityId, operation.action, payload ? JSON.stringify(payload) : null],
  );
  return Number(result.rows[0].sequence);
}
