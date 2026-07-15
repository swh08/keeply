import { db } from "@/db/local/database";
import { getActiveUserId } from "@/db/local/active-user";
import { queueSyncOperation } from "@/db/repositories/sync-queue";
import { updateItem } from "@/db/repositories/items";
import type { ExpenseType, ReminderType } from "@/types/domain";

export async function addExpense(input: {
  itemId: string;
  type: ExpenseType;
  title: string;
  amount: string;
  occurredAt: string;
  notes?: string;
}) {
  const timestamp = new Date().toISOString();
  const expense = {
    id: crypto.randomUUID(),
    userId: getActiveUserId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.expenses.add(expense);
  await queueSyncOperation("expense", expense.id, "create", expense);
  return expense;
}

export async function recordUsage(itemId: string, count = 1, notes?: string) {
  const item = await db.items.get(itemId);
  if (!item) throw new Error("Item not found");
  const event = {
    id: crypto.randomUUID(),
    userId: getActiveUserId(),
    itemId,
    count,
    occurredAt: new Date().toISOString(),
    notes,
    createdAt: new Date().toISOString(),
  };
  await db.usageEvents.add(event);
  await queueSyncOperation("usage_event", event.id, "create", event);
  await updateItem(itemId, { usageCount: item.usageCount + count });
  return event;
}

export async function createReminder(input: {
  itemId?: string;
  type: ReminderType;
  title: string;
  remindAt: string;
}) {
  const timestamp = new Date().toISOString();
  const reminder = {
    id: crypto.randomUUID(),
    userId: getActiveUserId(),
    ...input,
    completed: false,
    dismissed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.reminders.add(reminder);
  await queueSyncOperation("reminder", reminder.id, "create", reminder);
  return reminder;
}

export async function toggleReminder(id: string, completed: boolean) {
  const updatedAt = new Date().toISOString();
  await db.reminders.update(id, { completed, updatedAt });
  const reminder = await db.reminders.get(id);
  if (reminder) await queueSyncOperation("reminder", id, "update", reminder);
}
