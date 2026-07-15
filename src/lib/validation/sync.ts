import { z } from "zod";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const decimal = z.string().regex(/^\d+(?:\.\d{1,6})?$/);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();

export const syncEntityTypeSchema = z.enum(["item", "expense", "usage_event", "reminder", "category", "location"]);
export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;

export const syncOperationSchema = z.object({
  id: uuid,
  entityType: syncEntityTypeSchema,
  entityId: uuid,
  action: z.enum(["create", "update", "delete"]),
  payload: z.unknown(),
  createdAt: timestamp,
  retryCount: z.number().int().min(0).max(100),
}).strict();
export type SyncOperationInput = z.infer<typeof syncOperationSchema>;

export const pushSyncSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(100),
}).strict();

export const pushSyncResponseSchema = z.object({
  accepted: z.array(uuid),
  failed: z.array(z.object({ id: uuid, code: z.string(), message: z.string() })),
  cursor: z.number().int().min(0),
});

export const pullSyncResponseSchema = z.object({
  changes: z.array(z.object({
    sequence: z.number().int().positive(),
    entityType: syncEntityTypeSchema,
    entityId: uuid,
    action: z.enum(["create", "update", "delete"]),
    payload: z.unknown().nullable(),
  })),
  cursor: z.number().int().min(0),
  hasMore: z.boolean(),
});

const itemSchema = z.object({
  id: uuid,
  userId: z.string().optional(),
  name: z.string().trim().min(1).max(200),
  description: optionalText(10_000),
  categoryId: uuid.optional(),
  subcategoryId: uuid.optional(),
  locationId: uuid.optional(),
  brand: optionalText(120),
  model: optionalText(120),
  serialNumber: optionalText(200),
  coverImageName: optionalText(255),
  iconKey: optionalText(80),
  colorKey: optionalText(80),
  costMode: z.enum(["ownership", "per_use", "recurring"]),
  priceMode: z.enum(["total", "per_unit"]),
  purchaseAmount: decimal,
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  purchaseDate: date,
  quantity: decimal.refine((value) => Number(value) > 0),
  quantityUnit: optionalText(40),
  usageCount: z.number().int().min(0),
  recurringAmount: decimal.optional(),
  recurringInterval: z.enum(["day", "week", "month", "quarter", "year"]).optional(),
  recurringIntervalCount: z.number().int().positive().optional(),
  recurringStartDate: date.optional(),
  recurringEndDate: date.optional(),
  autoRenew: z.boolean().optional(),
  warrantyStartDate: date.optional(),
  warrantyEndDate: date.optional(),
  estimatedRetirementDate: date.optional(),
  actualEndDate: date.optional(),
  status: z.enum(["active", "stored", "lent", "repairing", "sold", "gifted", "lost", "retired"]),
  favorite: z.boolean(),
  merchant: optionalText(200),
  orderNumber: optionalText(200),
  purchaseUrl: z.string().url().max(2_000).optional(),
  notes: optionalText(20_000),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.optional(),
  version: z.number().int().positive(),
}).strip();

const expenseSchema = z.object({
  id: uuid,
  userId: z.string().optional(),
  itemId: uuid,
  type: z.enum(["accessory", "repair", "maintenance", "shipping", "service", "refund", "resale", "other"]),
  title: z.string().trim().min(1).max(200),
  amount: decimal,
  occurredAt: date,
  notes: optionalText(5_000),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strip();

const usageEventSchema = z.object({
  id: uuid,
  userId: z.string().optional(),
  itemId: uuid,
  count: z.number().int().positive(),
  occurredAt: timestamp,
  notes: optionalText(5_000),
  createdAt: timestamp,
}).strip();

const reminderSchema = z.object({
  id: uuid,
  userId: z.string().optional(),
  itemId: uuid.optional(),
  type: z.enum(["warranty", "renewal", "retirement", "maintenance", "return", "custom"]),
  title: z.string().trim().min(1).max(200),
  remindAt: timestamp,
  completed: z.boolean(),
  dismissed: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strip();

const categorySchema = z.object({
  id: uuid,
  userId: z.string().optional(),
  parentId: uuid.optional(),
  key: optionalText(80),
  nameZh: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  iconKey: z.string().trim().min(1).max(80),
  colorKey: z.string().trim().min(1).max(80),
  sortOrder: z.number().int(),
  isSystem: z.boolean(),
  isArchived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strip();

const locationSchema = z.object({
  id: uuid,
  userId: z.string().optional(),
  parentId: uuid.optional(),
  name: z.string().trim().min(1).max(160),
  iconKey: optionalText(80),
  sortOrder: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strip();

const payloadSchemas = {
  item: itemSchema,
  expense: expenseSchema,
  usage_event: usageEventSchema,
  reminder: reminderSchema,
  category: categorySchema,
  location: locationSchema,
} as const;

export function parseSyncPayload(entityType: SyncEntityType, payload: unknown) {
  return payloadSchemas[entityType].parse(payload);
}
