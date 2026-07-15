import JSZip from "jszip";
import Papa from "papaparse";
import { db } from "@/db/local/database";
import { getActiveUserId } from "@/db/local/active-user";
import type { Item } from "@/types/domain";

const SCHEMA_VERSION = 1;

async function snapshot() {
  const [profiles, items, expenses, usageEvents, categories, locations, tags, reminders, auditLogs] = await Promise.all([
    db.profiles.toArray(),
    db.items.toArray(),
    db.expenses.toArray(),
    db.usageEvents.toArray(),
    db.categories.toArray(),
    db.locations.toArray(),
    db.tags.toArray(),
    db.reminders.toArray(),
    db.auditLogs.toArray(),
  ]);
  return { profiles, items, expenses, usageEvents, categories, locations, tags, reminders, auditLogs };
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function exportKeeply(format: "json" | "csv" | "xlsx" | "zip") {
  const data = await snapshot();
  if (format === "json") {
    download(new Blob([JSON.stringify({ schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" }), `keeply-${dateStamp()}.json`);
    return;
  }
  if (format === "csv") {
    download(new Blob([Papa.unparse(data.items)], { type: "text/csv;charset=utf-8" }), `keeply-items-${dateStamp()}.csv`);
    return;
  }
  if (format === "xlsx") {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    appendWorksheet(workbook, "Items", data.items);
    appendWorksheet(workbook, "Expenses", data.expenses);
    appendWorksheet(workbook, "Reminders", data.reminders);
    const buffer = await workbook.xlsx.writeBuffer();
    download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `keeply-${dateStamp()}.xlsx`);
    return;
  }
  const zip = new JSZip();
  const manifest = {
    app: "Keeply",
    version: "0.1.0",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    locale: document.documentElement.lang,
    counts: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length])),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("profile.json", JSON.stringify(data.profiles, null, 2));
  zip.file("items.json", JSON.stringify(data.items, null, 2));
  zip.file("expenses.json", JSON.stringify(data.expenses, null, 2));
  zip.file("usage-events.json", JSON.stringify(data.usageEvents, null, 2));
  zip.file("categories.json", JSON.stringify(data.categories, null, 2));
  zip.file("locations.json", JSON.stringify(data.locations, null, 2));
  zip.file("tags.json", JSON.stringify(data.tags, null, 2));
  zip.file("reminders.json", JSON.stringify(data.reminders, null, 2));
  zip.file("audit-logs.json", JSON.stringify(data.auditLogs, null, 2));
  download(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), `keeply-backup-${dateStamp()}.zip`);
}

function normalizeImportedItem(input: Partial<Item>): Item {
  if (!input.name || input.purchaseAmount === undefined || !input.currencyCode || !input.purchaseDate) throw new Error("Invalid item row");
  const timestamp = new Date().toISOString();
  return {
    ...input,
    id: input.id || crypto.randomUUID(),
    userId: getActiveUserId(),
    name: String(input.name),
    purchaseAmount: String(input.purchaseAmount),
    currencyCode: String(input.currencyCode).toUpperCase(),
    purchaseDate: String(input.purchaseDate).slice(0, 10),
    quantity: String(input.quantity ?? "1"),
    priceMode: input.priceMode ?? "total",
    costMode: input.costMode ?? "ownership",
    usageCount: Number.isInteger(input.usageCount) ? input.usageCount! : 0,
    status: input.status ?? "active",
    favorite: Boolean(input.favorite),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
    version: (input.version ?? 0) + 1,
  };
}

async function importItems(rows: Partial<Item>[]) {
  const existingIds = new Set(await db.items.toCollection().primaryKeys());
  const normalized = rows.map(normalizeImportedItem).filter((item) => !existingIds.has(item.id));
  await db.items.bulkPut(normalized);
  await db.syncQueue.bulkAdd(normalized.map((item) => ({ id: crypto.randomUUID(), entityType: "item", entityId: item.id, action: "create" as const, payload: item, createdAt: new Date().toISOString(), retryCount: 0 })));
  return normalized.length;
}

export async function importKeeply(file: File): Promise<number> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    const result = Papa.parse<Partial<Item>>(await file.text(), { header: true, skipEmptyLines: true });
    if (result.errors.length) throw new Error(result.errors[0].message);
    return importItems(result.data);
  }
  if (extension === "xlsx" || extension === "xls") {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("Workbook has no sheets");
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, column) => { headers[column] = cellToString(cell.value); });
    const rows: Partial<Item>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      for (let column = 1; column < headers.length; column += 1) {
        if (headers[column]) record[headers[column]] = cellToString(row.getCell(column).value);
      }
      rows.push(record as Partial<Item>);
    });
    return importItems(rows);
  }
  if (extension === "zip") {
    const zip = await JSZip.loadAsync(file);
    const manifestFile = zip.file("manifest.json");
    const itemsFile = zip.file("items.json");
    if (!manifestFile || !itemsFile) throw new Error("Invalid Keeply backup");
    const manifest = JSON.parse(await manifestFile.async("text")) as { schemaVersion?: number };
    if (manifest.schemaVersion !== SCHEMA_VERSION) throw new Error("Unsupported backup schema");
    return importItems(JSON.parse(await itemsFile.async("text")) as Partial<Item>[]);
  }
  const parsed = JSON.parse(await file.text()) as { schemaVersion?: number; items?: Partial<Item>[] } | Partial<Item>[];
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!items) throw new Error("Invalid JSON export");
  return importItems(items);
}

function appendWorksheet<T extends object>(workbook: import("exceljs").Workbook, name: string, rows: T[]) {
  const sheet = workbook.addWorksheet(name);
  const keys = Object.keys(rows[0] ?? {});
  sheet.columns = keys.map((key) => ({ header: key, key, width: Math.min(40, Math.max(12, key.length + 2)) }));
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    sheet.addRow(Object.fromEntries(keys.map((key) => [key, excelValue(record[key])])));
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = keys.length ? { from: "A1", to: { row: 1, column: keys.length } } : undefined;
}

function excelValue(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) return value;
  return JSON.stringify(value);
}

function cellToString(value: import("exceljs").CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return String(value.result);
    if ("text" in value) return String(value.text);
    if ("richText" in value) return value.richText.map((entry) => entry.text).join("");
    return JSON.stringify(value);
  }
  return String(value);
}
