export type Locale = "zh-CN" | "en";

export type ThemePreference = "system" | "light" | "dark";
export type Density = "comfortable" | "compact";
export type AccentTheme = "moss" | "indigo" | "graphite" | "sand";

export type ItemStatus =
  | "active"
  | "stored"
  | "lent"
  | "repairing"
  | "sold"
  | "gifted"
  | "lost"
  | "retired";

export type CostMode = "ownership" | "per_use" | "recurring";
export type PriceMode = "total" | "per_unit";
export type RecurringInterval = "day" | "week" | "month" | "quarter" | "year";
export type ExpenseType =
  | "accessory"
  | "repair"
  | "maintenance"
  | "shipping"
  | "service"
  | "refund"
  | "resale"
  | "other";

export type ReminderType =
  | "warranty"
  | "renewal"
  | "retirement"
  | "maintenance"
  | "return"
  | "custom";

export interface Profile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  locale: Locale | "system";
  defaultCurrency: string;
  theme: ThemePreference;
  density: Density;
  accentTheme: AccentTheme;
  privacyBlurEnabled: boolean;
  appLockEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  userId: string;
  name: string;
  description?: string;
  categoryId?: string;
  subcategoryId?: string;
  locationId?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  coverImage?: Blob;
  coverImageName?: string;
  iconKey?: string;
  colorKey?: string;
  costMode: CostMode;
  priceMode: PriceMode;
  purchaseAmount: string;
  currencyCode: string;
  purchaseDate: string;
  quantity: string;
  quantityUnit?: string;
  usageCount: number;
  recurringAmount?: string;
  recurringInterval?: RecurringInterval;
  recurringIntervalCount?: number;
  recurringStartDate?: string;
  recurringEndDate?: string;
  autoRenew?: boolean;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  estimatedRetirementDate?: string;
  actualEndDate?: string;
  status: ItemStatus;
  favorite: boolean;
  merchant?: string;
  orderNumber?: string;
  purchaseUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  version: number;
}

export interface ItemExpense {
  id: string;
  userId: string;
  itemId: string;
  type: ExpenseType;
  title: string;
  amount: string;
  occurredAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageEvent {
  id: string;
  userId: string;
  itemId: string;
  count: number;
  occurredAt: string;
  notes?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId?: string;
  parentId?: string;
  key?: string;
  nameZh: string;
  nameEn: string;
  iconKey: string;
  colorKey: string;
  sortOrder: number;
  isSystem: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  userId: string;
  parentId?: string;
  name: string;
  iconKey?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  colorKey?: string;
}

export interface Reminder {
  id: string;
  userId: string;
  itemId?: string;
  type: ReminderType;
  title: string;
  remindAt: string;
  completed: boolean;
  dismissed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncOperation {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  action: "create" | "update" | "delete";
  payload: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export type SyncEntityType = "item" | "expense" | "usage_event" | "reminder" | "category" | "location";

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localVersion: unknown;
  remoteVersion: unknown;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CurrencySummary {
  currencyCode: string;
  itemCount: number;
  purchaseTotal: string;
  investedTotal: string;
  netCostTotal: string;
  dailyCostTotal: string;
}

export interface ItemDraft {
  name: string;
  purchaseAmount: string;
  currencyCode: string;
  purchaseDate: string;
  categoryId?: string;
  brand?: string;
  model?: string;
  locationId?: string;
  description?: string;
  notes?: string;
  costMode: CostMode;
  priceMode: PriceMode;
  quantity: string;
  warrantyEndDate?: string;
  estimatedRetirementDate?: string;
  recurringAmount?: string;
  recurringInterval?: RecurringInterval;
  status: ItemStatus;
  favorite: boolean;
}
