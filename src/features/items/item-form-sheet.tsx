"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { del, get, set } from "idb-keyval";
import { ChevronDown, Save } from "lucide-react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import { createItem, updateItem } from "@/db/repositories/items";
import { todayLocal } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import type { Category, Item, ItemDraft } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const currencyOptions = ["CNY", "AUD", "USD", "EUR", "GBP", "JPY", "HKD", "SGD", "CAD", "NZD", "KRW", "TWD", "CHF", "INR", "THB", "MYR"];

const schema = z.object({
  name: z.string().trim().min(1),
  purchaseAmount: z.string().refine((value) => {
    try {
      return parseMoney(value).gte(0);
    } catch {
      return false;
    }
  }),
  currencyCode: z.string().length(3),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  locationId: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  costMode: z.enum(["ownership", "per_use", "recurring"]),
  priceMode: z.enum(["total", "per_unit"]),
  quantity: z.string().refine((value) => {
    try {
      return parseMoney(value).gt(0);
    } catch {
      return false;
    }
  }),
  warrantyEndDate: z.string().optional(),
  estimatedRetirementDate: z.string().optional(),
  recurringAmount: z.string().optional(),
  recurringInterval: z.enum(["day", "week", "month", "quarter", "year"]).optional(),
  status: z.enum(["active", "stored", "lent", "repairing", "sold", "gifted", "lost", "retired"]),
  favorite: z.boolean(),
});

const defaultValues: ItemDraft = {
  name: "",
  purchaseAmount: "",
  currencyCode: "AUD",
  purchaseDate: todayLocal(),
  categoryId: "00000000-0000-4000-8000-000000000001",
  costMode: "ownership",
  priceMode: "total",
  quantity: "1",
  status: "active",
  favorite: false,
};

function itemToDraft(item: Item): ItemDraft {
  return {
    name: item.name,
    purchaseAmount: item.purchaseAmount,
    currencyCode: item.currencyCode,
    purchaseDate: item.purchaseDate,
    categoryId: item.categoryId,
    brand: item.brand,
    model: item.model,
    locationId: item.locationId,
    description: item.description,
    notes: item.notes,
    costMode: item.costMode,
    priceMode: item.priceMode,
    quantity: item.quantity,
    warrantyEndDate: item.warrantyEndDate,
    estimatedRetirementDate: item.estimatedRetirementDate,
    recurringAmount: item.recurringAmount,
    recurringInterval: item.recurringInterval,
    status: item.status,
    favorite: item.favorite,
  };
}

export function ItemFormSheet({
  open,
  onOpenChange,
  categories,
  editingItem,
  presetCostMode,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  editingItem?: Item;
  presetCostMode?: ItemDraft["costMode"];
  prefill?: Partial<ItemDraft>;
  onSaved: (item: Item, addAnother?: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [advanced, setAdvanced] = useState(false);
  const draftKey = "keeply:new-item-draft:v1";
  const initialValues = useMemo(
    () => editingItem ? itemToDraft(editingItem) : { ...defaultValues, ...prefill, costMode: prefill?.costMode ?? presetCostMode ?? "ownership" },
    [editingItem, prefill, presetCostMode],
  );
  const form = useForm<ItemDraft>({ resolver: zodResolver(schema as never) as Resolver<ItemDraft>, defaultValues: initialValues });

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      form.reset(itemToDraft(editingItem));
      setAdvanced(true);
      return;
    }
    if (prefill) {
      form.reset(initialValues);
      setAdvanced(Boolean(prefill.brand || prefill.model || prefill.notes));
      return;
    }
    Promise.all([get<ItemDraft>(draftKey), get<string>("keeply:default-currency")]).then(([draft, defaultCurrency]) => {
      form.reset(draft ? { ...initialValues, ...draft } : { ...initialValues, currencyCode: defaultCurrency ?? initialValues.currencyCode });
    }).catch(() => form.reset(initialValues));
  }, [editingItem, form, initialValues, open, prefill]);

  useEffect(() => {
    if (!open || editingItem) return;
    // React Hook Form intentionally exposes an imperative subscription API.
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = form.watch((value) => {
      void set(draftKey, value);
    });
    return () => subscription.unsubscribe();
  }, [editingItem, form, open]);

  const submit = form.handleSubmit(async (values, event) => {
    const submitter = (event?.nativeEvent as SubmitEvent | undefined)?.submitter as HTMLButtonElement | null;
    const addAnother = submitter?.value === "continue";
    try {
      const item = editingItem
        ? await updateItem(editingItem.id, values)
        : await createItem(values);
      await del(draftKey);
      toast.success(editingItem ? t("form.updated") : t("form.saved"));
      if (addAnother) {
        form.reset({ ...defaultValues, currencyCode: values.currencyCode, purchaseDate: todayLocal() });
        setAdvanced(false);
      } else {
        onOpenChange(false);
      }
      onSaved(item, addAnother);
    } catch {
      toast.error(t("errors.generic"), { description: t("errors.dataSafe") });
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:w-full data-[side=right]:overflow-y-auto data-[side=right]:sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>{editingItem ? t("form.editTitle") : t("form.newTitle")}</SheetTitle>
          <SheetDescription>{t("form.quickDescription")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex flex-1 flex-col px-4 pb-6 sm:px-6">
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.name)}>
              <FieldLabel htmlFor="item-name">{t("form.name")}</FieldLabel>
              <Input id="item-name" autoFocus autoComplete="off" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
              <FieldError>{form.formState.errors.name ? t("form.required") : null}</FieldError>
            </Field>

            <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-3">
              <Field data-invalid={Boolean(form.formState.errors.purchaseAmount)}>
                <FieldLabel htmlFor="item-amount">{t("form.amount")}</FieldLabel>
                <Input id="item-amount" inputMode="decimal" aria-invalid={Boolean(form.formState.errors.purchaseAmount)} {...form.register("purchaseAmount")} />
                <FieldError>{form.formState.errors.purchaseAmount ? t("form.invalidAmount") : null}</FieldError>
              </Field>
              <Controller
                control={form.control}
                name="currencyCode"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>{t("form.currency")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label={t("form.currency")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {currencyOptions.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="purchase-date">{t("form.purchaseDate")}</FieldLabel>
                <Input id="purchase-date" type="date" {...form.register("purchaseDate")} />
              </Field>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>{t("form.category")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label={t("form.category")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {categories.filter((category) => !category.isArchived).map((category) => (
                            <SelectItem key={category.id} value={category.id}>{locale === "zh-CN" ? category.nameZh : category.nameEn}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <Controller
              control={form.control}
              name="costMode"
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("form.costMode")}</FieldLabel>
                  <ToggleGroup type="single" value={field.value} onValueChange={(value) => value && field.onChange(value)} variant="outline" className="w-full">
                    <ToggleGroupItem value="ownership" className="flex-1">{t("form.ownership")}</ToggleGroupItem>
                    <ToggleGroupItem value="per_use" className="flex-1">{t("form.perUse")}</ToggleGroupItem>
                    <ToggleGroupItem value="recurring" className="flex-1">{t("form.recurring")}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              )}
            />

            <button type="button" className="flex min-h-11 items-center justify-between rounded-lg border px-3 text-sm font-medium" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}>
              {t("form.advanced")}
              <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${advanced ? "rotate-180" : ""}`} />
            </button>

            {advanced ? (
              <div className="flex flex-col gap-5 border-t pt-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field><FieldLabel htmlFor="brand">{t("form.brand")}</FieldLabel><Input id="brand" {...form.register("brand")} /></Field>
                  <Field><FieldLabel htmlFor="model">{t("form.model")}</FieldLabel><Input id="model" {...form.register("model")} /></Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field><FieldLabel htmlFor="warranty-end">{t("form.warrantyEnd")}</FieldLabel><Input id="warranty-end" type="date" {...form.register("warrantyEndDate")} /></Field>
                  <Field><FieldLabel htmlFor="retirement-date">{t("form.retirementDate")}</FieldLabel><Input id="retirement-date" type="date" {...form.register("estimatedRetirementDate")} /></Field>
                </div>
                <Field><FieldLabel htmlFor="description">{t("form.description")}</FieldLabel><Textarea id="description" {...form.register("description")} /></Field>
                <Field><FieldLabel htmlFor="notes">{t("form.notes")}</FieldLabel><Textarea id="notes" {...form.register("notes")} /></Field>
                <FieldDescription>{t("form.draftSaved")}</FieldDescription>
              </div>
            ) : null}
          </FieldGroup>

          <SheetFooter className="sticky bottom-0 mt-6 border-t bg-background py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            {editingItem ? null : <Button type="submit" name="intent" value="continue" variant="secondary">{t("form.saveContinue")}</Button>}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              <Save data-icon="inline-start" />
              {t("common.save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
