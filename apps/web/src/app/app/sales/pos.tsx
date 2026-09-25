"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  MessageCircle,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  cartTotals,
  formatTaka,
  needsTransactionId,
  stockLevel,
  takaToPaisa,
  type PaymentMethod,
} from "@gymnode/core";
import type { PaymentMember } from "@/app/app/payments/actions";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { MemberAvatar } from "@/components/members/member-avatar";
import { whatsappUrl } from "@/components/members/whatsapp-link";
import { MethodPicker } from "@/components/payments/method-picker";
import { MemberSearch } from "@/components/payments/take-payment-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useErrorText } from "@/lib/use-error-text";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { cn } from "@/lib/utils";
import { recordSale, type SaleDone } from "./actions";

export type PosProduct = {
  id: string;
  name: string;
  pricePaisa: number;
  stockQty: number;
  lowStockAt: number;
};

type Cart = Record<string, number>;

/** Simple POS for supplements and drinks: tap products → cart → take payment → receipt. */
export function Pos({
  products,
  gymName,
  siteUrl,
  canManage,
}: {
  products: PosProduct[];
  gymName: string;
  siteUrl: string;
  canManage: boolean;
}) {
  const t = useTranslations("shop");
  const tc = useTranslations("common");
  const desktop = useIsDesktop();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId.get(id), qty }))
    .filter((l): l is { product: PosProduct; qty: number } => !!l.product && l.qty > 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = cartTotals(
    lines.map((l) => ({ pricePaisa: l.product.pricePaisa, qty: l.qty })),
  ).subtotalPaisa;

  const setQty = (id: string, qty: number) => {
    const p = byId.get(id);
    if (!p) return;
    setCart((c) => {
      const next = { ...c };
      const clamped = Math.min(Math.max(qty, 0), p.stockQty);
      if (clamped === 0) delete next[id];
      else next[id] = clamped;
      return next;
    });
  };

  const q = query.trim().toLowerCase();
  const visible = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;

  if (products.length === 0)
    return (
      <EmptyState
        icon={<ShoppingCart />}
        message={canManage ? t("noProducts") : t("noProductsReception")}
        action={
          canManage ? (
            <Button asChild>
              <Link href="/app/sales?tab=stock">{t("addProduct")}</Link>
            </Button>
          ) : null
        }
      />
    );

  const panel = (
    <CartPanel
      lines={lines}
      setQty={setQty}
      clear={() => setCart({})}
      gymName={gymName}
      siteUrl={siteUrl}
    />
  );

  return (
    <div className="grid gap-5 desk:grid-cols-[1fr_400px]">
      <div className="flex min-w-0 flex-col gap-4 pb-20 desk:pb-0">
        <label className="flex h-12 items-center gap-2 rounded-md border border-border bg-surface px-3.5 focus-within:border-accent">
          <Search className="size-[18px] text-muted" aria-hidden />
          <span className="sr-only">{t("searchProducts")}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchProducts")}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
        </label>
        {visible.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => {
              const level = stockLevel(p.stockQty, p.lowStockAt);
              const inCart = cart[p.id] ?? 0;
              const full = inCart >= p.stockQty;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={level === "out" || full}
                    onClick={() => setQty(p.id, inCart + 1)}
                    aria-label={`${p.name}, ${formatTaka(p.pricePaisa)}${inCart ? `, ${t("cart")} ${inCart}` : ""}`}
                    className={cn(
                      "relative flex h-full min-h-28 w-full cursor-pointer flex-col items-start gap-2 rounded-lg border bg-surface p-4 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border",
                      inCart ? "border-accent" : "border-border",
                    )}
                  >
                    {inCart ? (
                      <span className="num absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">
                        {inCart}
                      </span>
                    ) : null}
                    <span className="line-clamp-2 pr-8 font-semibold">{p.name}</span>
                    <span className="num mt-auto text-lg font-bold">
                      {formatTaka(p.pricePaisa)}
                    </span>
                    <span
                      className={cn(
                        "num text-xs",
                        level === "out"
                          ? "text-danger"
                          : level === "low"
                            ? "text-warning"
                            : "text-muted",
                      )}
                    >
                      {level === "out"
                        ? t("outOfStock")
                        : t("inStock", { count: String(p.stockQty) })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("noMatch")}</p>
        )}
      </div>

      {desktop === null ? null : desktop ? (
        <Card className="sticky top-6 flex flex-col gap-4 self-start" data-testid="cart">
          <h2 className="text-[17px] font-bold">{t("cart")}</h2>
          {panel}
        </Card>
      ) : (
        <>
          <Button
            size="lg"
            className="fixed right-4 bottom-20 left-4 z-20 shadow-lg md:bottom-6 md:left-auto"
            onClick={() => setSheetOpen(true)}
          >
            <ShoppingCart /> {t("viewCart", { count: String(count) })}
            {count ? <span className="num">· {formatTaka(subtotal)}</span> : null}
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
              <SheetTitle>{t("cart")}</SheetTitle>
              <div className="mt-5 flex flex-col gap-4" data-testid="cart">
                {panel}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

function CartPanel({
  lines,
  setQty,
  clear,
  gymName,
  siteUrl,
}: {
  lines: { product: PosProduct; qty: number }[];
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  gymName: string;
  siteUrl: string;
}) {
  const t = useTranslations("shop");
  const tp = useTranslations("payments");
  const tpay = useTranslations("payment");
  const tm = useTranslations("methods");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [member, setMember] = useState<PaymentMember | null>(null);
  const [picking, setPicking] = useState(false);
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [txn, setTxn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txnError, setTxnError] = useState<string | null>(null);
  const [done, setDone] = useState<(SaleDone & { member: PaymentMember | null }) | null>(null);

  const discountTaka = Number(discount) || 0;
  const totals = cartTotals(
    lines.map((l) => ({ pricePaisa: l.product.pricePaisa, qty: l.qty })),
    discountTaka > 0 ? takaToPaisa(discountTaka) : 0,
  );
  const discountTooBig = discountTaka > 0 && takaToPaisa(discountTaka) >= totals.subtotalPaisa;

  if (done) {
    const receiptUrl = `${siteUrl}/r/${done.receiptToken}`;
    return (
      <div role="status" className="flex flex-col gap-4">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <div>
          <h3 className="text-[17px] font-bold">{t("sold")}</h3>
          <p className="num text-sm text-muted">
            {formatTaka(done.totalPaisa)} · {tp("doneInvoice", { invoice: done.invoiceNo })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="secondary">
            <Link href={`/r/${done.receiptToken}`} target="_blank">
              <ReceiptText /> {tp("openReceipt")}
            </Link>
          </Button>
          {done.member ? (
            <Button asChild variant="secondary">
              <a
                href={whatsappUrl(
                  done.member.phone,
                  tp("receiptText", { gym: gymName, invoice: done.invoiceNo, url: receiptUrl }),
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="text-success" /> {tp("shareReceipt")}
              </a>
            </Button>
          ) : null}
        </div>
        <Button onClick={() => setDone(null)}>{t("newSale")}</Button>
      </div>
    );
  }

  const submit = () => {
    setError(null);
    setTxnError(null);
    if (!lines.length) return setError("emptyCart");
    if (discountTooBig) return setError("invalidDiscount");
    if (needsTransactionId(method) && txn.trim().length < 4)
      return setTxnError("transactionRequired");
    startTransition(async () => {
      const res = await recordSale({
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        memberId: member?.id ?? "",
        discountTaka,
        method,
        transactionId: needsTransactionId(method) ? txn : "",
      });
      if (res.ok && res.data) {
        setDone({ ...res.data, member });
        clear();
        setMember(null);
        setDiscount("");
        setTxn("");
        setMethod("cash");
      } else if (!res.ok) {
        if (res.fieldErrors?.transactionId) setTxnError(res.fieldErrors.transactionId);
        setError(res.formError ?? (res.fieldErrors ? Object.values(res.fieldErrors)[0]! : null));
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormError message={errorText(error)} />
      {lines.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {lines.map(({ product: p, qty }) => (
            <li key={p.id} className="flex items-center gap-2 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{p.name}</span>
                <span className="num text-xs text-muted">
                  {formatTaka(p.pricePaisa)} × {qty} = {formatTaka(p.pricePaisa * qty)}
                </span>
              </span>
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label={`${t("less")}: ${p.name}`}
                onClick={() => setQty(p.id, qty - 1)}
              >
                {qty === 1 ? <Trash2 /> : <Minus />}
              </Button>
              <span className="num w-7 text-center font-semibold" aria-live="polite">
                {qty}
              </span>
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label={`${t("more")}: ${p.name}`}
                disabled={qty >= p.stockQty}
                onClick={() => setQty(p.id, qty + 1)}
              >
                <Plus />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md bg-surface-2 p-4 text-center text-sm text-muted">
          {t("cartEmpty")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("customer")}</span>
        {member ? (
          <div className="flex items-center gap-3 rounded-md bg-surface-2 p-2.5">
            <MemberAvatar name={member.name} size={34} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{member.name}</span>
              <span className="num text-xs text-muted">{member.code}</span>
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("walkIn")}
              onClick={() => setMember(null)}
            >
              <X />
            </Button>
          </div>
        ) : picking ? (
          <MemberSearch
            onPick={(m) => {
              setMember(m);
              setPicking(false);
            }}
          />
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 pl-3.5">
            <span className="text-sm text-muted">{t("walkIn")}</span>
            <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
              {t("pickMember")}
            </Button>
          </div>
        )}
      </div>

      <Field
        id="pos-discount"
        label={t("discount")}
        error={discountTooBig ? errorText("invalidDiscount") : undefined}
      >
        <Input
          inputMode="decimal"
          className="num"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder="0"
        />
      </Field>
      <MethodPicker value={method} onChange={setMethod} />
      {needsTransactionId(method) ? (
        <>
          <Field
            id="pos-txn"
            label={tpay("transactionId", { method: tm(method) })}
            error={errorText(txnError)}
          >
            <Input className="num" value={txn} onChange={(e) => setTxn(e.target.value)} />
          </Field>
          <p className="text-[13px] text-muted">{tpay("pendingNote")}</p>
        </>
      ) : null}

      <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{t("subtotal")}</dt>
          <dd className="num">{formatTaka(totals.subtotalPaisa)}</dd>
        </div>
        {totals.discountPaisa > 0 && !discountTooBig ? (
          <div className="flex justify-between">
            <dt className="text-muted">{t("discount")}</dt>
            <dd className="num">−{formatTaka(totals.discountPaisa)}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between">
          <dt className="font-semibold">{t("total")}</dt>
          <dd className="num text-2xl font-bold">{formatTaka(totals.totalPaisa)}</dd>
        </div>
      </dl>
      <Button size="lg" disabled={pending || !lines.length} onClick={submit}>
        {t("sell")}
      </Button>
    </div>
  );
}
