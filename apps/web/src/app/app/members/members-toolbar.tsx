"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One place builds the address: the search box state is the source of truth for `q`, and any
  // filter change cancels a search update that is still waiting, so it can't undo the change.
  function go(next: Partial<Pick<Params, "tab" | "pkg">>) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const sp = new URLSearchParams(window.location.search);
    sp.delete("page");
    const merged = { tab: sp.get("tab") ?? "all", pkg: sp.get("pkg") ?? "", ...next, q: q.trim() };
    for (const [key, value] of Object.entries(merged)) {
      if (!value || (key === "tab" && value === "all")) sp.delete(key);
      else sp.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  }

  // Search as you type, with a short pause so slow connections aren't flooded.
  useEffect(() => {
    if (q.trim() === params.q) return;
    searchTimer.current = setTimeout(() => go({}), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` reads the latest state
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
