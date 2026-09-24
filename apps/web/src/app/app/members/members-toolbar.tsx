"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

type Params = { tab: string; q: string; pkg: string; page: number };

/** Filter tabs with counts, search and package filter. State lives in the URL. */
export function MembersToolbar({
  params,
  counts,
  packages,
  showPending,
}: {
  params: Params;
  counts: Record<"all" | "active" | "due" | "expired" | "frozen" | "pending", number>;
  packages: { id: string; name: string }[];
  showPending: boolean;
}) {
  const t = useTranslations("members");
  const ts = useTranslations("status");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.q);

  // Build on the *current* address, not the props from the last render: a delayed search
  // must not undo a tab or package the user picked in the meantime.
  function go(next: Partial<Omit<Params, "page">>) {
    const sp = new URLSearchParams(window.location.search);
    sp.delete("page");
    for (const [key, value] of Object.entries(next)) {
      if (!value || (key === "tab" && value === "all")) sp.delete(key);
      else sp.set(key, String(value));
    }
    startTransition(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  }

  // Search as you type, with a short pause so slow connections aren't flooded.
  useEffect(() => {
    if (q === params.q) return;
    const id = setTimeout(() => go({ q }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` reads the latest params
  }, [q]);

  const tabs = [
    { value: "all", label: t("tabAll"), count: counts.all },
    { value: "active", label: ts("active"), count: counts.active },
    { value: "due", label: ts("due"), count: counts.due },
    { value: "expired", label: ts("expired"), count: counts.expired },
    { value: "frozen", label: ts("frozen"), count: counts.frozen },
    ...(showPending && counts.pending > 0
      ? [{ value: "pending", label: ts("pending"), count: counts.pending }]
      : []),
  ];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between",
        pending && "opacity-80",
      )}
    >
      <Segmented
        aria-label={t("title")}
        items={tabs}
        value={params.tab}
        onValueChange={(tab) => go({ tab })}
      />
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3.5 text-muted sm:w-72 focus-within:border-accent">
          <Search className="size-[18px] shrink-0" aria-hidden />
          <input
            type="search"
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="shrink-0">{t("packageFilter")}</span>
          <NativeSelect
            value={params.pkg}
            onChange={(e) => go({ pkg: e.target.value })}
            className="h-11 min-w-36 bg-surface"
          >
            <option value="">{t("allPackages")}</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
    </div>
  );
}
