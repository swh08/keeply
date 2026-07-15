import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

const moneyValue = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d+)?$/.test(value));

const receiptResult = z.object({
  name: z.string().trim().max(200).optional(),
  purchaseAmount: moneyValue.optional(),
  currencyCode: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  brand: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2_000).optional(),
}).strip();

export async function POST(request: Request) {
  if (process.env.OCR_PROVIDER !== "http-json") {
    return NextResponse.json({ code: "OCR_NOT_CONFIGURED" }, { status: 503 });
  }

  const endpoint = parseEndpoint(process.env.OCR_API_URL);
  if (!endpoint) return NextResponse.json({ code: "OCR_CONFIGURATION_INVALID" }, { status: 500 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size === 0 || file.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ code: "INVALID_RECEIPT" }, { status: 400 });
  }

  const providerForm = new FormData();
  providerForm.set("file", file, file.name || "receipt");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: process.env.OCR_API_KEY ? { Authorization: `Bearer ${process.env.OCR_API_KEY}` } : undefined,
      body: providerForm,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return NextResponse.json({ code: "OCR_PROVIDER_FAILED" }, { status: 502 });

    const text = await response.text();
    if (text.length > MAX_PROVIDER_RESPONSE_BYTES) return NextResponse.json({ code: "OCR_RESPONSE_TOO_LARGE" }, { status: 502 });
    const raw = JSON.parse(text) as { item?: unknown; data?: unknown } | unknown;
    const candidate = typeof raw === "object" && raw !== null && "item" in raw
      ? raw.item
      : typeof raw === "object" && raw !== null && "data" in raw
        ? raw.data
        : raw;
    const parsed = receiptResult.safeParse(candidate);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ code: "OCR_RESPONSE_INVALID" }, { status: 502 });
    }
    return NextResponse.json({ item: parsed.data });
  } catch {
    return NextResponse.json({ code: "OCR_PROVIDER_UNAVAILABLE" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function parseEndpoint(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}
