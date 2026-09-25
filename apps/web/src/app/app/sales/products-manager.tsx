"use client";

import { useState, useTransition } from "react";
import { ClipboardPen, PackagePlus, Pencil, ShoppingBag, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  formatTaka,
  productSchema,
  stockAdjustSchema,
  stockInSchema,
  stockLevel,
  takaToPaisa,
  type ProductInput,
  type StockAdjustInput,
  type StockInInput,
} from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useErrorText } from "@/lib/use-error-text";
import { addStock, adjustStock, deleteProduct, saveProduct } from "./actions";

export type StockProduct = {
  id: string;
  name: string;
  pricePaisa: number;
  costPaisa: number | null;
  stockQty: number;
  lowStockAt: number;
  isActive: boolean;
};

type Dialog =
  | { kind: "edit"; product: StockProduct | null }
  | { kind: "stockIn" | "adjust" | "delete"; product: StockProduct };

export function ProductsManager({
  products,
  canManage,
  categories,
  defaultCategoryId,
}: {
  products: StockProduct[];
  canManage: boolean;
  categories: { id: string; name: string }[];
  defaultCategoryId: string;
}) {
  const t = useTranslations("shop");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pending, startTransition] = useTransition();

  const stockBadge = (p: StockProduct) => {
    const level = stockLevel(p.stockQty, p.lowStockAt);
    return level === "out" ? (
      <Badge tone="red">{t("outOfStock")}</Badge>
    ) : level === "low" ? (
      <Badge tone="amber">{t("lowStock")}</Badge>
    ) : null;
  };

  const columns: Column<StockProduct>[] = [
    {
      key: "name",
      header: t("colProduct"),
      width: "2fr",
      primary: true,
      cell: (p) => <span className="font-semibold">{p.name}</span>,
    },
    {
      key: "price",
      header: t("colPrice"),
      cell: (p) => <span className="num font-semibold">{formatTaka(p.pricePaisa)}</span>,
    },
    ...(canManage
      ? [
          {
            key: "cost",
            header: t("colCost"),
            cell: (p: StockProduct) => (
              <span className="num text-muted">
                {p.costPaisa !== null ? formatTaka(p.costPaisa) : "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "stock",
      header: t("colStock"),
      width: "1.3fr",
      cell: (p) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="num font-semibold">{p.stockQty}</span>
          {stockBadge(p)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("colStatus"),
      cell: (p) => (
        <Badge tone={p.isActive ? "green" : "gray"}>{p.isActive ? t("on") : t("inactive")}</Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: <span className="sr-only md:not-sr-only">{t("colActions")}</span>,
            width: "minmax(max-content, 1.6fr)",
            align: "end" as const,
            mobileFooter: true,
            cell: (p: StockProduct) => (
              <span className="flex flex-wrap justify-end gap-2">
                <Button size="sm" onClick={() => setDialog({ kind: "stockIn", product: p })}>
                  <PackagePlus /> {t("stockIn")}
                </Button>
                <Button
                  size="icon-sm"
                  variant="secondary"
                  aria-label={`${t("adjust")}: ${p.name}`}
                  title={t("adjust")}
                  onClick={() => setDialog({ kind: "adjust", product: p })}
                >
                  <ClipboardPen />
                </Button>
                <Button
                  size="icon-sm"
                  variant="secondary"
                  aria-label={`${tc("edit")}: ${p.name}`}
                  onClick={() => setDialog({ kind: "edit", product: p })}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="danger"
                  aria-label={`${tc("delete")}: ${p.name}`}
                  onClick={() => setDialog({ kind: "delete", product: p })}
                >
                  <Trash2 />
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  const title =
    dialog?.kind === "edit"
      ? dialog.product
        ? t("editProductTitle")
        : t("addProductTitle")
      : dialog?.kind === "stockIn"
        ? t("stockInTitle", { name: dialog.product.name })
        : dialog?.kind === "adjust"
          ? t("adjustTitle", { name: dialog.product.name })
          : dialog?.kind === "delete"
            ? `${tc("delete")}: ${dialog.product.name}`
            : "";

  return (
    <section className="flex flex-col gap-4">
      {canManage ? (
        <Button className="self-start" onClick={() => setDialog({ kind: "edit", product: null })}>
          {t("addProduct")}
        </Button>
      ) : (
        <p className="text-sm text-muted">{t("readOnly")}</p>
      )}
      {products.length ? (
        <ResponsiveTable
          caption={t("tabStock")}
          columns={columns}
          rows={products}
          rowKey={(p) => p.id}
        />
      ) : (
        <EmptyState
          icon={<ShoppingBag />}
          message={canManage ? t("noProducts") : t("noProductsReception")}
        />
      )}

      <Sheet open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
          <SheetTitle>{title}</SheetTitle>
          {dialog?.kind === "edit" ? (
            <ProductForm
              key={dialog.product?.id ?? "new"}
              product={dialog.product}
              onDone={() => setDialog(null)}
            />
          ) : dialog?.kind === "stockIn" ? (
            <StockInForm
              key={dialog.product.id}
              product={dialog.product}
              categories={categories}
              defaultCategoryId={defaultCategoryId}
              onDone={() => setDialog(null)}
            />
          ) : dialog?.kind === "adjust" ? (
            <AdjustForm
              key={dialog.product.id}
              product={dialog.product}
              onDone={() => setDialog(null)}
            />
          ) : dialog?.kind === "delete" ? (
            <>
              <SheetDescription className="mt-2">{t("deleteConfirm")}</SheetDescription>
              <Button
                variant="danger"
                size="lg"
                className="mt-6"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteProduct(dialog.product.id);
                    if (res.ok) {
                      toast.success(t("productDeleted"));
                      setDialog(null);
                    } else toast.error(errorText(res.formError));
                  })
                }
              >
                {tc("delete")}
              </Button>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

/** Applies server field errors to the form, or shows the form-level error. */
function useSubmit<T extends Record<string, unknown>>(
  form: ReturnType<typeof useForm<T>>,
  action: (
    values: T,
  ) => Promise<{ ok: boolean; formError?: string; fieldErrors?: Record<string, string> }>,
  success: string,
  onDone: () => void,
) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await action(form.getValues());
      if (res.ok) {
        toast.success(success);
        onDone();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as Parameters<typeof form.setError>[0], { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });
  return { pending, formError, onSubmit };
}

function ProductForm({ product, onDone }: { product: StockProduct | null; onDone: () => void }) {
  const t = useTranslations("shop");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          priceTaka: product.pricePaisa / 100,
          lowStockAt: product.lowStockAt,
          isActive: product.isActive,
        }
      : { name: "", priceTaka: "" as unknown as number, lowStockAt: 5, isActive: true },
  });
  const isActive = useWatch({ control: form.control, name: "isActive" });
  const { pending, formError, onSubmit } = useSubmit(
    form,
    (v) => saveProduct(product?.id ?? null, v),
    t("productSaved"),
    onDone,
  );
  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="pr-name" label={t("name")} error={errorText(errors.name?.message)}>
        <Input autoFocus {...form.register("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="pr-price" label={t("price")} error={errorText(errors.priceTaka?.message)}>
          <Input inputMode="decimal" className="num" {...form.register("priceTaka")} />
        </Field>
        <Field id="pr-low" label={t("lowStockAt")} error={errorText(errors.lowStockAt?.message)}>
          <Input inputMode="numeric" className="num" {...form.register("lowStockAt")} />
        </Field>
      </div>
      <label
        htmlFor="pr-active"
        className="flex min-h-14 cursor-pointer items-center justify-between gap-4"
      >
        <span className="flex flex-col">
          <span className="font-semibold">{t("active")}</span>
          <span className="text-[13px] text-muted">{t("activeHint")}</span>
        </span>
        <Switch
          id="pr-active"
          checked={isActive}
          onCheckedChange={(v) => form.setValue("isActive", v)}
        />
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {tc("save")}
      </Button>
    </form>
  );
}

function StockInForm({
  product,
  categories,
  defaultCategoryId,
  onDone,
}: {
  product: StockProduct;
  categories: { id: string; name: string }[];
  defaultCategoryId: string;
  onDone: () => void;
}) {
  const t = useTranslations("shop");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const form = useForm<StockInInput>({
    resolver: zodResolver(stockInSchema),
    defaultValues: {
      qty: "" as unknown as number,
      unitCostTaka:
        product.costPaisa !== null ? product.costPaisa / 100 : ("" as unknown as number),
      recordExpense: categories.length > 0,
      categoryId: defaultCategoryId,
      note: "",
    },
  });
  const [qty, unitCost, recordExpense] = useWatch({
    control: form.control,
    name: ["qty", "unitCostTaka", "recordExpense"],
  });
  const total =
    Number(qty) > 0 && Number(unitCost) > 0 ? takaToPaisa(Number(unitCost)) * Number(qty) : 0;
  const { pending, formError, onSubmit } = useSubmit(
    form,
    (v) => addStock(product.id, v),
    t("stockAdded"),
    onDone,
  );
  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="si-qty" label={t("qty")} error={errorText(errors.qty?.message)}>
          <Input inputMode="numeric" className="num" autoFocus {...form.register("qty")} />
        </Field>
        <Field id="si-cost" label={t("unitCost")} error={errorText(errors.unitCostTaka?.message)}>
          <Input inputMode="decimal" className="num" {...form.register("unitCostTaka")} />
        </Field>
      </div>
      {categories.length ? (
        <>
          <label
            htmlFor="si-expense"
            className="flex cursor-pointer items-center justify-between gap-4"
          >
            <span className="flex flex-col">
              <span className="font-semibold">{t("recordExpense")}</span>
              {recordExpense && total > 0 ? (
                <span className="num text-[13px] text-muted">
                  {t("recordExpenseHint", { amount: formatTaka(total) })}
                </span>
              ) : null}
            </span>
            <Switch
              id="si-expense"
              checked={recordExpense}
              onCheckedChange={(v) => form.setValue("recordExpense", v)}
            />
          </label>
          {recordExpense ? (
            <Field id="si-cat" label={t("expenseCategory")}>
              <NativeSelect {...form.register("categoryId")}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
        </>
      ) : null}
      <Field id="si-note" label={t("stockNote")} error={errorText(errors.note?.message)}>
        <Input {...form.register("note")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {tc("save")}
      </Button>
    </form>
  );
}

function AdjustForm({ product, onDone }: { product: StockProduct; onDone: () => void }) {
  const t = useTranslations("shop");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const form = useForm<StockAdjustInput>({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: { newQty: product.stockQty, reason: "" },
  });
  const { pending, formError, onSubmit } = useSubmit(
    form,
    (v) => adjustStock(product.id, v),
    t("adjusted"),
    onDone,
  );
  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <p className="text-sm text-muted">{t("adjustHint")}</p>
      <FormError message={errorText(formError)} />
      <Field id="adj-qty" label={t("newQty")} error={errorText(errors.newQty?.message)}>
        <Input inputMode="numeric" className="num" autoFocus {...form.register("newQty")} />
      </Field>
      <Field id="adj-reason" label={t("reason")} error={errorText(errors.reason?.message)}>
        <Input {...form.register("reason")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {tc("save")}
      </Button>
    </form>
  );
}
