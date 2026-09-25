import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatDateShort, formatTimeDhaka } from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { FRONT_DESK, MANAGEMENT, hasRole, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/urls";
import { Pos } from "./pos";
import { ProductsManager } from "./products-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop");
  return { title: t("title") };
}

const TABS = ["sell", "stock", "history"] as const;
type Tab = (typeof TABS)[number];

type MovementRow = {
  id: string;
  at: string;
  product: string;
  kind: "purchase" | "sale" | "sale_return" | "adjustment";
  change: number;
  note: string;
  by: string;
};

export default async function SalesPage({ searchParams }: PageProps<"/app/sales">) {
  const t = await getTranslations("shop");
  const te = await getTranslations("errors");
  const membership = await requireGym();
  if (!hasRole(membership, FRONT_DESK)) return <p className="text-muted">{te("forbidden")}</p>;
  const canManage = hasRole(membership, MANAGEMENT);

  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "sell";
  const supabase = await createClient();

  const { data: productData } = await supabase
    .from("products")
    .select("id, name, price_paisa, cost_paisa, stock_qty, low_stock_at, is_active, is_low_stock")
    .eq("gym_id", membership.gymId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  const products = productData ?? [];
  const lowCount = products.filter((p) => p.is_active && p.is_low_stock).length;

  let content: React.ReactNode;
  if (tab === "sell") {
    const { data: gym } = await supabase
      .from("gyms")
      .select("name")
      .eq("id", membership.gymId)
      .single();
    content = (
      <Pos
        products={products
          .filter((p) => p.is_active)
          .map((p) => ({
            id: p.id,
            name: p.name,
            pricePaisa: p.price_paisa,
            stockQty: p.stock_qty,
            lowStockAt: p.low_stock_at,
          }))}
        gymName={gym?.name ?? ""}
        siteUrl={await siteUrl()}
        canManage={canManage}
      />
    );
  } else if (tab === "stock") {
    const { data: cats } = canManage
      ? await supabase
          .from("expense_categories")
          .select("id, name, is_salary")
          .eq("gym_id", membership.gymId)
          .eq("is_active", true)
          .eq("is_salary", false)
          .order("sort_order")
      : { data: [] };
    const categories = (cats ?? []).map((c) => ({ id: c.id, name: c.name }));
    // The default "supplements" category from M4; otherwise the first one.
    const defaultCategoryId =
      categories.find((c) => c.name === "সাপ্লিমেন্ট কেনা")?.id ?? categories[0]?.id ?? "";
    content = (
      <ProductsManager
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          pricePaisa: p.price_paisa,
          costPaisa: canManage ? p.cost_paisa : null,
          stockQty: p.stock_qty,
          lowStockAt: p.low_stock_at,
          isActive: p.is_active,
        }))}
        canManage={canManage}
        categories={categories}
        defaultCategoryId={defaultCategoryId}
      />
    );
  } else {
    const [{ data: moves }, { data: staff }] = await Promise.all([
      supabase
        .from("stock_movements")
        .select("id, created_at, kind, qty_change, note, created_by, products(name)")
        .eq("gym_id", membership.gymId)
        .order("created_at", { ascending: false })
        .limit(150),
      supabase.from("gym_users").select("user_id, display_name").eq("gym_id", membership.gymId),
    ]);
    const names = new Map((staff ?? []).map((s) => [s.user_id, s.display_name]));
    const rows: MovementRow[] = (moves ?? []).map((m) => ({
      id: m.id,
      at: m.created_at,
      product: (m.products as { name: string } | null)?.name ?? "—",
      kind: m.kind,
      change: m.qty_change,
      note: m.note,
      by: names.get(m.created_by ?? "") ?? "—",
    }));
    const columns: Column<MovementRow>[] = [
      {
        key: "time",
        header: t("colTime"),
        width: "minmax(max-content, 1fr)",
        cell: (r) => {
          const d = new Date(r.at);
          return (
            <span className="num whitespace-nowrap text-muted">
              {formatDateShort(d).split(" ").slice(0, 2).join(" ")} · {formatTimeDhaka(d)}
            </span>
          );
        },
      },
      {
        key: "product",
        header: t("colProduct"),
        width: "1.6fr",
        primary: true,
        cell: (r) => <span className="font-semibold">{r.product}</span>,
      },
      {
        key: "kind",
        header: t("colKind"),
        width: "1.3fr",
        cell: (r) => (
          <Badge
            tone={
              r.kind === "purchase"
                ? "green"
                : r.kind === "sale"
                  ? "blue"
                  : r.kind === "sale_return"
                    ? "gray"
                    : "amber"
            }
          >
            {t(`kind_${r.kind}`)}
          </Badge>
        ),
      },
      {
        key: "change",
        header: t("colChange"),
        cell: (r) => (
          <span className={`num font-semibold ${r.change > 0 ? "text-success" : ""}`}>
            {r.change > 0 ? `+${r.change}` : `−${Math.abs(r.change)}`}
          </span>
        ),
      },
      { key: "note", header: t("colNote"), width: "1.4fr", cell: (r) => r.note || "—" },
      {
        key: "by",
        header: t("colBy"),
        hideOnMobile: true,
        cell: (r) => <span className="text-muted">{r.by}</span>,
      },
    ];
    content = rows.length ? (
      <ResponsiveTable
        caption={t("tabHistory")}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />
    ) : (
      <EmptyState message={t("historyEmpty")} />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
        <LinkTabs
          label={t("title")}
          items={TABS.map((key) => ({
            href: key === "sell" ? "/app/sales" : `/app/sales?tab=${key}`,
            label: t(`tab${key[0]!.toUpperCase()}${key.slice(1)}` as "tabSell"),
            active: tab === key,
            count: key === "stock" && lowCount ? lowCount : undefined,
          }))}
        />
      </header>
      {content}
    </div>
  );
}
