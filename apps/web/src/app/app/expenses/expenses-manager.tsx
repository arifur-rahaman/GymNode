"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { EyeOff, Pencil, Receipt, Tags, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  expenseCategorySchema,
  expenseSchema,
  formatDateShort,
  formatTaka,
  type ExpenseCategoryInput,
  type ExpenseInput,
  type IsoDate,
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
import { cn } from "@/lib/utils";
import { deleteExpense, saveCategory, saveExpense, setCategoryActive } from "./actions";

export type Category = { id: string; name: string; isSalary: boolean; isActive: boolean };
export type ExpenseRow = {
  id: string;
  categoryId: string;
  category: string;
  amount: number;
  spentOn: string;
  note: string;
  by: string;
};

export function ExpensesManager({
  rows,
  categories,
  activeCategory,
  month,
  today,
  isOwner,
}: {
  rows: ExpenseRow[];
  categories: Category[];
  activeCategory: string | null;
  month: IsoDate;
  today: IsoDate;
  isOwner: boolean;
}) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [editing, setEditing] = useState<ExpenseRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const monthParam = month.slice(0, 7) === today.slice(0, 7) ? "" : `month=${month.slice(0, 7)}`;
  const filterHref = (cat: string | null) => {
    const p = [monthParam, cat ? `cat=${cat}` : ""].filter(Boolean).join("&");
    return `/app/expenses${p ? `?${p}` : ""}`;
  };
  const usedCategories = categories.filter(
    (c) => c.isActive || rows.some((r) => r.categoryId === c.id) || c.id === activeCategory,
  );

  const columns: Column<ExpenseRow>[] = [
    {
      key: "date",
      header: t("colDate"),
      width: "minmax(max-content, 0.8fr)",
      cell: (r) => (
        <span className="num whitespace-nowrap text-muted">{formatDateShort(r.spentOn)}</span>
      ),
    },
    {
      key: "cat",
      header: t("colCategory"),
      primary: true,
      width: "1.2fr",
      cell: (r) => <span className="font-semibold">{r.category}</span>,
    },
    { key: "note", header: t("colNote"), width: "1.6fr", cell: (r) => r.note || "—" },
    {
      key: "amount",
      header: t("colAmount"),
      cell: (r) => <span className="num font-semibold">{formatTaka(r.amount)}</span>,
    },
    {
      key: "by",
      header: t("colBy"),
      hideOnMobile: true,
      cell: (r) => <span className="text-muted">{r.by}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only md:not-sr-only">{t("colActions")}</span>,
      width: "100px",
      align: "end",
      mobileFooter: true,
      cell: (r) => (
        <span className="flex justify-end gap-2">
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label={`${tc("edit")}: ${r.category} ${formatTaka(r.amount)}`}
            onClick={() => setEditing(r)}
          >
            <Pencil />
          </Button>
          <Button
            size="icon-sm"
            variant="danger"
            aria-label={`${tc("delete")}: ${r.category} ${formatTaka(r.amount)}`}
            onClick={() => setDeleting(r)}
          >
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold">{t("list")}</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCatsOpen(true)}>
            <Tags /> {t("categories")}
          </Button>
          <Button onClick={() => setEditing("new")}>{t("add")}</Button>
        </div>
      </div>
      <nav aria-label={t("colCategory")} className="flex gap-2 overflow-x-auto pb-1">
        {[{ id: null, name: t("allCategories") }, ...usedCategories].map((c) => (
          <Link
            key={c.id ?? "all"}
            href={filterHref(c.id)}
            aria-current={activeCategory === c.id ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm",
              activeCategory === c.id
                ? "border-accent bg-accent font-semibold text-on-accent"
                : "border-border bg-surface text-muted hover:text-text",
            )}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <ResponsiveTable caption={t("list")} columns={columns} rows={rows} rowKey={(r) => r.id} />
      ) : (
        <EmptyState
          icon={<Receipt />}
          message={t("empty")}
          action={<Button onClick={() => setEditing("new")}>{t("add")}</Button>}
        />
      )}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
          <SheetTitle>{editing === "new" ? t("addTitle") : t("editTitle")}</SheetTitle>
          {editing ? (
            <ExpenseForm
              key={editing === "new" ? "new" : editing.id}
              expense={editing === "new" ? null : editing}
              categories={categories.filter(
                (c) => c.isActive || (editing !== "new" && c.id === editing.categoryId),
              )}
              defaultDate={month.slice(0, 7) === today.slice(0, 7) ? today : month}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <SheetContent closeLabel={tc("close")}>
          <SheetTitle>
            {tc("delete")}: {deleting?.category} {deleting ? formatTaka(deleting.amount) : ""}
          </SheetTitle>
          <SheetDescription className="mt-2">{t("deleteConfirm")}</SheetDescription>
          <Button
            variant="danger"
            size="lg"
            className="mt-6"
            disabled={pending}
            onClick={() =>
              deleting &&
              startTransition(async () => {
                const res = await deleteExpense(deleting.id);
                if (res.ok) {
                  toast.success(t("deleted"));
                  setDeleting(null);
                } else toast.error(errorText(res.formError));
              })
            }
          >
            {tc("delete")}
          </Button>
        </SheetContent>
      </Sheet>

      <Sheet open={catsOpen} onOpenChange={setCatsOpen}>
        <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
          <SheetTitle>{t("categoriesTitle")}</SheetTitle>
          <CategoriesEditor categories={categories} isOwner={isOwner} />
        </SheetContent>
      </Sheet>
    </section>
  );
}

function ExpenseForm({
  expense,
  categories,
  defaultDate,
  onDone,
}: {
  expense: ExpenseRow | null;
  categories: Category[];
  defaultDate: IsoDate;
  onDone: () => void;
}) {
  const t = useTranslations("expenses");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense
      ? {
          categoryId: expense.categoryId,
          amountTaka: expense.amount / 100,
          spentOn: expense.spentOn,
          note: expense.note,
        }
      : {
          categoryId: categories[0]?.id ?? "",
          amountTaka: "" as unknown as number,
          spentOn: defaultDate,
          note: "",
        },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await saveExpense(expense?.id ?? null, form.getValues());
      if (res.ok) {
        toast.success(t("saved"));
        onDone();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as keyof ExpenseInput, { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="ex-cat" label={t("category")} error={errorText(errors.categoryId?.message)}>
        <NativeSelect {...form.register("categoryId")}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isSalary ? ` · ${t("salary")}` : ""}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="ex-amount" label={t("amount")} error={errorText(errors.amountTaka?.message)}>
          <Input inputMode="decimal" className="num" autoFocus {...form.register("amountTaka")} />
        </Field>
        <Field id="ex-date" label={t("date")} error={errorText(errors.spentOn?.message)}>
          <Input type="date" className="num" {...form.register("spentOn")} />
        </Field>
      </div>
      <Field id="ex-note" label={t("note")} error={errorText(errors.note?.message)}>
        <Input {...form.register("note")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}

function CategoriesEditor({ categories, isOwner }: { categories: Category[]; isOwner: boolean }) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  return (
    <div className="mt-5 flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {categories.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center gap-2 px-3 py-2">
            <span
              className={cn("min-w-0 flex-1 truncate", !c.isActive && "text-muted line-through")}
            >
              {c.name}
            </span>
            {c.isSalary ? <Badge tone="blue">{t("salary")}</Badge> : null}
            {!c.isActive ? <Badge tone="gray">{t("hidden")}</Badge> : null}
            {!c.isSalary || isOwner ? (
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`${tc("edit")}: ${c.name}`}
                  onClick={() => setEditing(c)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await setCategoryActive(c.id, !c.isActive);
                      if (!res.ok) toast.error(errorText(res.formError));
                    })
                  }
                >
                  {c.isActive ? (
                    <>
                      <EyeOff /> {t("hideCategory")}
                    </>
                  ) : (
                    t("showCategory")
                  )}
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {editing ? (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          isOwner={isOwner}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button variant="secondary" onClick={() => setEditing("new")}>
          {t("addCategory")}
        </Button>
      )}
    </div>
  );
}

function CategoryForm({
  category,
  isOwner,
  onDone,
}: {
  category: Category | null;
  isOwner: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("expenses");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ExpenseCategoryInput>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: { name: category?.name ?? "", isSalary: category?.isSalary ?? false },
  });
  const isSalary = useWatch({ control: form.control, name: "isSalary" });
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await saveCategory(category?.id ?? null, form.getValues());
      if (res.ok) {
        toast.success(t("categorySaved"));
        onDone();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as keyof ExpenseCategoryInput, { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-md bg-surface-2 p-4"
    >
      <FormError message={errorText(formError)} />
      <Field
        id="cat-name"
        label={t("categoryName")}
        error={errorText(form.formState.errors.name?.message)}
      >
        <Input autoFocus {...form.register("name")} />
      </Field>
      {isOwner ? (
        <label
          htmlFor="cat-salary"
          className="flex cursor-pointer items-center justify-between gap-4"
        >
          <span className="flex flex-col">
            <span className="font-semibold">{t("isSalary")}</span>
            <span className="text-[13px] text-muted">{t("isSalaryHint")}</span>
          </span>
          <Switch
            id="cat-salary"
            checked={isSalary}
            onCheckedChange={(v) => form.setValue("isSalary", v)}
          />
        </label>
      ) : null}
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
